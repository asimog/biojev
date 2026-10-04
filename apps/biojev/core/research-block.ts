import { Effect } from "effect"
import { AgentRuntime } from "../agent-runtime/AgentRuntime.ts"
import type { ResearchObjective } from "../agents/contracts.ts"
import { openResearcher } from "../agents/researcher.ts"

/**
 * One ResearchBlock is a lifecycle boundary, not a scientific procedure.
 *
 * The real implementation owns:
 * - Block / AgentRun identity
 * - configuration snapshot
 * - fresh Researcher Pi conversation
 * - approved tool surface
 * - approximate 10-minute production deadline
 * - explicit Pi abort on timeout
 * - ExecutionEnv shutdown/cleanup
 * - terminal block status
 * - ResearchDossier persistence
 *
 * No subagents.
 *
 * Timeout must explicitly abort Pi work. Timing out only an Effect wait is not
 * sufficient if Pi continues the underlying durable task.
 */
export const runResearchBlock = (objective: ResearchObjective) =>
  Effect.gen(function* () {
    const runtime = yield* AgentRuntime
    const conversationId = yield* openResearcher(objective)

    yield* Effect.log(`Opened fresh Researcher conversation ${conversationId}`)

    return {
      objectiveId: objective.objectiveId,
      conversationId,
      abort: runtime.abort(conversationId),
    } as const
  })
