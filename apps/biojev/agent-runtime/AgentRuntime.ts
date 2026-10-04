import { Context, type Effect, Schema } from "effect"

export const AgentConversationId = Schema.String.pipe(
  Schema.brand("AgentConversationId"),
)
export type AgentConversationId = typeof AgentConversationId.Type

export class AgentRuntimeError extends Schema.TaggedError<AgentRuntimeError>()(
  "AgentRuntimeError",
  {
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
) {}

export interface OpenAgentRequest {
  readonly role: "director" | "researcher" | "validator"
  readonly instructions: string
  readonly persistentKey?: string
}

export interface AgentSubmission {
  readonly requestId: string
  readonly content: string
}

export interface AgentUsage {
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly costUsd?: number
}

export interface AgentAnswer {
  readonly conversationId: AgentConversationId
  readonly text: string
  readonly usage?: AgentUsage
}

/**
 * BioJev's only public cognition runtime contract.
 *
 * Pi Durable is one implementation. Pi types must not escape this module family.
 */
export class AgentRuntime extends Context.Service<
  AgentRuntime,
  {
    readonly openFresh: (
      request: OpenAgentRequest,
    ) => Effect.Effect<AgentConversationId, AgentRuntimeError>

    readonly openPersistent: (
      request: OpenAgentRequest,
    ) => Effect.Effect<AgentConversationId, AgentRuntimeError>

    readonly submitAndWait: (
      conversationId: AgentConversationId,
      submission: AgentSubmission,
    ) => Effect.Effect<AgentAnswer, AgentRuntimeError>

    readonly abort: (
      conversationId: AgentConversationId,
    ) => Effect.Effect<void, AgentRuntimeError>

    readonly usage: (
      conversationId: AgentConversationId,
    ) => Effect.Effect<AgentUsage | undefined, AgentRuntimeError>
  }
>()("BioJev/AgentRuntime") {}
