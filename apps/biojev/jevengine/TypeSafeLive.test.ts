import { NodeHttpClient, NodeHttpServer } from "@effect/platform-node"
import { assert, it } from "@effect/vitest"
import { ConfigProvider, Deferred, Effect, Fiber, Layer } from "effect"
import {
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http"
import { NetAddress } from "effect/net"
import {
  JevEngine,
  JevEngineError,
  type SemanticAnswer,
  type SemanticQuestion,
} from "./JevEngine.ts"
import { TypeSafeLive } from "./TypeSafeLive.ts"

const request = (question: SemanticQuestion["question"]): SemanticQuestion => ({
  questionId: "fixture-semantic-question",
  questionVersion: "1",
  originRunId: "fixture-run",
  subjectRefs: [],
  projection: {
    identity: "fixture-projection",
    version: "1",
    value: { zero: 0, flag: false, missing: null },
  },
  question,
})

const runWithJev = <A, E>(program: Effect.Effect<A, E, JevEngine>) =>
  Effect.gen(function* () {
    const server = yield* HttpServer.HttpServer
    if (server.address._tag === "UnixPathAddress")
      return yield* Effect.die(new Error("TCP test server required"))
    const address = yield* Effect.fromResult(NetAddress.toUrl(server.address))
    return yield* program.pipe(
      Effect.provide(
        TypeSafeLive.pipe(
          Layer.provide(
            Layer.merge(
              NodeHttpClient.layerNodeHttp,
              ConfigProvider.layer(
                ConfigProvider.fromEnvRecord({
                  TYPESAFE_API_KEY: "fixture-key",
                  TYPESAFE_BASE_URL: address.origin,
                  TYPESAFE_DEFAULT_MODEL: "fixture-requested-model",
                }),
              ),
            ),
          ),
        ),
      ),
    )
  })

it.effect(
  "imports TypeSafe SDK over Effect HTTP and validates all native primitives",
  () => {
    const questions: SemanticQuestion["question"][] = [
      { type: "noul", instructions: "Are these claims compatible?" },
      {
        type: "choice",
        instructions: "Which representation fits?",
        criteria: {
          first: null,
          second: { description: "Another representation" },
        },
      },
      {
        type: "score",
        instructions: "How relevant is this result?",
        criteria: ["Unrelated", "Related"],
      },
    ]
    const answers: SemanticAnswer[] = [
      { type: "noul", noul: 0 },
      {
        type: "choice",
        choice: "first",
        confidence: 0.8,
        probabilities: { first: 0.8, second: 0.2 },
      },
      {
        type: "score",
        score: 0.75,
        confidence: 0.75,
        legend: { "0": "Unrelated", "1": "Related" },
        probabilities: { "0": 0.25, "1": 0.75 },
      },
    ]
    const received: unknown[] = []
    let index = 0
    const routes = HttpRouter.add(
      "POST",
      "/v1/systemone",
      Effect.gen(function* () {
        const incoming = yield* HttpServerRequest.HttpServerRequest
        assert.strictEqual(incoming.headers.authorization, "Bearer fixture-key")
        received.push(yield* incoming.json)
        return yield* HttpServerResponse.json(
          {
            model: "fixture-actual-model",
            answers: { measurement: answers[index++] },
            usage: { input_tokens: 7, output_tokens: 2 },
          },
          { headers: { "x-typesafe-request-id": "fixture-receipt" } },
        )
      }),
    )
    const server = HttpRouter.serve(routes, { disableListenLog: true }).pipe(
      Layer.provideMerge(NodeHttpServer.layerTest),
    )
    return runWithJev(
      Effect.gen(function* () {
        const jev = yield* JevEngine
        for (const [offset, asked] of questions.entries()) {
          const measurement = yield* jev.measure(request(asked))
          assert.deepStrictEqual(measurement.answer, answers[offset])
          assert.strictEqual(measurement.model, "fixture-actual-model")
          assert.strictEqual(
            measurement.requestedModel,
            "fixture-requested-model",
          )
          assert.strictEqual(measurement.questionVersion, "1")
          assert.strictEqual(measurement.originRunId, "fixture-run")
          assert.match(measurement.inputHash, /^[a-f0-9]{64}$/)
          const digest = yield* Effect.promise(() =>
            crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(JSON.stringify(received[offset])),
            ),
          )
          assert.strictEqual(
            measurement.inputHash,
            Array.from(new Uint8Array(digest), (byte) =>
              byte.toString(16).padStart(2, "0"),
            ).join(""),
          )
          assert.deepStrictEqual(measurement.receipt, {
            requestId: "fixture-receipt",
          })
          assert.containSubset(received[offset], {
            state: { projection: { zero: 0, flag: false, missing: null } },
            questions: { measurement: asked },
            model: "fixture-requested-model",
          })
        }
      }),
    ).pipe(Effect.provide(server))
  },
)

it.effect(
  "rejects missing answers, incompatible labels, malformed confidence, and HTTP failure",
  () => {
    const cases = [
      { answers: {}, status: 200 },
      {
        answers: {
          measurement: {
            type: "choice",
            choice: "invented",
            confidence: 0.9,
            probabilities: { invented: 1 },
          },
        },
        status: 200,
      },
      {
        answers: {
          measurement: {
            type: "choice",
            choice: "first",
            confidence: 2,
            probabilities: { first: 1 },
          },
        },
        status: 200,
      },
      {
        answers: {
          measurement: {
            type: "choice",
            choice: "first",
            confidence: 0.9,
            probabilities: { first: 0.5 },
          },
        },
        status: 200,
      },
      { answers: {}, status: 503 },
      {
        answers: {
          measurement: {
            type: "choice",
            choice: "first",
            confidence: 1,
            probabilities: { first: 1 },
          },
        },
        status: 200,
        padding: "x".repeat(4 * 1024 * 1024),
      },
    ]
    let index = 0
    const routes = HttpRouter.add(
      "POST",
      "/v1/systemone",
      Effect.gen(function* () {
        const response = cases[index++]
        if (response === undefined)
          return yield* HttpServerResponse.json({}, { status: 500 })
        return yield* HttpServerResponse.json(
          {
            model: "fixture-model",
            answers: response.answers,
            usage: { input_tokens: 1, output_tokens: 1 },
            padding: response.padding,
          },
          { status: response.status },
        )
      }),
    )
    const server = HttpRouter.serve(routes, { disableListenLog: true }).pipe(
      Layer.provideMerge(NodeHttpServer.layerTest),
    )
    return runWithJev(
      Effect.gen(function* () {
        const jev = yield* JevEngine
        for (const _case of cases) {
          const outcome = yield* jev
            .measure(
              request({
                type: "choice",
                instructions: "Choose",
                criteria: { first: null },
              }),
            )
            .pipe(Effect.catchTag("JevEngineError", Effect.succeed))
          assert.instanceOf(outcome, JevEngineError)
        }
        assert.strictEqual(index, cases.length)
        const oversized = {
          ...request({ type: "noul", instructions: "Inspect" }),
          projection: {
            identity: "large-projection",
            version: "1",
            value: "x".repeat(1024 * 1024),
          },
        }
        const outcome = yield* jev
          .measure(oversized)
          .pipe(Effect.catchTag("JevEngineError", Effect.succeed))
        assert.instanceOf(outcome, JevEngineError)
        assert.strictEqual(index, cases.length)
      }),
    ).pipe(Effect.provide(server))
  },
)

it.effect("cancels the SDK request and releases the Effect HTTP request", () =>
  Effect.gen(function* () {
    const started = yield* Deferred.make<void>()
    const closed = yield* Deferred.make<void>()
    const routes = HttpRouter.add(
      "POST",
      "/v1/systemone",
      Deferred.succeed(started, undefined).pipe(
        Effect.andThen(Effect.never),
        Effect.ensuring(Deferred.succeed(closed, undefined)),
      ),
    )
    const server = HttpRouter.serve(routes, { disableListenLog: true }).pipe(
      Layer.provideMerge(NodeHttpServer.layerTest),
    )
    yield* runWithJev(
      Effect.gen(function* () {
        const jev = yield* JevEngine
        const pending = yield* jev
          .measure(request({ type: "noul", instructions: "Inspect" }))
          .pipe(Effect.forkChild)
        yield* Deferred.await(started)
        yield* Fiber.interrupt(pending)
        yield* Deferred.await(closed).pipe(Effect.timeout("2 seconds"))
      }),
    ).pipe(Effect.provide(server))
  }),
)

it.effect(
  "batches structured feature questions in one native request and rejects mismatched projections",
  () => {
    let calls = 0
    const routes = HttpRouter.add(
      "POST",
      "/v1/systemone",
      Effect.gen(function* () {
        calls++
        const incoming = yield* HttpServerRequest.HttpServerRequest
        const body = yield* incoming.json
        assert.containsAllKeys(body, ["state", "questions"])
        return yield* HttpServerResponse.json({
          model: "fixture-model",
          answers: {
            measurement_0: { type: "noul", noul: 0.2 },
            measurement_1: {
              type: "score",
              score: 0.8,
              confidence: 0.8,
              legend: { "0": "Absent", "1": "Present" },
              probabilities: { "0": 0.2, "1": 0.8 },
            },
          },
          usage: { input_tokens: 12, output_tokens: 4 },
        })
      }),
    )
    const server = HttpRouter.serve(routes, { disableListenLog: true }).pipe(
      Layer.provideMerge(NodeHttpServer.layerTest),
    )
    return runWithJev(
      Effect.gen(function* () {
        const jev = yield* JevEngine
        if (jev.measureBatch === undefined)
          return yield* Effect.die("Missing native batch")
        const questions = [
          request({
            type: "noul",
            instructions: { question: "Does the state describe a limitation?" },
            criteria: {
              true: "Explicit limitation",
              false: "No limitation stated",
            },
          }),
          request({
            type: "score",
            instructions: "Feature intensity",
            criteria: ["Absent", "Present"],
          }),
        ]
        const answers = yield* jev.measureBatch(questions)
        assert.lengthOf(answers, 2)
        assert.equal(calls, 1)
        assert.equal(answers[0].inputHash, answers[1].inputHash)
        assert.isString(answers[0].batchId)
        assert.equal(answers[0].batchId, answers[1].batchId)
        assert.deepEqual(
          answers.map((answer) => answer.batchQuestionIndex),
          [0, 1],
        )
        const invalid = yield* jev
          .measureBatch([
            questions[0],
            {
              ...questions[1],
              projection: { ...questions[1].projection, value: "different" },
            },
          ])
          .pipe(Effect.result)
        assert.equal(invalid._tag, "Failure")
        assert.equal(calls, 1)
      }),
    ).pipe(Effect.provide(server))
  },
)
