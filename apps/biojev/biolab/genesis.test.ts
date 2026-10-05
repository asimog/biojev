import { NodeServices } from "@effect/platform-node"
import { assert, it } from "@effect/vitest"
import { Effect, FileSystem, Path } from "effect"
import { discoverGenesis } from "../core/genesis.ts"
import { nextAction } from "../core/next-action.ts"
import { JevEngine, JevEngineError } from "../jevengine/JevEngine.ts"
import { decision, discoveredMap } from "../test/fixtures.ts"
import { BioLab } from "./BioLab.ts"
import { BioLabLive } from "./SqliteLive.ts"

it.effect(
  "requires a sufficient durable Genesis map and inaugural handoff; partial discovery retains low-score candidates across reopen",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const database = path.join(
        yield* fs.makeTempDirectoryScoped(),
        "lab.sqlite",
      )
      yield* Effect.scoped(
        Effect.gen(function* () {
          const lab = yield* BioLab
          yield* lab.createMission({
            missionId: "mission",
            statement: "An open computational mission",
          })
          const initial = yield* lab.getLifecycle("mission")
          assert.equal(
            nextAction({ ...initial, paused: false, stopped: false }),
            "RUN_GENESIS",
          )
          assert.equal(initial.countableBlocks, 0)
          const premature = yield* lab.beginRun({
            runId: "premature-researcher",
            missionId: "mission",
            role: "researcher",
            blockId: "premature-block",
            conversationId: "premature-conversation",
            environmentId: "premature-environment",
          })
          const blocked = yield* lab
            .startResearchBlock(
              premature.actor,
              "unretained-objective",
              Number.MAX_SAFE_INTEGER,
            )
            .pipe(Effect.flip)
          assert.equal(blocked.code, "CONFLICT")
          yield* lab.settleRun("premature-researcher")
          assert.lengthOf(yield* lab.getResearchBlocks("mission"), 0)
          const actor = yield* lab.beginRun({
            runId: "director",
            missionId: "mission",
            role: "director",
            conversationId: "director",
            environmentId: "director-env",
          })
          const denied = yield* lab
            .recordDirectorDecision(actor.actor, decision("first", "mission"))
            .pipe(Effect.flip)
          assert.equal(denied.code, "CONFLICT")
          const failed = yield* lab.recordGenesisDiscovery({
            ...discoveredMap("mission"),
            candidates: [],
            measurements: [],
          })
          assert.equal(failed.status, "FAILED")
          const generic = discoveredMap("mission")
          const incomplete = yield* lab.recordGenesisDiscovery({
            ...generic,
            configuredInputIds: [
              ...generic.configuredInputIds,
              "unreported-input",
            ],
          })
          assert.equal(incomplete.status, "FAILED")
          const snapshot = yield* lab.recordGenesisDiscovery({
            ...generic,
            programId: "replacement-discovery",
            configuredInputIds: [
              ...generic.configuredInputIds,
              "another-catalog",
            ],
            outcomes: [
              ...generic.outcomes,
              {
                inputId: "another-catalog",
                snapshotRef: null,
                failure: "Catalog unavailable",
              },
            ],
          })
          assert.equal(snapshot.status, "READY_FOR_DIRECTION")
          assert.equal(snapshot.inauguralDirectorDecisionId, null)
          assert.equal(snapshot.initialResearchObjectiveId, null)
          assert.equal(snapshot.outcomes[1].failure, "Catalog unavailable")
          assert.lengthOf(yield* lab.searchDiscovery("mission", "Public"), 1)
          assert.equal(generic.measurements[0].answer.noul, 0.01)
          assert.isFalse((yield* lab.getLifecycle("mission")).genesisComplete)
          const wrongKind = yield* lab
            .recordDirectorDecision(actor.actor, {
              ...decision("wrong-kind", "mission"),
              basisRefs: [{ kind: "DiscoveredCapability", id: "candidate-1" }],
            })
            .pipe(Effect.flip)
          assert.equal(wrongKind.code, "INVALID_INPUT")
          yield* lab.recordDirectorDecision(actor.actor, {
            ...decision("first", "mission"),
            basisRefs: [
              { kind: "DiscoveredSource", id: "candidate-1" },
              { kind: "SemanticMeasurement", id: "measurement-1" },
            ],
          })
          yield* lab.settleRun("director")
          const complete = yield* lab.getGenesis("mission")
          assert.equal(complete?.status, "COMPLETED")
          assert.equal(complete?.inauguralDirectorDecisionId, "first")
          assert.equal(complete?.initialResearchObjectiveId, "first-objective")
          assert.equal((yield* lab.getLifecycle("mission")).countableBlocks, 0)
          const reset = yield* lab
            .recordGenesisDiscovery(generic)
            .pipe(Effect.flip)
          assert.equal(reset.code, "CONFLICT")
          yield* lab.refreshDiscovery({
            ...generic,
            programId: "later-refresh",
            candidates: generic.candidates.map((candidate) => ({
              ...candidate,
              id: "refreshed-candidate",
              externalId: "new-external",
            })),
            measurements: [],
          })
          assert.deepEqual(yield* lab.getGenesis("mission"), complete)
          assert.lengthOf(yield* lab.searchDiscovery("mission", ""), 2)
          assert.equal((yield* lab.getLifecycle("mission")).countableBlocks, 0)
        }).pipe(Effect.provide(BioLabLive(database))),
      )
      yield* Effect.scoped(
        Effect.gen(function* () {
          const lab = yield* BioLab
          const state = yield* lab.getLifecycle("mission")
          assert.equal(
            nextAction({ ...state, stopped: false, paused: false }),
            "RUN_RESEARCHER",
          )
          assert.lengthOf(yield* lab.searchDiscovery("mission", ""), 2)
          assert.equal(
            (yield* lab.getGenesis("mission"))?.programId,
            "replacement-discovery",
          )
        }).pipe(Effect.provide(BioLabLive(database))),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
)

it.effect(
  "calls Jev through the replaceable discovery program and records semantic outage without discarding discoveries",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const database = path.join(
        yield* fs.makeTempDirectoryScoped(),
        "lab.sqlite",
      )
      yield* Effect.scoped(
        Effect.gen(function* () {
          const lab = yield* BioLab
          yield* lab.createMission({
            missionId: "mission",
            statement: "An open question",
          })
          const map = discoveredMap("mission")
          const run = discoverGenesis(
            "mission",
            () =>
              Effect.succeed({
                programId: map.programId,
                programVersion: map.programVersion,
                candidates: map.candidates,
                configuredInputIds: map.configuredInputIds,
                outcomes: map.outcomes,
              }),
            () => ({
              questionId: map.measurements[0].questionId,
              questionVersion: "1",
              originRunId: "mission:genesis",
              subjectRefs: map.measurements[0].subjectRefs,
              projection: map.measurements[0].projection,
              question: map.measurements[0].question,
            }),
          )
          const failed = yield* run.pipe(
            Effect.provideService(JevEngine, {
              measure: () =>
                Effect.fail(
                  new JevEngineError({
                    message: "Semantic provider unavailable",
                  }),
                ),
            }),
          )
          assert.equal(failed.status, "FAILED")
          assert.equal(
            failed.outcomes.at(-1)?.failure,
            "Semantic provider unavailable",
          )
          assert.lengthOf(yield* lab.searchDiscovery("mission", ""), 1)
          const ready = yield* run.pipe(
            Effect.provideService(JevEngine, {
              measure: () => Effect.succeed(map.measurements[0]),
            }),
          )
          assert.equal(ready.status, "READY_FOR_DIRECTION")
          assert.lengthOf(yield* lab.searchDiscovery("mission", ""), 1)
        }).pipe(Effect.provide(BioLabLive(database))),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
)
