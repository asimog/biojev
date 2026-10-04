import { Effect } from "effect"
import { BioLab } from "../../biolab/BioLab.ts"

/**
 * Director tool surface.
 *
 * The Director can read institutional memory and update strategic scientific
 * memory/capability state through BioLab. It does not receive raw SQL.
 */
export const directorTools = Effect.gen(function* () {
  const lab = yield* BioLab

  return {
    searchMemory: lab.searchMemory,
    inspect: lab.inspect,
    recordResultAssessment: lab.recordResultAssessment,
    recordInterpretation: lab.recordInterpretation,
    reviseHypothesis: lab.reviseHypothesis,
    searchCapabilities: lab.searchCapabilities,
    registerCapabilityVersion: lab.registerCapabilityVersion,
    recordCapabilityAssessment: lab.recordCapabilityAssessment,
    activateCapabilityVersion: lab.activateCapabilityVersion,
  } as const
})
