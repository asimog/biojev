import { Effect, FileSystem, Schema } from "effect"
import { BioLabError } from "../biolab/BioLab.ts"
import { GenesisDiscovery } from "../biolab/model/Genesis.ts"
import { discoverGenesis } from "../core/genesis.ts"

// Trusted deployment input; records describe possibilities, never installed abilities.
export const GenesisCatalog = Schema.Struct({
  programId: GenesisDiscovery.fields.programId,
  programVersion: GenesisDiscovery.fields.programVersion,
  configuredInputIds: GenesisDiscovery.fields.configuredInputIds,
  outcomes: GenesisDiscovery.fields.outcomes,
  candidates: GenesisDiscovery.fields.candidates,
})

export const catalogGenesis = (filename: string) =>
  Effect.fn("Platform.catalogGenesis")(function* (missionId: string) {
    return yield* discoverGenesis(
      missionId,
      Effect.fn(
        function* () {
          const fs = yield* FileSystem.FileSystem
          const text = yield* fs.readFileString(filename)
          return yield* Schema.decodeEffect(
            Schema.fromJsonString(GenesisCatalog),
          )(text)
        },
        (program) =>
          program.pipe(
            Effect.orElseSucceed(() => ({
              programId: "deployment-catalog",
              programVersion: "1",
              configuredInputIds: ["deployment-catalog"],
              outcomes: [
                {
                  inputId: "deployment-catalog",
                  snapshotRef: null,
                  failure:
                    "Configured discovery input could not be read or validated",
                },
              ],
              candidates: [],
            })),
          ),
      ),
      (mission, candidates) => ({
        questionId: "genesis-mission-relevance",
        questionVersion: "1",
        originRunId: `${missionId}:genesis`,
        subjectRefs: candidates.map((candidate) => ({
          kind:
            candidate.kind === "source"
              ? "DiscoveredSource"
              : "DiscoveredCapability",
          id: candidate.id,
        })),
        projection: {
          identity: "genesis-landscape",
          version: "1",
          value: { mission: mission.statement, candidates },
        },
        question: {
          type: "noul",
          instructions:
            "Does this retained scientific landscape contain possibilities relevant to the mission? Measure semantic relevance; do not choose an objective or discard candidates.",
        },
      }),
    ).pipe(
      Effect.mapError(
        (cause) =>
          new BioLabError({
            code: "STORAGE",
            operation: "catalogGenesis",
            message: "Genesis catalog or semantic discovery is unavailable",
            cause,
          }),
      ),
    )
  })
