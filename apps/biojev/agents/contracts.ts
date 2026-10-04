import { Schema } from "effect"
import { CanonicalRef } from "../biolab/model/Domain.ts"

export type { CanonicalRef as CanonicalRefType } from "../biolab/model/Domain.ts"
export { CanonicalRef }

export const DirectorInput = Schema.Struct({
  missionRevisionRef: CanonicalRef,
  previousDirectorDecisionRef: Schema.optional(CanonicalRef),
  latestResearchDossierRef: Schema.optional(CanonicalRef),
  pendingValidationReportRef: Schema.optional(CanonicalRef),
  newCanonicalRefs: Schema.Array(CanonicalRef),
  activeConstraints: Schema.Array(Schema.String),
  configurationSnapshotRef: CanonicalRef,
})
export type DirectorInput = typeof DirectorInput.Type

export const ResearchObjective = Schema.Struct({
  objectiveId: Schema.String,
  missionId: Schema.String,
  originDirectorDecisionId: Schema.String,
  statement: Schema.String,
  whyNow: Schema.String,
  relevantRefs: Schema.Array(CanonicalRef),
  knownUncertainties: Schema.Array(Schema.String),
  knownFailures: Schema.Array(Schema.String),
  suggestedDirections: Schema.Array(Schema.String),
  constraints: Schema.Array(Schema.String),
})
export type ResearchObjective = typeof ResearchObjective.Type

export const DirectorDecision = Schema.Struct({
  decisionId: Schema.String,
  missionId: Schema.String,
  basisRefs: Schema.Array(CanonicalRef),
  strategicSummary: Schema.String,
  importantChanges: Schema.Array(Schema.String),
  importantUncertainties: Schema.Array(Schema.String),
  hypothesisActions: Schema.Array(Schema.String),
  capabilityActions: Schema.Array(Schema.String),
  nextObjective: ResearchObjective,
  basisValidationReportId: Schema.optional(Schema.String),
})
export type DirectorDecision = typeof DirectorDecision.Type

export const ResearchDossier = Schema.Struct({
  dossierId: Schema.String,
  blockId: Schema.String,
  objectiveId: Schema.String,
  summary: Schema.String,
  scientificResultRefs: Schema.Array(CanonicalRef),
  resultAssessmentRefs: Schema.Array(CanonicalRef),
  interpretationRefs: Schema.Array(CanonicalRef),
  hypothesisRefs: Schema.Array(CanonicalRef),
  hypothesisChanges: Schema.Array(Schema.String),
  semanticMeasurementRefs: Schema.Array(CanonicalRef),
  capabilityRefs: Schema.Array(CanonicalRef),
  capabilityChanges: Schema.Array(Schema.String),
  failureRefs: Schema.Array(CanonicalRef),
  uncertainties: Schema.Array(Schema.String),
  contradictions: Schema.Array(Schema.String),
  openQuestions: Schema.Array(Schema.String),
  suggestedNextDirections: Schema.Array(Schema.String),
})
export type ResearchDossier = typeof ResearchDossier.Type

export const ValidationReport = Schema.Struct({
  reportId: Schema.String,
  cycleId: Schema.String,
  blockRefs: Schema.Array(CanonicalRef),
  summary: Schema.String,
  resultFindings: Schema.Array(Schema.String),
  reproductionFindings: Schema.Array(Schema.String),
  methodologicalConcerns: Schema.Array(Schema.String),
  missedOpportunities: Schema.Array(Schema.String),
  hypothesisFindings: Schema.Array(Schema.String),
  capabilityFindings: Schema.Array(Schema.String),
  memoryFindings: Schema.Array(Schema.String),
  jevFindings: Schema.Array(Schema.String),
  recommendations: Schema.Array(Schema.String),
  importantRefs: Schema.Array(CanonicalRef),
})
export type ValidationReport = typeof ValidationReport.Type
