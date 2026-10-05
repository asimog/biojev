import { Schema } from "effect"
import { SemanticMeasurement } from "../../jevengine/JevEngine.ts"
import {
  CanonicalRef,
  CapabilityAssessment,
  CapabilityVersion,
} from "./Domain.ts"

export { CapabilityAssessment, CapabilityVersion } from "./Domain.ts"
export const CapabilitySelection = Schema.Struct({
  selectionId: Schema.NonEmptyString,
  capabilityId: Schema.NonEmptyString,
  versionRef: Schema.NullOr(CanonicalRef),
  reason: Schema.NonEmptyString,
  originRunId: Schema.NonEmptyString,
})
export type CapabilitySelection = typeof CapabilitySelection.Type

export const LearningRecord = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("SemanticMeasurement"),
    value: SemanticMeasurement,
  }),
  Schema.Struct({
    kind: Schema.Literal("CapabilityVersion"),
    value: CapabilityVersion,
  }),
  Schema.Struct({
    kind: Schema.Literal("CapabilityAssessment"),
    value: CapabilityAssessment,
  }),
  Schema.Struct({
    kind: Schema.Literal("CapabilitySelection"),
    value: CapabilitySelection,
  }),
])
export type LearningRecord = typeof LearningRecord.Type
