import { NodeServices } from "@effect/platform-node"
import { assert, it } from "@effect/vitest"
import { Effect, Exit, FileSystem, Path } from "effect"
import { BioLab } from "./BioLab.ts"
import { BioLabLive } from "./SqliteLive.ts"

it.effect(
  "retains immutable mission revisions and rejects conflicting writes",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const database = path.join(
        yield* fs.makeTempDirectoryScoped(),
        "biojev.sqlite",
      )
      const initial = {
        missionId: "mission-1",
        statement: "Investigate a computational question",
      }
      yield* Effect.scoped(
        Effect.gen(function* () {
          const lab = yield* BioLab
          const first = yield* lab.createMission(initial)
          assert.strictEqual(first.revision, 1)
          assert.strictEqual(first.status, "RUNNING")
          assert.deepStrictEqual(yield* lab.createMission(initial), first)
          const revised = yield* lab.reviseMission({
            missionId: first.missionId,
            expectedRevision: 1,
            statement: "Investigate another representation",
          })
          assert.strictEqual(revised.revision, 2)
          assert.deepStrictEqual(yield* lab.createMission(initial), revised)
          assert.deepStrictEqual(
            yield* lab.reviseMission({
              missionId: first.missionId,
              expectedRevision: 1,
              statement: revised.statement,
            }),
            revised,
          )
          const conflict = yield* Effect.exit(
            lab.reviseMission({
              missionId: first.missionId,
              expectedRevision: 1,
              statement: "A stale different request",
            }),
          )
          assert.isTrue(Exit.isFailure(conflict))
          const duplicate = yield* Effect.exit(
            lab.createMission({
              ...initial,
              statement: "Another initial mission",
            }),
          )
          assert.isTrue(Exit.isFailure(duplicate))
          const invalid = yield* Effect.exit(
            lab.createMission({ missionId: "", statement: "" }),
          )
          assert.isTrue(Exit.isFailure(invalid))
          assert.lengthOf(yield* lab.getMissionRevisions(first.missionId), 2)
        }).pipe(Effect.provide(BioLabLive(database))),
      )
      yield* Effect.scoped(
        Effect.gen(function* () {
          const lab = yield* BioLab
          const revisions = yield* lab.getMissionRevisions(initial.missionId)
          assert.deepStrictEqual(
            revisions.map((revision) => revision.statement),
            [initial.statement, "Investigate another representation"],
          )
          assert.strictEqual(
            (yield* lab.getMission(initial.missionId)).revision,
            2,
          )
          assert.lengthOf(yield* lab.listMissions, 1)
          assert.isTrue(
            Exit.isFailure(yield* Effect.exit(lab.getMission("missing"))),
          )
        }).pipe(Effect.provide(BioLabLive(database))),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
)

it.effect(
  "serializes concurrent mission revisions without partial history",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const database = path.join(
        yield* fs.makeTempDirectoryScoped(),
        "biojev.sqlite",
      )
      yield* Effect.gen(function* () {
        const lab = yield* BioLab
        yield* lab.createMission({
          missionId: "mission-1",
          statement: "Initial direction",
        })
        const attempts = yield* Effect.all(
          [
            Effect.exit(
              lab.reviseMission({
                missionId: "mission-1",
                expectedRevision: 1,
                statement: "Alternative A",
              }),
            ),
            Effect.exit(
              lab.reviseMission({
                missionId: "mission-1",
                expectedRevision: 1,
                statement: "Alternative B",
              }),
            ),
          ],
          { concurrency: "unbounded" },
        )
        assert.strictEqual(attempts.filter(Exit.isSuccess).length, 1)
        assert.strictEqual(attempts.filter(Exit.isFailure).length, 1)
        assert.lengthOf(yield* lab.getMissionRevisions("mission-1"), 2)
        assert.strictEqual((yield* lab.getMission("mission-1")).revision, 2)
      }).pipe(Effect.provide(BioLabLive(database)))
    }).pipe(Effect.provide(NodeServices.layer)),
)
