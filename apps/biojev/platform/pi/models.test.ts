import { Type } from "@earendil-works/pi-ai"
import { it as effectIt } from "@effect/vitest"
import { ConfigProvider, Effect, Redacted } from "effect"
import { assert, it } from "vitest"
import { OpenRouterModelConfig, TypeSafeConfig } from "../../config/config.ts"
import { createResearchModels, FallbackModel, ResearchModel } from "./models.ts"

it.each(["simple", "api"] as const)(
  "routes the imported %s adapter and preserves actual response model and tools",
  async (mode) => {
    const models = createResearchModels(Redacted.make("fixture-key"))
    const model = models.getModel(ResearchModel.provider, ResearchModel.modelId)
    assert.isDefined(model)
    if (model === undefined) throw new Error("Pinned Pi catalog lacks DeepSeek")
    const requests: unknown[] = []
    const responseModel = "fixture/free-model"
    const options = {
      onPayload: () => undefined,
      fetch: async (_input: unknown, init?: RequestInit) => {
        assert.strictEqual(
          new Headers(init?.headers).get("authorization"),
          "Bearer fixture-key",
        )
        assert.isString(init?.body)
        requests.push(JSON.parse(String(init?.body)))
        return new Response(
          `data: ${JSON.stringify({
            id: "fixture-request",
            model: responseModel,
            choices: [
              {
                index: 0,
                delta: { role: "assistant", content: "A routed answer" },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
          })}\n\ndata: [DONE]\n\n`,
          { headers: { "content-type": "text/event-stream" } },
        )
      },
    }
    const context = {
      messages: [
        { role: "user" as const, content: "Investigate", timestamp: 0 },
      ],
      tools: [
        {
          name: "inspect",
          description: "Inspect available history",
          parameters: Type.Object({}),
        },
      ],
    }
    const answer = await (mode === "simple"
      ? models.completeSimple(model, context, options)
      : models.complete(model, context, options))
    assert.strictEqual(requests.length, 1)
    assert.containSubset(requests[0], {
      model: ResearchModel.modelId,
      models: [ResearchModel.modelId, FallbackModel],
      tools: [{ type: "function", function: { name: "inspect" } }],
    })
    assert.strictEqual(answer.stopReason, "stop")
    assert.strictEqual(answer.model, ResearchModel.modelId)
    assert.strictEqual(answer.responseModel, responseModel)
    assert.strictEqual(answer.usage.input, 5)
    assert.strictEqual(answer.usage.output, 3)
  },
)

it("keeps cancellation in the imported provider request", async () => {
  const models = createResearchModels(Redacted.make("fixture-key"))
  const model = models.getModel(ResearchModel.provider, ResearchModel.modelId)
  if (model === undefined) throw new Error("Pinned Pi catalog lacks DeepSeek")
  const controller = new AbortController()
  let entered = () => {}
  const ready = new Promise<void>((resolve) => {
    entered = resolve
  })
  let cancelled = false
  const pending = models.completeSimple(
    model,
    { messages: [] },
    {
      signal: controller.signal,
      fetch: async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const cancel = () => {
            cancelled = true
            reject(new DOMException("Cancelled", "AbortError"))
          }
          init?.signal?.addEventListener("abort", cancel, { once: true })
          if (init?.signal?.aborted) cancel()
          entered()
        }),
    },
  )
  await ready
  controller.abort()
  const answer = await pending
  assert.isTrue(cancelled)
  assert.strictEqual(answer.stopReason, "aborted")
})

it("does not resolve host credentials without explicit Effect configuration", async () => {
  const models = createResearchModels()
  assert.isUndefined(await models.getAuth(ResearchModel.provider))
})

effectIt.effect(
  "uses environment model choices in the imported routing payload",
  () =>
    Effect.gen(function* () {
      const selected = yield* OpenRouterModelConfig
      const semantic = yield* TypeSafeConfig
      assert.strictEqual(semantic.model, "fixture-jev-model")
      const models = createResearchModels(
        Redacted.make("fixture-key"),
        selected,
      )
      const model = models.getModel("openrouter", selected.modelId)
      if (model === undefined)
        throw new Error("Configured fixture model is absent")
      const answer = yield* Effect.promise(() =>
        models.completeSimple(
          model,
          { messages: [] },
          {
            fetch: async (_input, init) => {
              assert.containSubset(JSON.parse(String(init?.body)), {
                model: FallbackModel,
                models: [FallbackModel, ResearchModel.modelId],
              })
              return new Response(
                `data: ${JSON.stringify({ model: "fixture/selected", choices: [{ index: 0, delta: { content: "Configured" }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
                { headers: { "content-type": "text/event-stream" } },
              )
            },
          },
        ),
      )
      assert.strictEqual(answer.stopReason, "stop")
      assert.strictEqual(answer.model, FallbackModel)
    }).pipe(
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromEnvRecord({
            OPENROUTER_MODEL: FallbackModel,
            OPENROUTER_FALLBACK_MODEL: ResearchModel.modelId,
            TYPESAFE_API_KEY: "fixture-key",
            TYPESAFE_DEFAULT_MODEL: "fixture-jev-model",
          }),
        ),
      ),
    ),
)
