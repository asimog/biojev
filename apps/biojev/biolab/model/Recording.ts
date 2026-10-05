import { Schema } from "effect"
import {
  DirectorDecision,
  ResearchDossier,
  ResearchObjective,
  ValidationReport,
} from "../../agents/contracts.ts"
import {
  Failure,
  HypothesisRevision,
  Interpretation,
  ResultAssessment,
  ScientificResult,
  Uncertainty,
} from "./Domain.ts"
import { LearningRecord } from "./Learning.ts"

export const BeginRun = Schema.Struct({
  runId: Schema.NonEmptyString,
  missionId: Schema.NonEmptyString,
  role: Schema.Literals(["director", "researcher", "validator"]),
  conversationId: Schema.NonEmptyString,
  environmentId: Schema.NonEmptyString,
  blockId: Schema.optionalKey(Schema.NonEmptyString),
})
export type BeginRun = typeof BeginRun.Type

export const AgentRun = Schema.Struct({
  ...BeginRun.fields,
  // Older runs have no revision attribution and cannot author new objectives.
  missionRevision: Schema.optionalKey(
    Schema.Int.check(Schema.isGreaterThan(0)),
  ),
  status: Schema.Literals(["ACTIVE", "SETTLED"]),
  createdAt: Schema.Finite,
})
export type AgentRun = typeof AgentRun.Type

// Identity alone conveys no authority. BioLab checks these object capabilities.
export interface ActorAuthority {
  readonly runId: string
  readonly kind: "actor"
}
export interface ExecutionAuthority {
  readonly runId: string
  readonly kind: "execution"
}
export interface SemanticAuthority {
  readonly runId: string
  readonly kind: "semantic"
}

export const Operation = Schema.Struct({
  receiptId: Schema.NonEmptyString,
  environmentId: Schema.NonEmptyString,
  method: Schema.NonEmptyString,
  args: Schema.Array(Schema.Json),
  startedAt: Schema.Finite,
  endedAt: Schema.Finite,
  outcome: Schema.Literals(["SUCCEEDED", "FAILED", "INTERRUPTED"]),
  result: Schema.Json,
  output: Schema.String,
})
export type Operation = typeof Operation.Type

export const Artifact = Schema.Struct({
  artifactId: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  receiptId: Schema.NonEmptyString,
  bytes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
})
export type Artifact = typeof Artifact.Type

export const ScienceRecord = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("ScientificResult"),
    value: ScientificResult,
  }),
  Schema.Struct({
    kind: Schema.Literal("Interpretation"),
    value: Interpretation,
  }),
  Schema.Struct({
    kind: Schema.Literal("HypothesisRevision"),
    value: HypothesisRevision,
  }),
  Schema.Struct({
    kind: Schema.Literal("ResultAssessment"),
    value: ResultAssessment,
  }),
  Schema.Struct({ kind: Schema.Literal("Failure"), value: Failure }),
  Schema.Struct({ kind: Schema.Literal("Uncertainty"), value: Uncertainty }),
])
export type ScienceRecord = typeof ScienceRecord.Type

export const InstitutionalRecord = Schema.Union([
  ScienceRecord,
  LearningRecord,
  Schema.Struct({
    kind: Schema.Literal("DirectorDecision"),
    value: DirectorDecision,
  }),
  Schema.Struct({
    kind: Schema.Literal("ResearchObjective"),
    value: ResearchObjective,
  }),
  Schema.Struct({
    kind: Schema.Literal("ResearchDossier"),
    value: ResearchDossier,
  }),
  Schema.Struct({
    kind: Schema.Literal("ValidationReport"),
    value: ValidationReport,
  }),
])
export type InstitutionalRecord = typeof InstitutionalRecord.Type

export const RetainedRecord = Schema.Struct({
  id: Schema.NonEmptyString,
  missionId: Schema.NonEmptyString,
  originRunId: Schema.NonEmptyString,
  createdAt: Schema.Finite,
  record: InstitutionalRecord,
})
export type RetainedRecord = typeof RetainedRecord.Type
