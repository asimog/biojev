import { NodeServices } from "@effect/platform-node"
import { assert, it } from "@effect/vitest"
import { Effect, FileSystem, Path } from "effect"
import { BioLab } from "./BioLab.ts"
import type { ScientificResult } from "./model/Domain.ts"
import type { Operation } from "./model/Recording.ts"
import { BioLabLive } from "./SqliteLive.ts"

it.effect(
  "enforces run authority, actual provenance, immutable science and revisions across SQLite reopening",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const database = path.join(
        yield* fs.makeTempDirectoryScoped(),
        "lab.sqlite",
      )
      const result: ScientificResult = {
        resultId: "negative",
        originRunId: "research-1",
        originBlockId: "block-1",
        executionReceiptId: "operation-1",
        inputRefs: [],
        outputRefs: [],
        summary: "Negative and zero are obtained outcomes",
        missingness: ["not_measured"],
        value: {
          zero: 0,
          false: false,
          negative: -1,
          missing: null,
          unavailable: "unavailable",
        },
      }
      yield* Effect.scoped(
        Effect.gen(function* () {
          const lab = yield* BioLab
          yield* lab.createMission({
            missionId: "mission",
            statement: "Explore sources and representations",
          })
          const identity = {
            runId: "research-1",
            missionId: "mission",
            role: "researcher" as const,
            blockId: "block-1",
            conversationId: "conversation-1",
            environmentId: "environment-1",
          }
          const { actor, execution } = yield* lab.beginRun(identity)
          const rejected = <A>(work: Effect.Effect<A, unknown>) =>
            work.pipe(
              Effect.match({
                onSuccess: () => {
                  throw new Error("Unauthorized write accepted")
                },
                onFailure: (error) => error,
              }),
            )
          const forged = yield* rejected(
            lab.recordScientificResult({ ...actor }, result),
          )
          assert.match(String(forged), /Invalid recording authority/)
          yield* rejected(lab.recordScientificResult(actor, result))
          const operation: Operation = {
            receiptId: "operation-1",
            environmentId: identity.environmentId,
            method: "exec",
            args: ["python3 analysis.py"],
            startedAt: 1,
            endedAt: 2,
            outcome: "SUCCEEDED",
            result: { ok: true, value: { exitCode: 0 } },
            output: "0 false -1",
          }
          yield* rejected(lab.recordOperation({ ...execution }, operation))
          yield* rejected(
            lab.recordOperation(execution, {
              ...operation,
              environmentId: "another-environment",
            }),
          )
          yield* lab.recordOperation(execution, operation)
          yield* lab.recordOperation(execution, operation)
          yield* rejected(
            lab.recordOperation(execution, { ...operation, output: "changed" }),
          )
          const ref = yield* lab.recordScientificResult(actor, result)
          assert.deepEqual(
            yield* lab.recordScientificResult(actor, result),
            ref,
          )
          yield* rejected(
            lab.recordScientificResult(actor, { ...result, value: 100 }),
          )
          yield* rejected(
            lab.recordScientificResult(actor, {
              ...result,
              resultId: "forged",
              originRunId: "another-run",
            }),
          )
          yield* lab.recordOperation(execution, {
            ...operation,
            receiptId: "literature",
            method: "readTextFile",
            result: "A paper claims success",
          })
          yield* rejected(
            lab.recordScientificResult(actor, {
              ...result,
              resultId: "paper",
              executionReceiptId: "literature",
            }),
          )
          const interpretation = yield* lab.recordInterpretation(actor, {
            interpretationId: "interpretation",
            originRunId: actor.runId,
            actorRole: "researcher",
            statement: "The negative result weakens this explanation",
            basisRefs: [ref],
          })
          yield* rejected(
            lab.recordInterpretation(actor, {
              interpretationId: "forged-role",
              originRunId: actor.runId,
              actorRole: "director",
              statement: "I decide global strategy",
              basisRefs: [],
            }),
          )
          const hypothesis = {
            revisionId: "h1",
            hypothesisId: "h",
            statement: "An open explanation",
            status: "ACTIVE" as const,
            basisRefs: [interpretation],
            assessmentSummary: "Initial",
            originRunId: actor.runId,
          }
          const h1 = yield* lab.recordHypothesisRevision(actor, hypothesis)
          yield* rejected(
            lab.recordHypothesisRevision(actor, {
              ...hypothesis,
              revisionId: "h2",
              basisRefs: [],
            }),
          )
          const h2 = yield* lab.recordHypothesisRevision(actor, {
            ...hypothesis,
            revisionId: "h2",
            status: "CONTRADICTED",
            basisRefs: [h1, ref],
          })
          yield* lab.recordFailure(actor, {
            failureId: "failed-replication",
            originRunId: actor.runId,
            summary: "Replication failed",
            basisRefs: [ref],
          })
          const uncertainty = yield* lab.recordUncertainty(actor, {
            uncertaintyId: "unknown",
            originRunId: actor.runId,
            question: "Which representation explains this?",
            basisRefs: [h2],
          })
          const validator = yield* lab.beginRun({
            ...identity,
            runId: "validator",
            role: "validator",
            conversationId: "validation",
            environmentId: "validation-env",
          })
          yield* rejected(
            lab.recordHypothesisRevision(validator.actor, {
              ...hypothesis,
              revisionId: "validator-mutation",
              originRunId: "validator",
              basisRefs: [h2],
            }),
          )
          yield* rejected(
            lab.recordScientificResult(validator.actor, {
              ...result,
              resultId: "borrowed",
              originRunId: "validator",
            }),
          )
          const invalidAssessment = yield* lab
            .recordResultAssessment(validator.actor, {
              assessmentId: "invalid-critique",
              resultRef: uncertainty,
              actorRole: "validator",
              originRunId: "validator",
              summary: "This is not a scientific result",
              strengths: [],
              concerns: [],
              relatedRefs: [],
            })
            .pipe(Effect.flip)
          assert.equal(invalidAssessment.code, "INVALID_INPUT")
          yield* lab.recordResultAssessment(validator.actor, {
            assessmentId: "critique",
            resultRef: ref,
            actorRole: "validator",
            originRunId: "validator",
            summary: "Independent criticism",
            strengths: [],
            concerns: ["Need another source"],
            relatedRefs: [h2],
          })
          assert.lengthOf(yield* lab.searchMemory("mission", ""), 7)
          yield* lab.settleRun(actor.runId)
          yield* rejected(
            lab.recordScientificResult(actor, { ...result, resultId: "late" }),
          )
          yield* rejected(lab.beginRun(identity))
        }).pipe(Effect.provide(BioLabLive(database))),
      )
      yield* Effect.scoped(
        Effect.gen(function* () {
          const lab = yield* BioLab
          const retained = yield* lab.getRecord({
            kind: "ScientificResult",
            id: "negative",
          })
          assert.deepEqual(retained.record, {
            kind: "ScientificResult",
            value: result,
          })
          assert.sameMembers(
            (yield* lab.searchMemory("mission", "negative")).map(
              (record) => record.id,
            ),
            [
              "negative",
              "interpretation",
              "h2",
              "failed-replication",
              "critique",
            ],
          )
          assert.equal((yield* lab.getRun("research-1")).status, "SETTLED")
        }).pipe(Effect.provide(BioLabLive(database))),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
)
