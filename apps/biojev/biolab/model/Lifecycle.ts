import { Schema } from "effect"
import type { Mission } from "./Mission.ts"

export const ResearchBlock = Schema.Struct({
  blockId: Schema.NonEmptyString,
  missionId: Schema.NonEmptyString,
  objectiveId: Schema.NonEmptyString,
  runId: Schema.NonEmptyString,
  startedAt: Schema.Finite,
  deadline: Schema.Finite,
  finishedAt: Schema.optionalKey(Schema.Finite),
  status: Schema.Literals([
    "RUNNING",
    "RECOVERY_REQUIRED",
    "COMPLETED",
    "COMPLETED_NO_RESULTS",
    "FAILED",
    "TIMED_OUT",
    "CANCELLED",
  ]),
  classification: Schema.Literals(["PENDING", "COUNTABLE", "ORPHAN"]),
  dossierId: Schema.optionalKey(Schema.NonEmptyString),
  reason: Schema.optionalKey(Schema.String),
})
export type ResearchBlock = typeof ResearchBlock.Type

export const ValidationCycle = Schema.Struct({
  cycleId: Schema.NonEmptyString,
  missionId: Schema.NonEmptyString,
  blockIds: Schema.Array(Schema.NonEmptyString),
  status: Schema.Literals(["DUE", "RUNNING", "AWAITING_DIRECTOR", "REVIEWED"]),
  validationBlockId: Schema.optionalKey(Schema.NonEmptyString),
  runId: Schema.optionalKey(Schema.NonEmptyString),
  reportId: Schema.optionalKey(Schema.NonEmptyString),
  decisionId: Schema.optionalKey(Schema.NonEmptyString),
  createdAt: Schema.Finite,
})
export type ValidationCycle = typeof ValidationCycle.Type

export interface Lifecycle {
  readonly mission: Mission
  readonly recoveryRequired: boolean
  readonly validationDue: boolean
  readonly validationCompletedAwaitingDirectorReview: boolean
  readonly directorRequired: boolean
  readonly objectiveReady: boolean
  readonly objectiveId?: string
  readonly validation?: ValidationCycle
  readonly countableBlocks: number
}

export const FinishBlock = Schema.Struct({
  blockId: Schema.NonEmptyString,
  status: Schema.Literals([
    "COMPLETED",
    "COMPLETED_NO_RESULTS",
    "FAILED",
    "TIMED_OUT",
    "CANCELLED",
  ]),
  reason: Schema.optionalKey(Schema.String),
})
export type FinishBlock = typeof FinishBlock.Type
