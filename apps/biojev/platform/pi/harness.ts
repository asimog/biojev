import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context"
import {
  createRegistry,
  type Extension,
  Harness,
  type HarnessOptions,
  type Registry,
} from "@earendil-works/pi-durable"
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node"
import { CodingTools } from "@earendil-works/pi-durable/tools"
import { Effect, Schema } from "effect"

export class PiResourceError extends Schema.TaggedError<PiResourceError>()(
  "PiResourceError",
  { operation: Schema.String, cause: Schema.Defect() },
) {}

export const acquireHarness = Effect.fn("acquireHarness")(function* (
  database: string,
  options: Pick<HarnessOptions, "models" | "env" | "onReport" | "settings"> & {
    readonly extensions?: ReadonlyArray<Extension>
    readonly registry?: Registry
  },
) {
  const {
    extensions = [],
    registry = createRegistry(),
    ...harnessOptions
  } = options
  if (options.env !== undefined) registry.install(CodingTools)
  for (const extension of extensions) registry.install(extension)

  // Storage also owns a finalizer in case Harness acquisition fails.
  const storage = yield* Effect.acquireRelease(
    Effect.tryPromise({
      try: () => openNodeSqliteStorage(database),
      catch: (cause) =>
        new PiResourceError({ operation: "openStorage", cause }),
    }),
    (storage) => Effect.promise(() => storage.close(BACKGROUND_CONTEXT)),
  )

  return yield* Effect.acquireRelease(
    Effect.tryPromise({
      try: () =>
        Harness.open(
          storage,
          { ...harnessOptions, registry },
          BACKGROUND_CONTEXT,
        ),
      catch: (cause) =>
        new PiResourceError({ operation: "openHarness", cause }),
    }),
    (harness) => Effect.promise(() => harness.close(BACKGROUND_CONTEXT)),
  )
})
