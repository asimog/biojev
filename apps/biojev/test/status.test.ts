import { NodeHttpServer } from "@effect/platform-node"
import { assert, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { HttpClient, HttpRouter } from "effect/http"
import { StatusRoute } from "../http/status.ts"

const TestServer = HttpRouter.serve(StatusRoute, {
  disableListenLog: true,
}).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

it.effect("serves IDLE over HTTP and rejects unknown routes", () =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const response = yield* client.get("/api/status")
    assert.strictEqual(response.status, 200)
    assert.deepStrictEqual(yield* response.json, { status: "IDLE" })
    const missing = yield* client.get("/api/missing")
    assert.strictEqual(missing.status, 404)
  }).pipe(Effect.provide(TestServer)),
)
