import {
  type EntryType,
  type JsonValue,
  type Question,
  TypeSafeClient,
} from "@typesafe-ai/sdk"
import {
  ByteSize,
  type Context,
  DateTime,
  Effect,
  Layer,
  Redacted,
  Schema,
} from "effect"
import { HttpClient, HttpClientRequest, HttpIncomingMessage } from "effect/http"
import { bodyText } from "effect/http/HttpClientRequest"
import { TypeSafeConfig } from "../config/config.ts"
import {
  JevEngine,
  JevEngineError,
  SemanticAnswer,
  SemanticMeasurement,
  SemanticQuestion,
} from "./JevEngine.ts"

// The imported SDK calls this Promise boundary outside application Effects.
const bridge = (context: Context.Context<HttpClient.HttpClient>) =>
  Effect.runPromiseWith(context)

const json = (value: Schema.Json): JsonValue => {
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(json)
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, json(item)]),
  )
}
const entry = (
  value: string | Schema.JsonObject | ReadonlyArray<Schema.Json> | null,
): EntryType => {
  if (value === null || typeof value === "string") return value
  if (Array.isArray(value)) return value.map(json)
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, json(item)]),
  )
}
const question = (value: SemanticQuestion["question"]): Question => {
  switch (value.type) {
    case "noul":
      return {
        type: "noul",
        instructions: entry(value.instructions),
        ...(value.criteria === undefined
          ? {}
          : {
              criteria: {
                true: entry(value.criteria.true),
                false: entry(value.criteria.false),
              },
            }),
      }
    case "choice":
      return {
        ...value,
        instructions: entry(value.instructions),
        criteria: Object.fromEntries(
          Object.entries(value.criteria).map(([key, item]) => [
            key,
            entry(item),
          ]),
        ),
      }
    case "score": {
      const [first, second, ...rest] = value.criteria
      return {
        ...value,
        instructions: entry(value.instructions),
        criteria: [entry(first), entry(second), ...rest.map(entry)],
      }
    }
  }
}
const ResponseBody = Schema.Struct({
  model: Schema.NonEmptyString,
  answers: Schema.Struct({ measurement: SemanticAnswer }),
  usage: SemanticMeasurement.fields.usage,
})
const sameJson = Schema.toEquivalence(Schema.Json)

const matches = (
  asked: SemanticQuestion["question"],
  answer: SemanticAnswer,
) => {
  if (asked.type !== answer.type) return false
  if (asked.type === "noul") return true
  if (answer.type === "noul") return false
  const labels =
    asked.type === "choice"
      ? Object.keys(asked.criteria)
      : asked.criteria.map((_, index) => String(index))
  const actual = Object.keys(answer.probabilities)
  if (
    labels.length !== actual.length ||
    actual.some((label) => !labels.includes(label))
  )
    return false
  if (
    Math.abs(
      Object.values(answer.probabilities).reduce(
        (sum, probability) => sum + probability,
        0,
      ) - 1,
    ) > 0.00001
  )
    return false
  if (answer.type === "choice") return labels.includes(answer.choice)
  if (
    asked.type !== "score" ||
    answer.score < 0 ||
    answer.score > asked.criteria.length - 1
  )
    return false
  const legend = Object.keys(answer.legend)
  return (
    legend.length === labels.length &&
    labels.every(
      (label, index) =>
        Object.hasOwn(answer.legend, label) &&
        sameJson(answer.legend[label], asked.criteria[index]),
    )
  )
}

export const TypeSafeLive = Layer.effect(JevEngine)(
  Effect.gen(function* () {
    const config = yield* TypeSafeConfig
    const run = bridge(yield* Effect.context<HttpClient.HttpClient>())
    const client = new TypeSafeClient({
      apiKey: Redacted.value(config.apiKey),
      baseURL: config.baseURL,
      defaultModel: config.model,
      logLevel: "off",
      retry: { maxRetries: 0 },
      timeout: 10000,
      fetch: (input, init) =>
        run(
          Effect.scoped(
            Effect.gen(function* () {
              if (init?.method !== "POST" || typeof init.body !== "string") {
                return yield* new JevEngineError({
                  message: "Unsupported TypeSafe request",
                })
              }
              const http = yield* HttpClient.HttpClient
              const request = HttpClientRequest.post(input, {
                headers: new Headers(init.headers),
              }).pipe(bodyText(init.body, "application/json"))
              const response = yield* http.execute(request)
              const body = yield* response.arrayBuffer
              return new Response(body, {
                status: response.status,
                headers: response.headers,
              })
            }),
          ).pipe(
            Effect.provideService(
              HttpIncomingMessage.MaxBodySize,
              ByteSize.mebibytes(4),
            ),
          ),
          {
            signal: init?.signal ?? undefined,
          },
        ),
    })

    const measure = Effect.fn("JevEngine.measure")(
      function* (input: SemanticQuestion) {
        const request = yield* Schema.decodeEffect(SemanticQuestion)(input)
        const payload = {
          state: { projection: json(request.projection.value) },
          questions: { measurement: question(request.question) },
          model: config.model,
        }
        const bytes = new TextEncoder().encode(JSON.stringify(payload))
        if (bytes.length > 1024 * 1024)
          return yield* new JevEngineError({
            message: "Jev request exceeds one MiB",
          })
        const digest = yield* Effect.promise(() =>
          crypto.subtle.digest("SHA-256", bytes),
        )
        const response = yield* Effect.tryPromise({
          try: (signal) => client.systemOne(payload, { signal }).withResponse(),
          catch: (cause) =>
            new JevEngineError({ message: "TypeSafe request failed", cause }),
        })
        // SDK result types are compile-time only; treat the HTTP body as untrusted.
        const raw: unknown = response.data
        const body = yield* Schema.decodeUnknownEffect(ResponseBody)(raw)
        if (!matches(request.question, body.answers.measurement)) {
          return yield* new JevEngineError({
            message: "TypeSafe answer does not match the question",
          })
        }
        return yield* Schema.decodeEffect(SemanticMeasurement)({
          measurementId: crypto.randomUUID(),
          ...request,
          primitive: request.question.type,
          inputHash: Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join(""),
          provider: "typesafe",
          requestedModel: config.model,
          model: body.model,
          answer: body.answers.measurement,
          usage: body.usage,
          receipt: { requestId: response.requestId ?? null },
          createdAt: DateTime.toEpochMillis(yield* DateTime.now),
        })
      },
      Effect.mapError((cause) =>
        cause instanceof JevEngineError
          ? cause
          : new JevEngineError({ message: "Invalid Jev measurement", cause }),
      ),
    )
    const measureBatch = Effect.fn("JevEngine.measureBatch")(
      function* (inputs: ReadonlyArray<SemanticQuestion>) {
        const requests = yield* Schema.decodeEffect(
          Schema.Array(SemanticQuestion).check(
            Schema.isMinLength(1),
            Schema.isMaxLength(64),
          ),
        )(inputs)
        const first = requests[0]
        if (
          requests.some(
            (request) =>
              !sameJson(request.projection.value, first.projection.value),
          )
        )
          return yield* new JevEngineError({
            message: "Batch questions must share the same projected state",
          })
        const payload = {
          state: { projection: json(first.projection.value) },
          questions: Object.fromEntries(
            requests.map((request, index) => [
              `measurement_${index}`,
              question(request.question),
            ]),
          ),
          model: config.model,
        }
        const bytes = new TextEncoder().encode(JSON.stringify(payload))
        if (bytes.length > 1024 * 1024)
          return yield* new JevEngineError({
            message: "Jev batch exceeds one MiB",
          })
        const digest = yield* Effect.promise(() =>
          crypto.subtle.digest("SHA-256", bytes),
        )
        const response = yield* Effect.tryPromise({
          try: (signal) => client.systemOne(payload, { signal }).withResponse(),
          catch: (cause) =>
            new JevEngineError({ message: "TypeSafe batch failed", cause }),
        })
        const raw: unknown = response.data
        const body = yield* Schema.decodeUnknownEffect(
          Schema.Struct({
            model: Schema.NonEmptyString,
            answers: Schema.Record(Schema.String, SemanticAnswer),
            usage: SemanticMeasurement.fields.usage,
          }),
        )(raw)
        if (Object.keys(body.answers).length !== requests.length)
          return yield* new JevEngineError({
            message: "TypeSafe batch answer count mismatch",
          })
        const batchId = crypto.randomUUID()
        return yield* Effect.forEach(requests, (request, index) =>
          Effect.gen(function* () {
            const answer = body.answers[`measurement_${index}`]
            if (answer === undefined || !matches(request.question, answer))
              return yield* new JevEngineError({
                message: "TypeSafe batch answer does not match question",
              })
            return yield* Schema.decodeEffect(SemanticMeasurement)({
              measurementId: crypto.randomUUID(),
              batchId,
              batchQuestionIndex: index,
              ...request,
              primitive: request.question.type,
              inputHash: Array.from(new Uint8Array(digest), (byte) =>
                byte.toString(16).padStart(2, "0"),
              ).join(""),
              provider: "typesafe",
              requestedModel: config.model,
              model: body.model,
              answer,
              usage: body.usage,
              receipt: { requestId: response.requestId ?? null },
              createdAt: DateTime.toEpochMillis(yield* DateTime.now),
            })
          }),
        )
      },
      Effect.mapError((cause) =>
        cause instanceof JevEngineError
          ? cause
          : new JevEngineError({ message: "Invalid Jev batch", cause }),
      ),
    )
    return JevEngine.of({ measure, measureBatch })
  }),
)
