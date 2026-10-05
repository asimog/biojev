import {
  awaitWithContext,
  BACKGROUND_CONTEXT,
  withCancel,
} from "@earendil-works/chord/context"
import { Type } from "@earendil-works/pi-ai"
import { createModels } from "@earendil-works/pi-ai/models"
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from "@earendil-works/pi-ai/providers/faux"
import { defineExtension, defineTool } from "@earendil-works/pi-durable"
import { NodeServices } from "@effect/platform-node"
import { assert, it } from "@effect/vitest"
import { Cause, Effect, Exit, FileSystem, Path } from "effect"
import { acquireHarness, PiResourceError } from "./harness.ts"

const signal = () => {
  let resolve = () => {}
  const promise = new Promise<void>((notify) => {
    resolve = notify
  })
  return { promise, resolve }
}

const databasePath = Effect.fn("qualification.databasePath")(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  return path.join(yield* fs.makeTempDirectoryScoped(), "pi.sqlite")
})

const provider = () => {
  const faux = fauxProvider()
  const models = createModels()
  models.setProvider(faux.provider)
  return { faux, models, model: { provider: "faux", modelId: "faux-1" } }
}

it.effect(
  "reports a typed failure when the Pi storage path is a directory",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped()
      const outcome = yield* acquireHarness(directory, {
        models: createModels(),
      }).pipe(Effect.catchTag("PiResourceError", Effect.succeed))
      assert.instanceOf(outcome, PiResourceError)
      if (outcome instanceof PiResourceError) {
        assert.strictEqual(outcome.operation, "openStorage")
      }
    }).pipe(Effect.provide(NodeServices.layer)),
)

it.effect(
  "retains a real model/tool/answer path and deduplicates reopened input",
  () =>
    Effect.gen(function* () {
      const database = yield* databasePath()
      const { faux, models, model } = provider()
      let executions = 0
      const count = defineTool({
        name: "count",
        description: "Count the supplied values",
        parameters: Type.Object({ values: Type.Array(Type.Number()) }),
        execute: async ({ values }, api) => {
          executions++
          api.output(`Count: ${values.length}`)
          return {}
        },
      })
      const extension = defineExtension({
        name: "qualification",
        tools: [count],
      })
      const options = { models, extensions: [extension] }
      faux.setResponses([
        fauxAssistantMessage(fauxToolCall("count", { values: [2, 4, 8] }), {
          stopReason: "toolUse",
        }),
        (context) => {
          const result = context.messages.find(
            (message) => message.role === "toolResult",
          )
          assert.isDefined(result)
          assert.include(JSON.stringify(result), "Count: 3")
          return fauxAssistantMessage("There are three values.")
        },
      ])

      const submissionId = yield* Effect.scoped(
        Effect.gen(function* () {
          const harness = yield* acquireHarness(database, options)
          return yield* Effect.promise(async () => {
            const conversation = await harness.root(BACKGROUND_CONTEXT, {
              agent: { model, tools: [count] },
            })
            const view = await conversation.viewState(BACKGROUND_CONTEXT)
            const kinds = new Set<string>()
            const unsubscribe = view.subscribe((value) => {
              for (const entry of value.entries) kinds.add(entry.kind)
            })
            try {
              const submission = await conversation.submit(
                {
                  type: "input",
                  content: "Count these values",
                  requestId: "count-once",
                },
                BACKGROUND_CONTEXT,
              )
              assert.strictEqual(
                (await submission.wait(BACKGROUND_CONTEXT)).status,
                "done",
              )
              const context = await conversation.context(BACKGROUND_CONTEXT)
              assert.include(
                JSON.stringify(context.messages),
                "There are three values.",
              )
              assert.isTrue(kinds.has("pi.tool-result"))
              const usage = await harness.usage(BACKGROUND_CONTEXT)
              assert.isDefined(usage.models["faux/faux-1"])
              return submission.id
            } finally {
              unsubscribe()
              view.dispose()
            }
          })
        }),
      )

      yield* Effect.scoped(
        Effect.gen(function* () {
          const harness = yield* acquireHarness(database, options)
          yield* Effect.promise(async () => {
            const conversation = await harness.root(BACKGROUND_CONTEXT)
            const again = await conversation.submit(
              {
                type: "input",
                content: "Count these values",
                requestId: "count-once",
              },
              BACKGROUND_CONTEXT,
            )
            assert.strictEqual(again.id, submissionId)
            assert.strictEqual(
              (await again.wait(BACKGROUND_CONTEXT)).status,
              "done",
            )
            const context = await conversation.context(BACKGROUND_CONTEXT)
            assert.strictEqual(
              context.messages.filter((message) => message.role === "user")
                .length,
              1,
            )
            assert.include(JSON.stringify(context.messages), "Count: 3")
            assert.strictEqual(executions, 1)
            assert.strictEqual(faux.state.callCount, 2)
          })
        }),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
)

it.effect("cancelling a waiter leaves work alive until explicit Pi abort", () =>
  Effect.gen(function* () {
    const database = yield* databasePath()
    const { faux, models, model } = provider()
    const started = signal()
    const release = signal()
    let ended = false
    const blocked = defineTool({
      name: "blocked",
      description: "Wait for cancellation",
      parameters: Type.Object({}),
      execute: async (_args, _api, context) => {
        started.resolve()
        try {
          await awaitWithContext(release.promise, context)
          return {}
        } finally {
          ended = true
        }
      },
    })
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall("blocked", {}), {
        stopReason: "toolUse",
      }),
    ])
    const harness = yield* acquireHarness(database, {
      models,
      extensions: [
        defineExtension({ name: "qualification", tools: [blocked] }),
      ],
    })
    yield* Effect.promise(async () => {
      const conversation = await harness.root(BACKGROUND_CONTEXT, {
        agent: { model },
      })
      const submission = await conversation.submit(
        { type: "input", content: "Wait" },
        BACKGROUND_CONTEXT,
      )
      await started.promise
      const waiter = withCancel(BACKGROUND_CONTEXT)
      const cancelled = submission.wait(waiter.context).then(
        () => false,
        () => true,
      )
      waiter.cancel()
      assert.isTrue(await cancelled)
      assert.isFalse(ended)
      assert.strictEqual(
        (await submission.status(BACKGROUND_CONTEXT)).status,
        "placed",
      )
      await conversation.abort(BACKGROUND_CONTEXT, { background: true })
      await conversation.waitForIdle(BACKGROUND_CONTEXT)
      assert.isTrue(ended)
      assert.strictEqual(
        (await submission.wait(BACKGROUND_CONTEXT)).status,
        "unanswered",
      )
      assert.lengthOf((await harness.inspect(BACKGROUND_CONTEXT)).tasks, 0)
    })
  }).pipe(Effect.provide(NodeServices.layer)),
)

it.effect("close preserves pending work without replaying an unsafe tool", () =>
  Effect.gen(function* () {
    const database = yield* databasePath()
    const { faux, models, model } = provider()
    const started = signal()
    const release = signal()
    let executions = 0
    const external = defineTool({
      name: "external",
      description: "Represent an operation unsafe to repeat",
      parameters: Type.Object({}),
      replay: "unsafe",
      execute: async (_args, _api, context) => {
        executions++
        started.resolve()
        await awaitWithContext(release.promise, context)
        return {}
      },
    })
    const options = {
      models,
      extensions: [
        defineExtension({ name: "qualification", tools: [external] }),
      ],
    }
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall("external", {}), {
        stopReason: "toolUse",
      }),
    ])
    const submissionId = yield* Effect.scoped(
      Effect.gen(function* () {
        const harness = yield* acquireHarness(database, options)
        return yield* Effect.promise(async () => {
          const conversation = await harness.root(BACKGROUND_CONTEXT, {
            agent: { model },
          })
          const submission = await conversation.submit(
            {
              type: "input",
              content: "Run the operation",
              requestId: "external-once",
            },
            BACKGROUND_CONTEXT,
          )
          await started.promise
          return submission.id
        })
      }),
    )
    faux.setResponses([
      (context) => {
        const result = context.messages.find(
          (message) => message.role === "toolResult",
        )
        assert.isDefined(result)
        assert.include(JSON.stringify(result), "interrupted")
        return fauxAssistantMessage(
          "The operation was interrupted; its outcome is uncertain.",
        )
      },
    ])
    yield* Effect.scoped(
      Effect.gen(function* () {
        const harness = yield* acquireHarness(database, options)
        yield* Effect.promise(async () => {
          const inspection = await harness.inspect(BACKGROUND_CONTEXT)
          assert.isAbove(inspection.tasks.length, 0)
          const submission = await harness.submission(
            submissionId,
            BACKGROUND_CONTEXT,
          )
          if (submission === undefined)
            throw new Error("Pending submission was lost")
          assert.strictEqual(
            (await submission.wait(BACKGROUND_CONTEXT)).status,
            "done",
          )
          assert.strictEqual(executions, 1)
          const conversation = await harness.root(BACKGROUND_CONTEXT)
          assert.include(
            JSON.stringify(
              (await conversation.context(BACKGROUND_CONTEXT)).messages,
            ),
            "uncertain",
          )
        })
      }),
    )
  }).pipe(Effect.provide(NodeServices.layer)),
)

it.effect("keeps release failures visible after closing real Pi storage", () =>
  Effect.gen(function* () {
    const database = yield* databasePath()
    const options = { models: createModels() }
    const failed = yield* Effect.exit(
      Effect.scoped(
        Effect.gen(function* () {
          const harness = yield* acquireHarness(database, options)
          yield* Effect.promise(() => harness.root(BACKGROUND_CONTEXT))
          const close = harness.close.bind(harness)
          harness.close = async (context) => {
            await close(context)
            throw new Error("Injected release failure")
          }
        }),
      ),
    )
    assert.isTrue(Exit.isFailure(failed))
    if (Exit.isFailure(failed))
      assert.include(Cause.pretty(failed.cause), "Injected release failure")
    yield* Effect.scoped(
      Effect.gen(function* () {
        const harness = yield* acquireHarness(database, options)
        const conversation = yield* Effect.promise(() =>
          harness.root(BACKGROUND_CONTEXT),
        )
        assert.isDefined(conversation.id)
      }),
    )
  }).pipe(Effect.provide(NodeServices.layer)),
)
