import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { HttpRouter } from "effect/http"
import { BioLabLive } from "./biolab/SqliteLive.ts"
import { BioJevConfig } from "./config/config.ts"
import { StatusRoute } from "./http/status.ts"
import { HttpLive } from "./platform/HttpLive.ts"
import { acquireOwnership } from "./platform/ownership.ts"
import { PiLive } from "./platform/pi/PiLive.ts"

const program = Effect.scoped(
  Effect.gen(function* () {
    const ownership = yield* acquireOwnership(yield* BioJevConfig)
    const resources = Layer.merge(
      BioLabLive(ownership.biojevDatabase),
      PiLive(ownership.piDatabase),
    )
    const server = HttpRouter.serve(StatusRoute).pipe(
      Layer.provide(HttpLive),
      Layer.provide(resources),
    )
    return yield* Effect.raceFirst(Layer.launch(server), ownership.lost)
  }),
).pipe(Effect.provide(NodeServices.layer))

NodeRuntime.runMain(program)
