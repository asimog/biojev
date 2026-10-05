import { NodeServices } from "@effect/platform-node"
import { assert, it } from "@effect/vitest"
import { DateTime, Effect, FileSystem, Path } from "effect"
import { decision, dossier, report } from "../test/fixtures.ts"
import { BioLab } from "./BioLab.ts"
import { BioLabLive } from "./SqliteLive.ts"

it.effect("rejects stale Director handoffs across revision and reopening", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const database = path.join(
      yield* fs.makeTempDirectoryScoped(),
      "lab.sqlite",
    )
    const identity = {
      runId: "old-director",
      missionId: "mission",
      role: "director" as const,
      conversationId: "persistent-director",
      environmentId: "old-environment",
    }
    yield* Effect.scoped(
      Effect.gen(function* () {
        const lab = yield* BioLab
        yield* lab.createMission({
          missionId: "mission",
          statement: "Original mission",
        })
        yield* lab.beginRun(identity)
        yield* lab.reviseMission({
          missionId: "mission",
          expectedRevision: 1,
          statement: "Revised mission",
        })
        const admission = yield* lab
          .beginRun({ ...identity, runId: "stale-admission" }, 1)
          .pipe(Effect.flip)
        assert.equal(admission.code, "CONFLICT")
        assert.lengthOf(yield* lab.getRuns("mission"), 1)
        // Retrying admission must not rebind the existing run to a new revision.
        const old = yield* lab.beginRun(identity)
        assert.equal((yield* lab.getRun(identity.runId)).missionRevision, 1)
        const error = yield* lab
          .recordDirectorDecision(old.actor, decision("stale", "mission"))
          .pipe(Effect.flip)
        assert.equal(error.code, "CONFLICT")
        assert.isFalse((yield* lab.getLifecycle("mission")).objectiveReady)
        assert.lengthOf(yield* lab.searchMemory("mission", "stale"), 0)
      }).pipe(Effect.provide(BioLabLive(database))),
    )
    yield* Effect.scoped(
      Effect.gen(function* () {
        const lab = yield* BioLab
        const old = yield* lab.reopenRun(identity.runId)
        const error = yield* lab
          .recordDirectorDecision(
            old.actor,
            decision("stale-reopened", "mission"),
          )
          .pipe(Effect.flip)
        assert.equal(error.code, "CONFLICT")
        yield* lab.settleRun(identity.runId)
        const fresh = yield* lab.beginRun({
          ...identity,
          runId: "new-director",
          environmentId: "new-environment",
        })
        assert.equal((yield* lab.getRun(fresh.actor.runId)).missionRevision, 2)
        yield* lab.recordDirectorDecision(
          fresh.actor,
          decision("current", "mission"),
        )
        yield* lab.settleRun(fresh.actor.runId)
        assert.isTrue((yield* lab.getLifecycle("mission")).objectiveReady)
        const researcher = yield* lab.beginRun({
          ...identity,
          runId: "researcher",
          role: "researcher",
          blockId: "block",
        })
        const block = yield* lab.startResearchBlock(
          researcher.actor,
          "current-objective",
          DateTime.toEpochMillis(yield* DateTime.now) + 600000,
        )
        const uncertainty = yield* lab.recordUncertainty(researcher.actor, {
          uncertaintyId: "uncertainty",
          originRunId: researcher.actor.runId,
          question: "Unknown",
          basisRefs: [],
        })
        const invalid = yield* lab
          .recordDossier(researcher.actor, {
            ...dossier(block.blockId, block.objectiveId),
            scientificResultRefs: [uncertainty],
          })
          .pipe(Effect.flip)
        assert.equal(invalid.code, "INVALID_INPUT")
        assert.isUndefined(
          (yield* lab.getResearchBlocks("mission"))[0].dossierId,
        )
        yield* lab.recordDossier(
          researcher.actor,
          dossier(block.blockId, block.objectiveId),
        )
        for (let index = 0; index < 100; index++)
          yield* lab.recordInterpretation(researcher.actor, {
            interpretationId: `later-${index}`,
            originRunId: researcher.actor.runId,
            actorRole: "researcher",
            statement: "Later retained interpretation",
            basisRefs: [uncertainty],
          })
        assert.isFalse(
          (yield* lab.searchMemory("mission", researcher.actor.runId)).some(
            (record) => record.record.kind === "ResearchDossier",
          ),
        )
        assert.deepEqual(yield* lab.getRunCompletion(researcher.actor.runId), {
          handoffRetained: true,
          hasScientificResults: false,
        })
        yield* lab.finishResearchBlock({
          blockId: block.blockId,
          status: "COMPLETED_NO_RESULTS",
        })
      }).pipe(Effect.provide(BioLabLive(database))),
    )
  }).pipe(Effect.provide(NodeServices.layer)),
)

it.effect(
  "retains orphan history and an exact ten-block validation barrier through failure, report, review and reopen",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const database = path.join(
        yield* fs.makeTempDirectoryScoped(),
        "biojev.sqlite",
      )
      const rejected = <A>(work: Effect.Effect<A, unknown>) =>
        work.pipe(
          Effect.match({
            onFailure: () => true,
            onSuccess: () => {
              throw new Error("Illegal lifecycle transition accepted")
            },
          }),
        )
      yield* Effect.scoped(
        Effect.gen(function* () {
          const lab = yield* BioLab
          yield* lab.createMission({
            missionId: "mission",
            statement: "An open mission",
          })
          assert.isTrue((yield* lab.getLifecycle("mission")).directorRequired)
          const investigate = Effect.fn("test.investigate")(function* (
            index: number,
            terminal:
              | "COMPLETED_NO_RESULTS"
              | "FAILED"
              | "TIMED_OUT"
              | "CANCELLED",
            hasDossier: boolean,
          ) {
            const director = yield* lab.beginRun({
              runId: `director-${index}`,
              missionId: "mission",
              role: "director",
              conversationId: "persistent-director",
              environmentId: `director-env-${index}`,
            })
            const selected = decision(`decision-${index}`, "mission")
            yield* lab.recordDirectorDecision(director.actor, selected)
            assert.deepEqual(
              yield* lab.recordDirectorDecision(director.actor, selected),
              { kind: "DirectorDecision", id: selected.decisionId },
            )
            yield* lab.settleRun(director.actor.runId)
            const researcher = yield* lab.beginRun({
              runId: `researcher-${index}`,
              missionId: "mission",
              role: "researcher",
              conversationId: `fresh-${index}`,
              environmentId: `research-env-${index}`,
              blockId: `block-${index}`,
            })
            const deadline =
              DateTime.toEpochMillis(yield* DateTime.now) + 600000
            const block = yield* lab.startResearchBlock(
              researcher.actor,
              selected.nextObjective.objectiveId,
              deadline,
            )
            if (hasDossier)
              yield* lab.recordDossier(
                researcher.actor,
                dossier(block.blockId, block.objectiveId),
              )
            else
              yield* lab.recordFailure(researcher.actor, {
                failureId: `failure-${index}`,
                originRunId: researcher.actor.runId,
                summary: "No dossier was obtained",
                basisRefs: [],
              })
            const finished = yield* lab.finishResearchBlock({
              blockId: block.blockId,
              status: terminal,
            })
            assert.deepEqual(
              yield* lab.finishResearchBlock({
                blockId: block.blockId,
                status: terminal,
              }),
              finished,
            )
            return finished
          })
          assert.equal(
            (yield* investigate(-3, "FAILED", false)).classification,
            "ORPHAN",
          )
          assert.equal(
            (yield* investigate(-2, "TIMED_OUT", false)).classification,
            "ORPHAN",
          )
          assert.equal(
            (yield* investigate(-1, "CANCELLED", true)).classification,
            "ORPHAN",
          )
          assert.equal((yield* lab.getLifecycle("mission")).countableBlocks, 0)
          for (let index = 0; index < 10; index++) {
            const terminal =
              index === 8
                ? "FAILED"
                : index === 9
                  ? "TIMED_OUT"
                  : "COMPLETED_NO_RESULTS"
            assert.equal(
              (yield* investigate(index, terminal, true)).classification,
              "COUNTABLE",
            )
          }
          const due = yield* lab.getLifecycle("mission")
          assert.isTrue(due.validationDue)
          assert.isFalse(due.objectiveReady)
          assert.equal(due.countableBlocks, 10)
          assert.deepEqual(
            due.validation?.blockIds,
            Array.from({ length: 10 }, (_, index) => `block-${index}`),
          )
          const bypass = yield* lab.beginRun({
            runId: "bypass",
            missionId: "mission",
            role: "director",
            conversationId: "persistent-director",
            environmentId: "bypass-env",
          })
          yield* rejected(
            lab.recordDirectorDecision(
              bypass.actor,
              decision("illegal-eleven", "mission"),
            ),
          )
          yield* lab.settleRun("bypass")
          const failedValidator = yield* lab.beginRun({
            runId: "validator-failed",
            missionId: "mission",
            role: "validator",
            conversationId: "fresh-failed-validation",
            environmentId: "validation-failed-env",
            blockId: "validation-failed-block",
          })
          yield* lab.startValidation(failedValidator.actor)
          yield* lab.finishValidation(failedValidator.actor, "Provider failed")
          assert.isTrue((yield* lab.getLifecycle("mission")).validationDue)
          const validator = yield* lab.beginRun({
            runId: "validator",
            missionId: "mission",
            role: "validator",
            conversationId: "fresh-validation",
            environmentId: "validation-env",
            blockId: "validation-block",
          })
          const cycle = yield* lab.startValidation(validator.actor)
          yield* rejected(
            lab.recordDirectorDecision(
              validator.actor,
              decision("validator-objective", "mission"),
            ),
          )
          const critique = report(cycle.cycleId, cycle.blockIds)
          yield* rejected(
            lab.recordValidationReport(validator.actor, {
              ...critique,
              blockRefs: critique.blockRefs.slice(1),
            }),
          )
          yield* lab.recordValidationReport(validator.actor, critique)
          yield* lab.recordValidationReport(validator.actor, critique)
          const pending = yield* lab.getLifecycle("mission")
          assert.isFalse(pending.validationDue)
          assert.isTrue(pending.validationCompletedAwaitingDirectorReview)
          assert.isFalse(pending.objectiveReady)
          yield* lab.finishValidation(
            validator.actor,
            "Report retained and computation cleaned",
          )
          assert.equal((yield* lab.getLifecycle("mission")).countableBlocks, 10)
          const director = yield* lab.beginRun({
            runId: "director-review",
            missionId: "mission",
            role: "director",
            conversationId: "persistent-director",
            environmentId: "review-env",
          })
          yield* rejected(
            lab.recordDirectorDecision(
              director.actor,
              decision("review", "mission"),
            ),
          )
          assert.isTrue(
            (yield* lab.getLifecycle("mission"))
              .validationCompletedAwaitingDirectorReview,
          )
          yield* lab.recordDirectorDecision(
            director.actor,
            decision("review", "mission", critique.reportId),
          )
          yield* lab.settleRun(director.actor.runId)
          const reviewed = yield* lab.getLifecycle("mission")
          assert.isFalse(reviewed.validationCompletedAwaitingDirectorReview)
          assert.isTrue(reviewed.objectiveReady)
          assert.equal(reviewed.countableBlocks, 0)
          assert.lengthOf(yield* lab.getResearchBlocks("mission"), 13)
          yield* lab.setMissionStatus("mission", "PAUSED")
        }).pipe(Effect.provide(BioLabLive(database))),
      )
      yield* Effect.scoped(
        Effect.gen(function* () {
          const lab = yield* BioLab
          const state = yield* lab.getLifecycle("mission")
          assert.equal(state.mission.status, "PAUSED")
          assert.isTrue(state.objectiveReady)
          assert.equal(state.countableBlocks, 0)
          const researcher = yield* lab
            .beginRun({
              runId: "researcher-11",
              missionId: "mission",
              role: "researcher",
              conversationId: "new-eleven",
              environmentId: "env-eleven",
              blockId: "block-eleven",
            })
            .pipe(
              Effect.match({
                onFailure: () => "paused",
                onSuccess: () => "admitted",
              }),
            )
          assert.equal(researcher, "paused")
          yield* lab.setMissionStatus("mission", "RUNNING")
          const next = yield* lab.beginRun({
            runId: "researcher-11",
            missionId: "mission",
            role: "researcher",
            conversationId: "new-eleven",
            environmentId: "env-eleven",
            blockId: "block-eleven",
          })
          assert.isDefined(state.objectiveId)
          const block = yield* lab.startResearchBlock(
            next.actor,
            state.objectiveId ?? "",
            DateTime.toEpochMillis(yield* DateTime.now) + 600000,
          )
          assert.equal(block.status, "RUNNING")
          assert.equal((yield* lab.getLifecycle("mission")).countableBlocks, 0)
          yield* lab.setMissionStatus("mission", "STOPPED")
          yield* lab.finishResearchBlock({
            blockId: block.blockId,
            status: "CANCELLED",
            reason: "Human stop",
          })
          yield* rejected(lab.setMissionStatus("mission", "RUNNING"))
        }).pipe(Effect.provide(BioLabLive(database))),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
)
