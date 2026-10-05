import type { ProviderRequestOptions } from "@earendil-works/pi-ai"
import { createModels } from "@earendil-works/pi-ai/models"
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter"
import { Redacted } from "effect"
import { DefaultOpenRouterModels } from "../../config/config.ts"

export const ResearchModel = {
  provider: "openrouter",
  modelId: DefaultOpenRouterModels.modelId,
} as const
export const FallbackModel = DefaultOpenRouterModels.fallbackModelId

// Routing stays inside the imported provider request. It never retries a Pi
// conversation or a scientific tool after an application failure.
const routing =
  (
    selection: { readonly modelId: string; readonly fallbackModelId: string },
    options: ProviderRequestOptions = {},
  ) =>
  async (
    payload: unknown,
    model: Parameters<NonNullable<ProviderRequestOptions["onPayload"]>>[1],
  ) => {
    const changed = await options.onPayload?.(payload, model)
    const body = changed === undefined ? payload : changed
    if (model.id !== selection.modelId) return body
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new TypeError("OpenRouter chat payload must be an object")
    }
    return {
      ...body,
      model: selection.modelId,
      models: [selection.modelId, selection.fallbackModelId],
    }
  }

export const createResearchModels = (
  apiKey?: Redacted.Redacted<string>,
  selection: {
    readonly modelId: string
    readonly fallbackModelId: string
  } = DefaultOpenRouterModels,
) => {
  const models = createModels({
    authContext: {
      env: async (name) =>
        name === "OPENROUTER_API_KEY" && apiKey !== undefined
          ? Redacted.value(apiKey)
          : undefined,
      fileExists: async () => false,
    },
  })
  const upstream = openrouterProvider()
  const provider: ReturnType<typeof openrouterProvider> = {
    ...upstream,
    stream: (model, context, options) =>
      upstream.stream(
        model,
        context,
        Object.assign({}, options, {
          onPayload: routing(selection, options),
        }),
      ),
    streamSimple: (model, context, options) =>
      upstream.streamSimple(model, context, {
        ...options,
        onPayload: routing(selection, options),
      }),
  }
  models.setProvider(provider)
  return models
}
