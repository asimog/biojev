import { Effect, Result } from "effect"
import { BioLab } from "../biolab/BioLab.ts"
import type {
  DiscoveredCandidate,
  GenesisDiscovery,
  GenesisSnapshot,
} from "../biolab/model/Genesis.ts"
import type { Mission } from "../biolab/model/Mission.ts"
import { JevEngine, type SemanticQuestion } from "../jevengine/JevEngine.ts"

export type GenesisMap = Pick<
  GenesisSnapshot,
  | "programId"
  | "programVersion"
  | "configuredInputIds"
  | "outcomes"
  | "sourceIds"
  | "capabilityIds"
  | "semanticMeasurementIds"
>

/** Sufficiency describes retained availability, never scientific importance. */
export const genesisMapSufficient = (map: GenesisMap): boolean =>
  map.configuredInputIds.length > 0 &&
  new Set(map.configuredInputIds).size === map.configuredInputIds.length &&
  map.configuredInputIds.length === map.outcomes.length &&
  map.configuredInputIds.every((id) =>
    map.outcomes.some((outcome) => outcome.inputId === id),
  ) &&
  map.outcomes.length > 0 &&
  new Set(map.outcomes.map((outcome) => outcome.inputId)).size ===
    map.outcomes.length &&
  map.outcomes.every(
    (outcome) =>
      (outcome.snapshotRef !== null && outcome.failure === null) ||
      (outcome.snapshotRef === null && outcome.failure !== null),
  ) &&
  map.sourceIds.length + map.capabilityIds.length > 0 &&
  map.semanticMeasurementIds.length > 0

export const discoverGenesis = Effect.fn("Core.discoverGenesis")(function* <
  E,
  R,
>(
  missionId: string,
  discover: (
    mission: Mission,
  ) => Effect.Effect<
    Omit<GenesisDiscovery, "missionId" | "missionRevision" | "measurements">,
    E,
    R
  >,
  question: (
    mission: Mission,
    candidates: ReadonlyArray<DiscoveredCandidate>,
  ) => SemanticQuestion,
) {
  const lab = yield* BioLab
  const jev = yield* JevEngine
  const mission = yield* lab.getMission(missionId)
  const map = yield* discover(mission)
  if (map.candidates.length === 0)
    return yield* lab.recordGenesisDiscovery({
      ...map,
      missionId,
      missionRevision: mission.revision,
      measurements: [],
    })
  yield* lab.recordGenesisDiscovery(
    { ...map, missionId, missionRevision: mission.revision, measurements: [] },
    "DISCOVERING",
  )
  const measured = yield* jev
    .measure({
      ...question(mission, map.candidates),
      originRunId: `${missionId}:genesis`,
    })
    .pipe(Effect.result)
  return yield* lab.recordGenesisDiscovery({
    ...map,
    missionId,
    missionRevision: mission.revision,
    measurements: Result.isSuccess(measured) ? [measured.success] : [],
    configuredInputIds: Result.isSuccess(measured)
      ? map.configuredInputIds
      : [...map.configuredInputIds, `${map.programId}:semantic-discovery`],
    outcomes: Result.isSuccess(measured)
      ? map.outcomes
      : [
          ...map.outcomes,
          {
            inputId: `${map.programId}:semantic-discovery`,
            snapshotRef: null,
            failure: measured.failure.message,
          },
        ],
  })
})
