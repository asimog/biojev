import { NodeServices } from "@effect/platform-node"
import { assert, it } from "@effect/vitest"
import { Effect, FileSystem, Path } from "effect"
import { BioLab } from "../biolab/BioLab.ts"
import { BioLabLive } from "../biolab/SqliteLive.ts"
import { JevEngine } from "../jevengine/JevEngine.ts"
import { discoveredMap } from "../test/fixtures.ts"
import { catalogGenesis } from "./genesis.ts"

it.effect(
  "retains missing/invalid catalog failures and accepts a replacement source-agnostic program without dropping low-relevance candidates",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fs.makeTempDirectoryScoped()
      const filename = path.join(directory, "discovery.json")
      let measurements = 0
      const template = discoveredMap("mission")
      yield* Effect.gen(function* () {
        const lab = yield* BioLab
        yield* lab.createMission({
          missionId: "mission",
          statement: "Investigate an arbitrary computational source",
        })
        const missing = yield* catalogGenesis(filename)("mission")
        assert.equal(missing.status, "FAILED")
        assert.isNotNull(missing.outcomes[0].failure)
        assert.equal(measurements, 0)
        yield* fs.writeFileString(filename, "invalid JSON")
        assert.equal(
          (yield* catalogGenesis(filename)("mission")).status,
          "FAILED",
        )
        assert.equal(measurements, 0)
        yield* fs.writeFileString(
          filename,
          JSON.stringify({
            ...template,
            programId: "replacement-discovery",
            programVersion: "2",
          }),
        )
        const ready = yield* catalogGenesis(filename)("mission")
        assert.equal(ready.status, "READY_FOR_DIRECTION")
        assert.equal(ready.programId, "replacement-discovery")
        assert.equal(measurements, 1)
        assert.lengthOf(yield* lab.searchDiscovery("mission", ""), 1)
        assert.equal((yield* lab.getLifecycle("mission")).countableBlocks, 0)
        assert.isFalse((yield* lab.getLifecycle("mission")).genesisComplete)
      }).pipe(
        Effect.provide(BioLabLive(path.join(directory, "biojev.sqlite"))),
        Effect.provideService(JevEngine, {
          measure: (question) =>
            Effect.sync(() => {
              measurements++
              return {
                ...template.measurements[0],
                ...question,
                primitive: "noul" as const,
              }
            }),
        }),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
)
