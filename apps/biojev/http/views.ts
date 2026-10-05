import { Schema } from "effect"
import { GenesisSnapshot } from "../biolab/model/Genesis.ts"
import { ResearchBlock, ValidationCycle } from "../biolab/model/Lifecycle.ts"
import { Mission } from "../biolab/model/Mission.ts"

export const SchedulerView = Schema.Struct({
  enabled: Schema.Boolean,
  activeMissionId: Schema.NullOr(Schema.String),
  failures: Schema.Record(Schema.String, Schema.String),
})
export const MissionListView = Schema.Struct({
  missions: Schema.Array(Mission),
  scheduler: SchedulerView,
})
export const MissionSnapshotView = Schema.Struct({
  lifecycle: Schema.Struct({
    mission: Mission,
    genesisComplete: Schema.Boolean,
    recoveryRequired: Schema.Boolean,
    validationDue: Schema.Boolean,
    validationCompletedAwaitingDirectorReview: Schema.Boolean,
    directorRequired: Schema.Boolean,
    objectiveReady: Schema.Boolean,
    objectiveId: Schema.optionalKey(Schema.String),
    validation: Schema.optionalKey(ValidationCycle),
    countableBlocks: Schema.Int,
  }),
  genesis: Schema.NullOr(GenesisSnapshot),
  blocks: Schema.Array(ResearchBlock),
  activity: Schema.Array(
    Schema.Struct({
      runId: Schema.String,
      role: Schema.String,
      state: Schema.String,
      runtimeAvailable: Schema.Boolean,
      requestedModel: Schema.optionalKey(
        Schema.Struct({ provider: Schema.String, modelId: Schema.String }),
      ),
      actualModel: Schema.optionalKey(
        Schema.NullOr(
          Schema.Struct({ provider: Schema.String, modelId: Schema.String }),
        ),
      ),
      recentTools: Schema.optionalKey(
        Schema.Array(
          Schema.Struct({
            id: Schema.String,
            name: Schema.String,
            status: Schema.String,
            output: Schema.String,
          }),
        ),
      ),
      startedAt: Schema.optionalKey(Schema.Finite),
      blockId: Schema.optionalKey(Schema.NullOr(Schema.String)),
      modelActive: Schema.optionalKey(Schema.Boolean),
      tools: Schema.optionalKey(
        Schema.Array(
          Schema.Struct({
            id: Schema.String,
            name: Schema.String,
            status: Schema.String,
            command: Schema.optionalKey(Schema.NullOr(Schema.String)),
            output: Schema.NullOr(Schema.String),
          }),
        ),
      ),
      usage: Schema.optionalKey(Schema.NullOr(Schema.JsonObject)),
    }),
  ),
  scheduler: SchedulerView,
})
export type MissionSnapshotView = typeof MissionSnapshotView.Type
export const HistoryView = Schema.Struct({
  records: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      missionId: Schema.String,
      originRunId: Schema.String,
      createdAt: Schema.Finite,
      record: Schema.Struct({ kind: Schema.String, value: Schema.JsonObject }),
    }),
  ),
  next: Schema.NullOr(Schema.Int),
  cursor: Schema.Int,
})
export type HistoryView = typeof HistoryView.Type
