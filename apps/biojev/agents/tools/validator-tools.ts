import { Effect } from "effect"
import { BioLab } from "../../biolab/BioLab.ts"
import { ExecutionEnv } from "../../execution-env/ExecutionEnv.ts"
import { JevEngine } from "../../jevengine/JevEngine.ts"

/**
 * Validator can independently inspect and reproduce work, but cannot redirect
 * the institution or activate capabilities.
 */
export const validatorTools = Effect.gen(function* () {
  const lab = yield* BioLab
  const execution = yield* ExecutionEnv
  const jev = yield* JevEngine

  return {
    searchMemory: lab.searchMemory,
    inspect: lab.inspect,
    searchCapabilities: lab.searchCapabilities,
    recordCapabilityAssessment: lab.recordCapabilityAssessment,
    recordScientificResult: lab.recordScientificResult,
    recordResultAssessment: lab.recordResultAssessment,
    readText: execution.readText,
    writeText: execution.writeText,
    editText: execution.editText,
    run: execution.run,
    request: execution.request,
    jevMeasure: jev.measure,
    jevCompare: jev.compare,
    jevClassify: jev.classify,
    jevScore: jev.score,
  } as const
})
