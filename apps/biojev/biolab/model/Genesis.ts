import { Schema } from "effect"
import { SemanticMeasurement } from "../../jevengine/JevEngine.ts"

export const DiscoveredCandidate = Schema.Struct({
  id: Schema.NonEmptyString,
  kind: Schema.Literals(["source", "capability"]),
  externalId: Schema.NonEmptyString,
  description: Schema.NonEmptyString,
  metadata: Schema.JsonObject,
  snapshotRef: Schema.NonEmptyString,
  recordHash: Schema.NonEmptyString,
  normalizerVersion: Schema.NonEmptyString,
  retrievedAt: Schema.Finite,
})
export type DiscoveredCandidate = typeof DiscoveredCandidate.Type

export const GenesisDiscovery = Schema.Struct({
  missionId: Schema.NonEmptyString,
  missionRevision: Schema.Int.check(Schema.isGreaterThan(0)),
  programId: Schema.NonEmptyString,
  programVersion: Schema.NonEmptyString,
  configuredInputIds: Schema.Array(Schema.NonEmptyString),
  outcomes: Schema.Array(
    Schema.Struct({
      inputId: Schema.NonEmptyString,
      snapshotRef: Schema.NullOr(Schema.NonEmptyString),
      failure: Schema.NullOr(Schema.NonEmptyString),
    }),
  ),
  candidates: Schema.Array(DiscoveredCandidate),
  measurements: Schema.Array(SemanticMeasurement),
})
export type GenesisDiscovery = typeof GenesisDiscovery.Type

export const GenesisSnapshot = Schema.Struct({
  missionId: GenesisDiscovery.fields.missionId,
  missionRevision: GenesisDiscovery.fields.missionRevision,
  programId: GenesisDiscovery.fields.programId,
  programVersion: GenesisDiscovery.fields.programVersion,
  configuredInputIds: GenesisDiscovery.fields.configuredInputIds,
  outcomes: GenesisDiscovery.fields.outcomes,
  sourceIds: Schema.Array(Schema.NonEmptyString),
  capabilityIds: Schema.Array(Schema.NonEmptyString),
  semanticMeasurementIds: Schema.Array(Schema.NonEmptyString),
  normalizerVersions: Schema.Array(Schema.NonEmptyString),
  sourceRecordsImported: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  capabilityCandidatesImported: Schema.Int.check(
    Schema.isGreaterThanOrEqualTo(0),
  ),
  genesisId: Schema.NonEmptyString,
  startedAt: Schema.Finite,
  completedAt: Schema.NullOr(Schema.Finite),
  status: Schema.Literals([
    "NOT_STARTED",
    "DISCOVERING",
    "READY_FOR_DIRECTION",
    "DIRECTOR_RUNNING",
    "COMPLETED",
    "FAILED",
  ]),
  inauguralDirectorDecisionId: Schema.NullOr(Schema.NonEmptyString),
  initialResearchObjectiveId: Schema.NullOr(Schema.NonEmptyString),
})
export type GenesisSnapshot = typeof GenesisSnapshot.Type
