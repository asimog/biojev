import { Effect, Layer } from "effect"
import { AgentRuntime, AgentRuntimeError } from "./AgentRuntime.ts"

/**
 * Pi Durable adapter boundary.
 *
 * This file is intentionally the only place in the scaffold where Pi Durable
 * implementation imports are expected.
 *
 * IMPORTANT timeout behavior:
 * Pi documents that cancelling a wait does not cancel underlying durable work.
 * Therefore ResearchBlock timeout must call AgentRuntime.abort(), wait for
 * owned Pi work to become idle, and only then finalize the block as timed out.
 *
 * The real adapter is implemented after dependencies are installed and after
 * inspecting the exact installed Pi Durable API. Pi Durable is experimental,
 * so do not freeze guessed API calls into the scaffold.
 */
export const PiAgentRuntimeLive = Layer.effect(
  AgentRuntime,
  Effect.succeed(
    AgentRuntime.of({
      openFresh: () =>
        Effect.fail(
          new AgentRuntimeError({
            operation: "openFresh",
            message: "Pi adapter not installed yet",
          }),
        ),
      openPersistent: () =>
        Effect.fail(
          new AgentRuntimeError({
            operation: "openPersistent",
            message: "Pi adapter not installed yet",
          }),
        ),
      submitAndWait: () =>
        Effect.fail(
          new AgentRuntimeError({
            operation: "submitAndWait",
            message: "Pi adapter not installed yet",
          }),
        ),
      abort: () =>
        Effect.fail(
          new AgentRuntimeError({
            operation: "abort",
            message: "Pi adapter not installed yet",
          }),
        ),
      usage: () =>
        Effect.fail(
          new AgentRuntimeError({
            operation: "usage",
            message: "Pi adapter not installed yet",
          }),
        ),
    }),
  ),
)
