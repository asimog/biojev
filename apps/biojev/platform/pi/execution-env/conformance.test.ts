import assert from "node:assert/strict"
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context"
import { createEnvConformance } from "@earendil-works/pi-durable/testing"
import { NodeServices } from "@effect/platform-node"
import { Context, Effect, FileSystem, Path } from "effect"
import { it } from "vitest"
import { LinuxNetworkConfig } from "../../../config/config.ts"
import { acquireLinuxEnvironment } from "./Linux.ts"

// Imported conformance invokes this runner at a foreign callback boundary.
const bridge = (context: Context.Context<never>) =>
  Effect.runPromiseWith(context)
const run = bridge(Context.empty())
const cases = createEnvConformance({
  assertions: {
    ok: (value, message) => assert.ok(value, message),
    strictEqual: assert.strictEqual,
    deepEqual: assert.deepStrictEqual,
    partialDeepEqual: assert.partialDeepStrictEqual,
    greaterThan: (actual, expected) => assert.ok(actual > expected),
    rejects: async (operation, text) => {
      await assert.rejects(
        operation,
        (error: unknown) =>
          error instanceof Error && error.message.includes(text),
      )
    },
  },
  withEnv: (use) =>
    run(
      Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem
          const path = yield* Path.Path
          const network = yield* LinuxNetworkConfig
          const resource = yield* acquireLinuxEnvironment({
            nodeModules: path.resolve("node_modules"),
            workerDirectory: path.resolve(
              "apps/biojev/platform/pi/execution-env",
            ),
            nodeBinary: process.execPath,
            artifactDirectory: yield* fs.makeTempDirectoryScoped(),
            ...network,
          })
          yield* Effect.promise(() =>
            resource.env.createDir(
              "conformance",
              undefined,
              BACKGROUND_CONTEXT,
            ),
          )
          resource.env.cwd = "/work/conformance"
          yield* Effect.promise(() => use(resource.env))
        }),
      ).pipe(Effect.provide(NodeServices.layer)),
    ),
})
for (const check of cases)
  it(check.name, () => check.run(), Math.max(check.timeoutMs ?? 30000, 30000))
