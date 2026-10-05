import { Schema } from "effect"

export const MissionId = Schema.NonEmptyString.check(
  Schema.isMaxLength(128),
  Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
)
export const MissionStatement = Schema.NonEmptyString.check(
  Schema.isMaxLength(100_000),
)

export const CreateMission = Schema.Struct({
  missionId: MissionId,
  statement: MissionStatement,
})
export type CreateMission = typeof CreateMission.Type

export const Mission = Schema.Struct({
  missionId: MissionId,
  revision: Schema.Int,
  statement: MissionStatement,
  status: Schema.Literals(["RUNNING", "PAUSED", "STOPPED"]),
  createdAt: Schema.Finite,
  updatedAt: Schema.Finite,
})
export type Mission = typeof Mission.Type

export const MissionRevision = Schema.Struct({
  missionId: MissionId,
  revision: Schema.Int,
  statement: MissionStatement,
  createdAt: Schema.Finite,
})
export type MissionRevision = typeof MissionRevision.Type

export const ReviseMission = Schema.Struct({
  missionId: MissionId,
  expectedRevision: Schema.Int,
  statement: MissionStatement,
})
export type ReviseMission = typeof ReviseMission.Type
