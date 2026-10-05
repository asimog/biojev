import { createServer } from "node:http"
import { NodeHttpServer } from "@effect/platform-node"
import { Config } from "effect"

export const HttpLive = NodeHttpServer.layerConfig(createServer, {
  host: Config.Literals(["127.0.0.1", "localhost", "::1"], "BIOJEV_HOST").pipe(
    Config.withDefault("127.0.0.1"),
  ),
  port: Config.Port("BIOJEV_PORT").pipe(Config.withDefault(3001)),
})
