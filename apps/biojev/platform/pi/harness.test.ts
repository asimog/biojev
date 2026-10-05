import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context"
import { createModels } from "@earendil-works/pi-ai/models"
import { NodeServices } from "@effect/platform-node"
import { assert, it } from "@effect/vitest"
import { Effect, Exit, FileSystem, Path } from "effect"
import { acquireHarness } from "./harness.ts"

it.effect(
  "closes and reopens Pi SQLite with persistent and fresh conversations",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fs.makeTempDirectoryScoped()
      const database = path.join(directory, "pi.sqlite")
      const options = { models: createModels() }

      const before = yield* Effect.scoped(
        Effect.gen(function* () {
          const harness = yield* acquireHarness(database, options)
          const director = yield* Effect.promise(() =>
            harness.root(BACKGROUND_CONTEXT),
          )
          const researcher = yield* Effect.promise(() =>
            harness.createConversation(
              { ownership: { kind: "ownerless" } },
              BACKGROUND_CONTEXT,
            ),
          )
          const agent = yield* Effect.promise(() =>
            director.agent(BACKGROUND_CONTEXT),
          )
          assert.deepStrictEqual(agent.tools, [])
          return { harness, director: director.id, researcher: researcher.id }
        }),
      )

      const released = yield* Effect.exit(
        Effect.promise(() => before.harness.root(BACKGROUND_CONTEXT)),
      )
      assert.isTrue(Exit.isFailure(released))

      yield* Effect.scoped(
        Effect.gen(function* () {
          const harness = yield* acquireHarness(database, options)
          const director = yield* Effect.promise(() =>
            harness.root(BACKGROUND_CONTEXT),
          )
          const researcher = yield* Effect.promise(() =>
            harness.createConversation(
              { ownership: { kind: "ownerless" } },
              BACKGROUND_CONTEXT,
            ),
          )
          assert.strictEqual(director.id, before.director)
          assert.notStrictEqual(researcher.id, before.researcher)
        }),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
)
