import { Effect } from "effect"
import { AgentRuntime } from "../agent-runtime/AgentRuntime.ts"
import type { DirectorInput } from "./contracts.ts"

/**
 * Director is BioJev's persistent strategic intelligence.
 *
 * Director decides WHAT to investigate next.
 *
 * Each invocation should follow:
 * Observe -> Retrieve -> Assess -> Learn -> Decide.
 *
 * Director learns from BioLab across blocks. It can assess ScientificResults,
 * revise hypotheses, assess capability performance, register/activate justified
 * capability versions, respond to Validator criticism, and create the next
 * ResearchObjective.
 *
 * BioLab is authoritative memory. The Director's persistent Pi conversation is
 * helpful continuity, not the sole learning store.
 */
export const openDirector = (input: DirectorInput) =>
  Effect.gen(function* () {
    const runtime = yield* AgentRuntime
    return yield* runtime.openPersistent({
      role: "director",
      persistentKey: `mission:${input.missionRevisionRef.id}`,
      instructions:
        "You are BioJev Director. Choose the most valuable next investigation. Learn autonomously from BioLab, assess results and capabilities, respond to Validator findings, and update institutional understanding. Do not prescribe a fixed scientific workflow.",
    })
  })
