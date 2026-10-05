import { Config, Effect, Layer, Option } from "effect"
import { OpenRouterKey, OpenRouterModelConfig } from "../../config/config.ts"
import { acquireHarness } from "./harness.ts"
import { createResearchModels } from "./models.ts"

export const PiLive = (database: string) =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      const apiKey = yield* Config.option(OpenRouterKey)
      const selection = yield* OpenRouterModelConfig
      yield* acquireHarness(database, {
        models: createResearchModels(Option.getOrUndefined(apiKey), selection),
      })
    }),
  )
