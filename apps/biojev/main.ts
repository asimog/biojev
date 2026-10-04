import { NodeRuntime } from "@effect/platform-node"
import { Layer } from "effect"
import { HttpRouter } from "effect/http"
import { StatusRoute } from "./http/status.ts"
import { HttpLive } from "./platform/HttpLive.ts"

const ServerLive = HttpRouter.serve(StatusRoute).pipe(Layer.provide(HttpLive))

NodeRuntime.runMain(Layer.launch(ServerLive))
