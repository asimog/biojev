import { NodeServices } from "@effect/platform-node"
import { assert, it } from "@effect/vitest"
import { Effect, Exit, FileSystem, Path } from "effect"
import { acquireOwnership } from "./ownership.ts"

it.effect(
  "excludes a competing owner of either store and releases on scope close",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fs.makeTempDirectoryScoped()
      const databases = {
        biojevDatabase: path.join(directory, "biojev.sqlite"),
        piDatabase: path.join(directory, "pi.sqlite"),
      }
      const released = yield* Effect.scoped(
        Effect.gen(function* () {
          const lease = yield* acquireOwnership(databases)
          yield* lease.assertHeld
          const duplicate = yield* Effect.exit(
            Effect.scoped(acquireOwnership(databases)),
          )
          assert.isTrue(Exit.isFailure(duplicate))
          const sharedPi = yield* Effect.exit(
            Effect.scoped(
              acquireOwnership({
                ...databases,
                biojevDatabase: path.join(directory, "other.sqlite"),
              }),
            ),
          )
          assert.isTrue(Exit.isFailure(sharedPi))
          return lease
        }),
      )
      assert.isTrue(Exit.isFailure(yield* Effect.exit(released.assertHeld)))
      yield* Effect.scoped(
        Effect.gen(function* () {
          const lease = yield* acquireOwnership(databases)
          yield* lease.assertHeld
        }),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
)

it.effect("rejects the same store including a symlink alias", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const directory = yield* fs.makeTempDirectoryScoped()
    const database = path.join(directory, "same.sqlite")
    assert.isTrue(
      Exit.isFailure(
        yield* Effect.exit(
          Effect.scoped(
            acquireOwnership({
              biojevDatabase: database,
              piDatabase: database,
            }),
          ),
        ),
      ),
    )
    yield* fs.writeFileString(database, "")
    const alias = path.join(directory, "alias.sqlite")
    yield* fs.symlink(database, alias)
    assert.isTrue(
      Exit.isFailure(
        yield* Effect.exit(
          Effect.scoped(
            acquireOwnership({ biojevDatabase: database, piDatabase: alias }),
          ),
        ),
      ),
    )
  }).pipe(Effect.provide(NodeServices.layer)),
)
