import { Effect } from "effect"
import { BioLab } from "../../biolab/BioLab.ts"
import { ExecutionEnv } from "../../execution-env/ExecutionEnv.ts"
import { JevEngine } from "../../jevengine/JevEngine.ts"

/**
 * Researcher owns local scientific method.
 *
 * It can search memory, use/expand capabilities, execute real work, use Jev,
 * and write scientific records through BioLab. It cannot activate global
 * capability defaults or change mission strategy.
 */
export const researcherTools = Effect.gen(function* () {
  const lab = yield* BioLab
  const execution = yield* ExecutionEnv
  const jev = yield* JevEngine

  return {
    searchMemory: lab.searchMemory,
    inspect: lab.inspect,
    searchCapabilities: lab.searchCapabilities,
    registerCapabilityVersion: lab.registerCapabilityVersion,
    recordCapabilityAssessment: lab.recordCapabilityAssessment,
    recordScientificResult: lab.recordScientificResult,
    recordInterpretation: lab.recordInterpretation,
    recordResultAssessment: lab.recordResultAssessment,
    reviseHypothesis: lab.reviseHypothesis,
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
