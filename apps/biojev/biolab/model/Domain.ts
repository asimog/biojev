import { Schema } from "effect"

export const CanonicalRef = Schema.Struct({
  kind: Schema.String,
  id: Schema.String,
})
export type CanonicalRef = typeof CanonicalRef.Type

export const ScientificResult = Schema.Struct({
  resultId: Schema.String,
  originRunId: Schema.String,
  originBlockId: Schema.optionalKey(Schema.String),
  executionReceiptId: Schema.NonEmptyString,
  sourceRef: Schema.optionalKey(Schema.String),
  capabilityVersionId: Schema.optionalKey(Schema.String),
  inputRefs: Schema.Array(CanonicalRef),
  outputRefs: Schema.Array(CanonicalRef),
  summary: Schema.String,
  missingness: Schema.Array(Schema.String),
  value: Schema.optionalKey(Schema.Json),
})
export type ScientificResult = typeof ScientificResult.Type

export const Interpretation = Schema.Struct({
  interpretationId: Schema.String,
  statement: Schema.String,
  basisRefs: Schema.Array(CanonicalRef),
  actorRole: Schema.Literals(["director", "researcher", "validator"]),
  originRunId: Schema.String,
})
export type Interpretation = typeof Interpretation.Type

export const HypothesisRevision = Schema.Struct({
  revisionId: Schema.String,
  hypothesisId: Schema.String,
  statement: Schema.String,
  status: Schema.Literals([
    "ACTIVE",
    "WEAKENED",
    "CONTRADICTED",
    "DEFERRED",
    "REQUIRES_REPLICATION",
  ]),
  basisRefs: Schema.Array(CanonicalRef),
  assessmentSummary: Schema.String,
  originRunId: Schema.String,
})
export type HypothesisRevision = typeof HypothesisRevision.Type

export const ResultAssessment = Schema.Struct({
  assessmentId: Schema.String,
  resultRef: CanonicalRef,
  actorRole: Schema.Literals(["director", "researcher", "validator"]),
  summary: Schema.String,
  strengths: Schema.Array(Schema.String),
  concerns: Schema.Array(Schema.String),
  relatedRefs: Schema.Array(CanonicalRef),
  recommendedFollowUp: Schema.optionalKey(Schema.String),
  originRunId: Schema.String,
})
export type ResultAssessment = typeof ResultAssessment.Type

export const CapabilityVersion = Schema.Struct({
  capabilityId: Schema.NonEmptyString,
  versionId: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  description: Schema.NonEmptyString,
  executionDescriptor: Schema.JsonObject,
  artifactRefs: Schema.Array(CanonicalRef).check(Schema.isMinLength(1)),
  qualificationResultRefs: Schema.Array(CanonicalRef),
  status: Schema.Literals(["EXPERIMENTAL", "QUALIFIED"]),
  originRunId: Schema.NonEmptyString,
})
export type CapabilityVersion = typeof CapabilityVersion.Type

export const CapabilityAssessment = Schema.Struct({
  assessmentId: Schema.NonEmptyString,
  versionRef: CanonicalRef,
  summary: Schema.NonEmptyString,
  strengths: Schema.Array(Schema.String),
  concerns: Schema.Array(Schema.String),
  basisRefs: Schema.Array(CanonicalRef),
  actorRole: Schema.Literals(["director", "researcher", "validator"]),
  originRunId: Schema.NonEmptyString,
})
export type CapabilityAssessment = typeof CapabilityAssessment.Type

export const Failure = Schema.Struct({
  failureId: Schema.NonEmptyString,
  originRunId: Schema.NonEmptyString,
  summary: Schema.NonEmptyString,
  basisRefs: Schema.Array(CanonicalRef),
})
export type Failure = typeof Failure.Type

export const Uncertainty = Schema.Struct({
  uncertaintyId: Schema.NonEmptyString,
  originRunId: Schema.NonEmptyString,
  question: Schema.NonEmptyString,
  basisRefs: Schema.Array(CanonicalRef),
})
export type Uncertainty = typeof Uncertainty.Type
