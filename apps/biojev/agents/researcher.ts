import { Effect } from "effect"
import { AgentRuntime } from "../agent-runtime/AgentRuntime.ts"
import type { ResearchObjective } from "./contracts.ts"

/**
 * Researcher owns local scientific cognition for one ResearchBlock.
 *
 * Every new ResearchBlock gets a fresh Pi conversation. Long-term learning
 * comes through BioLab. No subagents are used.
 */
export const openResearcher = (_objective: ResearchObjective) =>
  Effect.gen(function* () {
    const runtime = yield* AgentRuntime
    return yield* runtime.openFresh({
      role: "researcher",
      instructions:
        "You are a fresh BioJev Researcher. Decide how to investigate the assigned objective. Use BioLab memory, ExecutionEnv, public sources, capabilities, and Jev as useful. There is no prescribed scientific sequence.",
    })
  })
