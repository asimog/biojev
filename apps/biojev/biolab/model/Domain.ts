import { Schema } from "effect"

export const CanonicalRef = Schema.Struct({
  kind: Schema.String,
  id: Schema.String,
})
export type CanonicalRef = typeof CanonicalRef.Type

export const ScientificResult = Schema.Struct({
  resultId: Schema.String,
  originRunId: Schema.String,
  originBlockId: Schema.optional(Schema.String),
  executionReceiptId: Schema.optional(Schema.String),
  sourceRef: Schema.optional(Schema.String),
  capabilityVersionId: Schema.optional(Schema.String),
  inputRefs: Schema.Array(CanonicalRef),
  outputRefs: Schema.Array(CanonicalRef),
  summary: Schema.String,
  missingness: Schema.Array(Schema.String),
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
  recommendedFollowUp: Schema.optional(Schema.String),
  originRunId: Schema.String,
})
export type ResultAssessment = typeof ResultAssessment.Type

export const CapabilityVersion = Schema.Struct({
  capabilityId: Schema.String,
  versionId: Schema.String,
  name: Schema.String,
  description: Schema.String,
  executionDescriptor: Schema.Unknown,
  qualificationSummary: Schema.optional(Schema.String),
  status: Schema.Literals(["EXPERIMENTAL", "QUALIFIED", "ACTIVE", "RETIRED"]),
})
export type CapabilityVersion = typeof CapabilityVersion.Type

export const CapabilityAssessment = Schema.Struct({
  assessmentId: Schema.String,
  capabilityId: Schema.String,
  versionId: Schema.String,
  actorRole: Schema.Literals(["director", "researcher", "validator"]),
  summary: Schema.String,
  strengths: Schema.Array(Schema.String),
  concerns: Schema.Array(Schema.String),
  basisRefs: Schema.Array(CanonicalRef),
  originRunId: Schema.String,
})
export type CapabilityAssessment = typeof CapabilityAssessment.Type
