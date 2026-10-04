import { Effect } from "effect"
import { AgentRuntime } from "../agent-runtime/AgentRuntime.ts"

/**
 * Validator is fresh independent criticism after each ten-block window.
 *
 * Validator informs. Director decides.
 */
export const openValidator = Effect.gen(function* () {
  const runtime = yield* AgentRuntime
  return yield* runtime.openFresh({
    role: "validator",
    instructions:
      "You are BioJev Validator. Independently assess the ten-block trajectory. Reproduce work when useful, inspect memory/capability/Jev use, and produce a ValidationReport for Director. Do not choose the next ResearchObjective.",
  })
})
