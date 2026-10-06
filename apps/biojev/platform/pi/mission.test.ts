import {
  awaitWithContext,
  BACKGROUND_CONTEXT,
} from "@earendil-works/chord/context"
import { Type } from "@earendil-works/pi-ai"
import { createModels } from "@earendil-works/pi-ai/models"
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from "@earendil-works/pi-ai/providers/faux"
import { defineExtension, defineTool } from "@earendil-works/pi-durable"
import { NodeHttpServer, NodeServices } from "@effect/platform-node"
import { assert, it } from "@effect/vitest"
import {
  Context,
  DateTime,
  Effect,
  Fiber,
  FileSystem,
  Layer,
  Path,
  Schema,
  Stream,
} from "effect"
import { HttpClient, HttpClientRequest, HttpRouter } from "effect/http"
import { BioLab } from "../../biolab/BioLab.ts"
import { CanonicalRef } from "../../biolab/model/Domain.ts"
import { Mission } from "../../biolab/model/Mission.ts"
import { Operation } from "../../biolab/model/Recording.ts"
import { BioLabLive } from "../../biolab/SqliteLive.ts"
import { LinuxNetworkConfig } from "../../config/config.ts"
import { discoverGenesis } from "../../core/genesis.ts"
import { advanceMission } from "../../core/mission.ts"
import { acquireMissionLoop } from "../../core/mission-loop.ts"
import { makeMissionRoutes } from "../../http/missions.ts"
import { HistoryView, MissionSnapshotView } from "../../http/views.ts"
import { JevEngine, JevEngineError } from "../../jevengine/JevEngine.ts"
import {
  decision,
  discoveredMap,
  dossier,
  report,
} from "../../test/fixtures.ts"
import { acquireHarness } from "./harness.ts"
import { acquireRolePrograms } from "./roles.ts"

const Input = Schema.Struct({
  runId: Schema.String,
  blockId: Schema.optionalKey(Schema.NullOr(Schema.String)),
  researchHandoff: Schema.optionalKey(
    Schema.Struct({
      ref: CanonicalRef,
      dossier: Schema.Struct({
        id: Schema.String,
        originRunId: Schema.String,
        record: Schema.Struct({
          kind: Schema.Literal("ResearchDossier"),
          value: Schema.Struct({ summary: Schema.String }),
        }),
      }),
    }),
  ),
  trajectory: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        dossier: Schema.optionalKey(
          Schema.Struct({
            record: Schema.Struct({ kind: Schema.Literal("ResearchDossier") }),
          }),
        ),
      }),
    ),
  ),
  role: Schema.Literals(["director", "researcher", "validator"]),
  mode: Schema.optionalKey(Schema.String),
  mission: Schema.Struct({ missionId: Schema.String }),
  genesis: Schema.optionalKey(
    Schema.NullOr(Schema.Struct({ status: Schema.String })),
  ),
  lifecycle: Schema.Struct({
    validation: Schema.optionalKey(
      Schema.Struct({ reportId: Schema.optionalKey(Schema.String) }),
    ),
  }),
})

it.live(
  "parks a missing inaugural handoff without repeatedly invoking Pi or stopping the mission",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fs.makeTempDirectoryScoped()
      const network = yield* LinuxNetworkConfig
      const faux = fauxProvider()
      const models = createModels()
      models.setProvider(faux.provider)
      let turns = 0
      faux.setResponses(
        Array.from({ length: 8 }, () => () => {
          turns++
          return fauxAssistantMessage(
            "Unable to produce an institutional handoff.",
          )
        }),
      )
      yield* Effect.scoped(
        Effect.gen(function* () {
          const lab = yield* BioLab
          const roles = yield* acquireRolePrograms({
            database: path.join(directory, "pi.sqlite"),
            models,
            model: { provider: "faux", modelId: "faux-1" },
            environment: {
              nodeBinary: process.execPath,
              nodeModules: path.resolve("node_modules"),
              workerDirectory: path.resolve(
                "apps/biojev/platform/pi/execution-env",
              ),
              artifactDirectory: path.join(directory, "artifacts"),
              workspaceRoot: path.join(directory, "workspaces"),
              ...network,
            },
          })
          const commands = yield* acquireMissionLoop({
            ...roles,
            genesis: (id: string) =>
              lab.recordGenesisDiscovery(discoveredMap(id)),
          })
          yield* commands.start({
            missionId: "mission",
            statement: "Investigate without prescribing a method",
          })
          while ((yield* commands.state).failures.mission === undefined)
            yield* Effect.sleep("10 millis")
          assert.equal(turns, 1)
          yield* Effect.sleep("100 millis")
          assert.equal(turns, 1)
          assert.equal((yield* lab.getMission("mission")).status, "RUNNING")
          assert.lengthOf(yield* lab.getResearchBlocks("mission"), 0)
          yield* commands.resume("mission")
          while ((yield* commands.state).failures.mission === undefined)
            yield* Effect.sleep("10 millis")
          assert.equal(turns, 2)
          assert.lengthOf(yield* lab.getRuns("mission"), 2)
          yield* commands.stop("mission")
        }).pipe(
          Effect.provide(BioLabLive(path.join(directory, "biojev.sqlite"))),
        ),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
  { timeout: 15000 },
)

it.live(
  "runs a fast 25-block Pi/BioLab lifecycle with Researcher handoffs and two reviewed validation windows",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fs.makeTempDirectoryScoped()
      const network = yield* LinuxNetworkConfig
      const faux = fauxProvider()
      const models = createModels()
      models.setProvider(faux.provider)
      const computedRuns = new Map<string, number>()
      let failedReview = false
      let validationAttempts = 0
      faux.setResponses(
        Array.from({ length: 400 }, () => (context) => {
          const user = context.messages
            .filter((message) => message.role === "user")
            .at(-1)
          if (user?.role !== "user" || typeof user.content !== "string")
            throw new Error("Expected institutional role input")
          const input = Schema.decodeSync(Schema.fromJsonString(Input))(
            user.content,
          )
          if (input.mode === "DIRECTOR_SIDE_WORK") {
            const last = context.messages.at(-1)
            if (
              last?.role === "toolResult" &&
              last.toolName === "record_learning"
            )
              return fauxAssistantMessage(fauxToolCall("submit_handoff", {}), {
                stopReason: "toolUse",
              })
            return fauxAssistantMessage(
              fauxToolCall("record_learning", {
                kind: "Interpretation",
                value: {
                  statement:
                    "Director reassessed previous work alongside this block",
                  basisRefs: [],
                },
              }),
              { stopReason: "toolUse" },
            )
          }
          if (input.role === "director") {
            if (computedRuns.size > 0)
              assert.equal(
                input.researchHandoff?.dossier.record.kind,
                "ResearchDossier",
              )
            assert.isTrue(
              input.genesis?.status === "DIRECTOR_RUNNING" ||
                input.genesis?.status === "COMPLETED",
            )
            if (
              input.lifecycle.validation?.reportId !== undefined &&
              !failedReview
            ) {
              failedReview = true
              return fauxAssistantMessage(
                "Unable to submit a strategic handoff in this attempt.",
              )
            }
            const chosen = decision(
              "model-authored-id",
              input.mission.missionId,
              input.lifecycle.validation?.reportId,
            )
            const {
              decisionId: _id,
              missionId: _mission,
              nextObjective,
              ...payload
            } = chosen
            if (input.researchHandoff) {
              assert.equal(
                input.researchHandoff.dossier.originRunId,
                [...computedRuns.keys()].at(-1),
              )
              assert.equal(
                input.researchHandoff.ref.id,
                input.researchHandoff.dossier.id,
              )
              payload.basisRefs = [
                ...payload.basisRefs,
                input.researchHandoff.ref,
              ]
            }
            const {
              objectiveId: _objective,
              missionId: _objectiveMission,
              originDirectorDecisionId: _decision,
              ...objective
            } = nextObjective
            return fauxAssistantMessage(
              fauxToolCall("submit_handoff", {
                ...payload,
                nextObjective: {
                  ...objective,
                  statement: input.researchHandoff
                    ? `Follow up on: ${input.researchHandoff.dossier.record.value.summary}`
                    : objective.statement,
                },
              }),
              { stopReason: "toolUse" },
            )
          }
          if (input.role === "researcher") {
            if (!computedRuns.has(input.runId))
              computedRuns.set(input.runId, computedRuns.size)
            const variant = computedRuns.get(input.runId) ?? 100
            const results = context.messages.filter(
              (message) => message.role === "toolResult",
            )
            for (const result of results) {
              if (result.toolCallId === "invalid-reference-kind") {
                assert.isTrue(result.isError)
                const text = result.content
                  .map((part) => (part.type === "text" ? part.text : ""))
                  .join("")
                assert.include(text, "Dossier")
                assert.notInclude(text, "Canonical record not found")
              } else assert.isFalse(result.isError, JSON.stringify(result))
            }
            const output = (name: string) => {
              const result = results.find(
                (message) =>
                  message.role === "toolResult" && message.toolName === name,
              )
              if (result?.role !== "toolResult")
                throw new Error(`Missing ${name}`)
              return result.content
                .map((part) => (part.type === "text" ? part.text : ""))
                .join("")
            }
            const has = (name: string) =>
              results.some(
                (message) =>
                  message.role === "toolResult" && message.toolName === name,
              )
            const call = (
              name: string,
              args: Parameters<typeof fauxToolCall>[1],
            ) =>
              fauxAssistantMessage(fauxToolCall(name, args), {
                stopReason: "toolUse",
              })
            if (variant < 2) {
              if (!has("bash"))
                return call("bash", {
                  command:
                    variant === 0
                      ? `python3 -c 'import json; json.dump({"value":0,"missing":None},open("result.json","w")); print("Obtained zero")'`
                      : `printf '{"value":false,"missing":"unavailable"}' > result.json; cat result.json`,
                })
              if (!has("operation_receipts"))
                return call("operation_receipts", {})
              if (!has("retain_artifact"))
                return call("retain_artifact", { path: "result.json" })
              if (!has("record_learning")) {
                const receipts = Schema.decodeSync(
                  Schema.fromJsonString(Schema.Array(Operation)),
                )(output("operation_receipts"))
                const artifact = Schema.decodeSync(
                  Schema.fromJsonString(CanonicalRef),
                )(output("retain_artifact"))
                return call("record_learning", {
                  kind: "ScientificResult",
                  value: {
                    executionReceiptId:
                      receipts.find((receipt) => receipt.method === "exec")
                        ?.receiptId ?? "missing",
                    inputRefs: [],
                    outputRefs: [artifact],
                    summary: "An actual source-agnostic program output",
                    missingness: [
                      variant === 0 ? "not_measured" : "unavailable",
                    ],
                    value:
                      variant === 0
                        ? { value: 0, missing: null }
                        : { value: false, missing: "unavailable" },
                  },
                })
              }
              if (!has("browse_memory"))
                return call("browse_memory", { limit: 1 })
              const page = Schema.decodeSync(
                Schema.fromJsonString(HistoryView),
              )(output("browse_memory"))
              assert.lengthOf(page.records, 1)
              assert.isNotNull(page.next)
              if (!has("read_record"))
                return fauxAssistantMessage(
                  [
                    fauxToolCall(
                      "read_record",
                      Schema.decodeSync(Schema.fromJsonString(CanonicalRef))(
                        output("retain_artifact"),
                      ),
                    ),
                    fauxToolCall("read_record", {
                      kind: "ResearchBlock",
                      id: input.blockId ?? "missing",
                    }),
                  ],
                  { stopReason: "toolUse" },
                )
              if (
                variant === 1 &&
                !results.some(
                  (result) => result.toolCallId === "invalid-reference-kind",
                )
              )
                return fauxAssistantMessage(
                  fauxToolCall(
                    "read_record",
                    { kind: "Dossier", id: input.blockId ?? "missing" },
                    { id: "invalid-reference-kind" },
                  ),
                  { stopReason: "toolUse" },
                )
              if (
                variant === 0 &&
                results.filter(
                  (result) => result.toolName === "record_learning",
                ).length === 1
              ) {
                // Exceed the memory-search page after retaining a real result.
                const resultRef = Schema.decodeSync(
                  Schema.fromJsonString(CanonicalRef),
                )(output("record_learning"))
                return fauxAssistantMessage(
                  Array.from({ length: 100 }, (_, index) =>
                    fauxToolCall("record_learning", {
                      kind: "Interpretation",
                      value: {
                        statement: `Alternative interpretation ${index}`,
                        basisRefs: [resultRef],
                      },
                    }),
                  ),
                  { stopReason: "toolUse" },
                )
              }
            }
            const {
              dossierId: _id,
              blockId: _block,
              objectiveId: _objective,
              ...payload
            } = dossier("", "")
            const scientificResultRefs =
              variant >= 2
                ? []
                : [
                    Schema.decodeSync(Schema.fromJsonString(CanonicalRef))(
                      output("record_learning"),
                    ),
                  ]
            return call("submit_handoff", {
              ...payload,
              semanticMeasurementRefs: [
                { kind: "SemanticMeasurement", id: "measurement-1" },
              ],
              scientificResultRefs,
              summary:
                variant < 2
                  ? "Retained actual outputs"
                  : "No obtained results in this investigation",
            })
          }
          assert.lengthOf(input.trajectory ?? [], 10)
          assert.isTrue(
            input.trajectory?.every(
              (block) => block.dossier?.record.kind === "ResearchDossier",
            ),
          )
          if (validationAttempts++ === 0)
            return fauxAssistantMessage(
              "Validation interrupted before a report could be retained.",
            )
          const {
            reportId: _report,
            cycleId: _cycle,
            blockRefs: _blocks,
            ...payload
          } = report("", [])
          return fauxAssistantMessage(fauxToolCall("submit_handoff", payload), {
            stopReason: "toolUse",
          })
        }),
      )
      yield* Effect.scoped(
        Effect.gen(function* () {
          const lab = yield* BioLab
          const roles = yield* acquireRolePrograms({
            concurrentDirector: true,
            database: path.join(directory, "pi.sqlite"),
            models,
            blockTimeoutMs: 5000,
            model: { provider: "faux", modelId: "faux-1" },
            environment: {
              nodeBinary: process.execPath,
              nodeModules: path.resolve("node_modules"),
              workerDirectory: path.resolve(
                "apps/biojev/platform/pi/execution-env",
              ),
              artifactDirectory: path.join(directory, "artifacts"),
              ...network,
            },
          })
          yield* lab.createMission({
            missionId: "mission",
            statement: "Investigate an open computational question",
          })
          const map = discoveredMap("mission")
          const programs = {
            ...roles,
            genesis: (missionId: string) =>
              discoverGenesis(
                missionId,
                () =>
                  Effect.succeed({
                    programId: map.programId,
                    programVersion: map.programVersion,
                    configuredInputIds: map.configuredInputIds,
                    outcomes: map.outcomes,
                    candidates: map.candidates,
                  }),
                () => ({
                  questionId: map.measurements[0].questionId,
                  questionVersion: "1",
                  originRunId: `${missionId}:genesis`,
                  subjectRefs: map.measurements[0].subjectRefs,
                  projection: map.measurements[0].projection,
                  question: map.measurements[0].question,
                }),
              ).pipe(
                Effect.provideService(JevEngine, {
                  measure: () =>
                    lab.getGenesis("mission").pipe(
                      Effect.mapError(
                        (cause) =>
                          new JevEngineError({
                            message: "Cannot inspect Genesis checkpoint",
                            cause,
                          }),
                      ),
                      Effect.tap((snapshot) =>
                        Effect.sync(() =>
                          assert.equal(snapshot?.status, "DISCOVERING"),
                        ),
                      ),
                      Effect.as(map.measurements[0]),
                    ),
                }),
              ),
          }
          assert.equal(
            yield* advanceMission("mission", programs),
            "RUN_GENESIS",
          )
          assert.equal(
            (yield* lab.getGenesis("mission"))?.status,
            "READY_FOR_DIRECTION",
          )
          assert.equal((yield* lab.getLifecycle("mission")).countableBlocks, 0)

          for (let block = 0; block < 10; block++) {
            assert.equal(
              yield* advanceMission("mission", programs),
              block === 0 ? "RUN_GENESIS" : "RUN_DIRECTOR",
            )
            assert.equal(
              yield* advanceMission("mission", programs),
              "RUN_RESEARCHER",
            )
            if (block === 1) {
              const blockActivity = yield* Schema.decodeEffect(
                MissionSnapshotView.fields.activity,
              )(yield* roles.activity("mission"))
              assert.isTrue(
                blockActivity.some((run) =>
                  run.recentTools?.some(
                    (tool) =>
                      tool.name === "bash" && tool.status === "completed",
                  ),
                ),
              )
            }
          }
          const due = yield* lab.getLifecycle("mission")
          assert.isTrue(due.validationDue)
          assert.isTrue(
            (yield* Effect.exit(roles.researcher("mission")))._tag ===
              "Failure",
          )
          assert.equal(due.countableBlocks, 10)
          assert.equal(
            yield* advanceMission("mission", programs),
            "RUN_VALIDATOR",
          )
          assert.isTrue((yield* lab.getLifecycle("mission")).validationDue)
          assert.equal((yield* lab.getLifecycle("mission")).countableBlocks, 10)
          assert.equal(
            yield* advanceMission("mission", programs),
            "RUN_VALIDATOR",
          )
          const activity = yield* Schema.decodeEffect(
            MissionSnapshotView.fields.activity,
          )(yield* roles.activity("mission"))
          assert.isTrue(
            activity.some(
              (run) =>
                run.requestedModel?.modelId === "faux-1" &&
                run.actualModel !== null,
            ),
          )
          const pending = yield* lab.getLifecycle("mission")
          assert.isTrue(pending.validationCompletedAwaitingDirectorReview)
          assert.isFalse(pending.objectiveReady)
          assert.isTrue(
            (yield* Effect.exit(roles.researcher("mission")))._tag ===
              "Failure",
          )
          assert.equal(
            yield* advanceMission("mission", programs),
            "RUN_DIRECTOR",
          )
          assert.isTrue(
            (yield* lab.getLifecycle("mission"))
              .validationCompletedAwaitingDirectorReview,
          )
          assert.isFalse((yield* lab.getLifecycle("mission")).objectiveReady)
          assert.equal(
            yield* advanceMission("mission", programs),
            "RUN_DIRECTOR",
          )
          const reviewed = yield* lab.getLifecycle("mission")
          assert.equal(reviewed.countableBlocks, 0)
          assert.isFalse(reviewed.validationCompletedAwaitingDirectorReview)
          assert.equal(
            yield* advanceMission("mission", programs),
            "RUN_RESEARCHER",
          )
          for (let number = 12; number <= 25; number++) {
            if (number === 21) {
              assert.equal(
                yield* advanceMission("mission", programs),
                "RUN_VALIDATOR",
              )
              assert.isTrue(
                (yield* lab.getLifecycle("mission"))
                  .validationCompletedAwaitingDirectorReview,
              )
            }
            assert.equal(
              yield* advanceMission("mission", programs),
              "RUN_DIRECTOR",
            )
            assert.equal(
              yield* advanceMission("mission", programs),
              "RUN_RESEARCHER",
            )
          }
          const cycles = yield* lab.getValidationCycles("mission")
          assert.lengthOf(cycles, 2)
          assert.isTrue(
            cycles.every(
              (cycle) =>
                cycle.status === "REVIEWED" &&
                cycle.reportId &&
                cycle.decisionId &&
                cycle.blockIds.length === 10,
            ),
          )
          const blocks = yield* lab.getResearchBlocks("mission")
          assert.lengthOf(blocks, 25)
          for (let index = 0; index < 2; index++)
            assert.deepEqual(
              cycles[index].blockIds,
              blocks
                .slice(index * 10, index * 10 + 10)
                .map((block) => block.blockId),
            )
          assert.isTrue(
            blocks.every((block) => block.deadline - block.startedAt <= 5000),
          )
          assert.isTrue(
            blocks.every(
              (block) =>
                ["COMPLETED", "COMPLETED_NO_RESULTS"].includes(block.status) &&
                block.classification === "COUNTABLE",
            ),
          )
          assert.equal((yield* lab.getLifecycle("mission")).countableBlocks, 5)
          assert.equal(
            blocks.filter((block) => block.status === "COMPLETED").length,
            2,
          )
          const runs = yield* lab.getRuns("mission")
          assert.lengthOf(
            runs.filter((run) => run.purpose === "DIRECTOR_SIDE_WORK"),
            25,
          )
          assert.isTrue(runs.every((run) => run.status === "SETTLED"))
          const directors = runs.filter((run) => run.role === "director")
          const researchers = runs.filter((run) => run.role === "researcher")
          const validators = runs.filter((run) => run.role === "validator")
          assert.equal(
            new Set(directors.map((run) => run.conversationId)).size,
            1,
          )
          assert.equal(
            new Set(researchers.map((run) => run.conversationId)).size,
            25,
          )
          assert.lengthOf(validators, 3)
          assert.notEqual(
            validators[0].conversationId,
            validators[1].conversationId,
          )
          assert.notEqual(
            validators[0].environmentId,
            validators[1].environmentId,
          )
          assert.isFalse(
            researchers.some(
              (run) => run.environmentId === validators[0].environmentId,
            ),
          )
          const decisions = (yield* lab.searchMemory("mission", "")).filter(
            (record) => record.record.kind === "DirectorDecision",
          )
          assert.isTrue(
            decisions.some(
              (record) =>
                record.record.kind === "DirectorDecision" &&
                record.record.value.basisValidationReportId ===
                  pending.validation?.reportId,
            ),
          )
          yield* lab.setMissionStatus("mission", "STOPPED")
          assert.equal(yield* advanceMission("mission", programs), "STOP")
          const commands = yield* acquireMissionLoop(programs, false)
          const server = HttpRouter.serve(
            makeMissionRoutes(lab, commands, roles.activity),
            { disableListenLog: true },
          ).pipe(Layer.provideMerge(NodeHttpServer.layerTest))
          yield* Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient
            const response = yield* client.get("/api/missions/mission")
            const snapshot = yield* Schema.decodeUnknownEffect(
              MissionSnapshotView,
            )(yield* response.json)
            assert.lengthOf(snapshot.validationHistory, 2)
            assert.isTrue(
              snapshot.validationHistory.every(
                (cycle) => cycle.status === "REVIEWED",
              ),
            )
            assert.equal(snapshot.lifecycle.countableBlocks, 5)
          }).pipe(Effect.provide(server))
        }).pipe(
          Effect.provide(BioLabLive(path.join(directory, "biojev.sqlite"))),
        ),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
  { timeout: 60000 },
)

it.live(
  "timeout aborts Pi cognition; pause retains an orphan and resume starts fresh",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fs.makeTempDirectoryScoped()
      const network = yield* LinuxNetworkConfig
      const faux = fauxProvider()
      const models = createModels()
      models.setProvider(faux.provider)
      let ended = 0
      let started = () => {}
      faux.setResponses(
        Array.from({ length: 6 }, () => (context, options) => {
          const user = context.messages
            .filter((message) => message.role === "user")
            .at(-1)
          if (user?.role !== "user" || typeof user.content !== "string")
            throw new Error("Missing role input")
          const input = Schema.decodeSync(Schema.fromJsonString(Input))(
            user.content,
          )
          if (input.role === "director") {
            const {
              decisionId: _id,
              missionId: _mission,
              nextObjective,
              ...payload
            } = decision("", input.mission.missionId)
            const {
              objectiveId: _objective,
              missionId: _objectiveMission,
              originDirectorDecisionId: _decision,
              ...objective
            } = nextObjective
            return fauxAssistantMessage(
              fauxToolCall("submit_handoff", {
                ...payload,
                nextObjective: objective,
              }),
              { stopReason: "toolUse" },
            )
          }
          started()
          return new Promise<never>((_resolve, reject) => {
            const abort = () => {
              ended++
              reject(new Error("Pi model aborted"))
            }
            if (options?.signal?.aborted) abort()
            else
              options?.signal?.addEventListener("abort", abort, { once: true })
          })
        }),
      )
      yield* Effect.scoped(
        Effect.gen(function* () {
          const lab = yield* BioLab
          const roles = yield* acquireRolePrograms({
            database: path.join(directory, "pi.sqlite"),
            models,
            model: { provider: "faux", modelId: "faux-1" },
            blockTimeoutMs: 300,
            environment: {
              nodeBinary: process.execPath,
              nodeModules: path.resolve("node_modules"),
              workerDirectory: path.resolve(
                "apps/biojev/platform/pi/execution-env",
              ),
              artifactDirectory: path.join(directory, "artifacts"),
              ...network,
            },
          })
          yield* lab.createMission({
            missionId: "mission",
            statement: "Investigate an open question",
          })
          yield* lab.recordGenesisDiscovery(discoveredMap("mission"))
          yield* advanceMission("mission", roles)
          yield* advanceMission("mission", roles)
          let blocks = yield* lab.getResearchBlocks("mission")
          assert.equal(blocks[0].status, "TIMED_OUT")
          assert.equal(blocks[0].classification, "ORPHAN")
          assert.equal(ended, 1)
          yield* advanceMission("mission", roles)
          const ready = new Promise<void>((resolve) => {
            started = resolve
          })
          const active = yield* advanceMission("mission", roles).pipe(
            Effect.forkScoped,
          )
          yield* Effect.promise(() => ready)
          yield* lab.setMissionStatus("mission", "PAUSED")
          yield* Fiber.interrupt(active)
          blocks = yield* lab.getResearchBlocks("mission")
          assert.equal(blocks[1].status, "CANCELLED")
          assert.equal(blocks[1].classification, "ORPHAN")
          assert.equal(ended, 2)
          assert.equal(yield* advanceMission("mission", roles), "WAIT")
          const originalDeadline = blocks[1].deadline
          yield* lab.setMissionStatus("mission", "RUNNING")
          yield* advanceMission("mission", roles)
          yield* advanceMission("mission", roles)
          blocks = yield* lab.getResearchBlocks("mission")
          assert.equal(blocks[1].deadline, originalDeadline)
          assert.notEqual(blocks[1].blockId, blocks[2].blockId)
          assert.equal(blocks[2].status, "TIMED_OUT")
          assert.equal(ended, 3)
          const researchers = (yield* lab.getRuns("mission")).filter(
            (run) => run.role === "researcher",
          )
          assert.equal(
            new Set(researchers.map((run) => run.conversationId)).size,
            3,
          )
          assert.equal((yield* lab.getLifecycle("mission")).countableBlocks, 0)
        }).pipe(
          Effect.provide(BioLabLive(path.join(directory, "biojev.sqlite"))),
        ),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
  { timeout: 15000 },
)

it.live.each([false, true])(
  "reconciles interrupted work without replay and preserves orphan identity; runtime state missing: %s",
  (missingRuntime) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fs.makeTempDirectoryScoped()
      const network = yield* LinuxNetworkConfig
      const database = path.join(directory, "pi.sqlite")
      const environmentId = crypto.randomUUID()
      const workspaceRoot = path.join(directory, "workspaces")
      const workspace = path.join(workspaceRoot, environmentId)
      const faux = fauxProvider()
      const models = createModels()
      models.setProvider(faux.provider)
      let executions = 0
      let started = () => {}
      const ready = new Promise<void>((resolve) => {
        started = resolve
      })
      const external = defineTool({
        name: "external",
        description: "An operation whose outcome cannot be safely replayed",
        parameters: Type.Object({}),
        replay: "unsafe",
        execute: async (_args, _api, context) => {
          executions++
          started()
          await awaitWithContext(new Promise<never>(() => {}), context)
          return {}
        },
      })
      faux.setResponses([
        fauxAssistantMessage(fauxToolCall("external", {}), {
          stopReason: "toolUse",
        }),
      ])
      yield* Effect.scoped(
        Effect.gen(function* () {
          const lab = yield* BioLab
          yield* lab.createMission({
            missionId: "mission",
            statement: "Investigate a generic computational question",
          })
          yield* lab.recordGenesisDiscovery(discoveredMap("mission"))
          const director = yield* lab.beginRun({
            runId: "director",
            missionId: "mission",
            role: "director",
            conversationId: "director-context",
            environmentId: crypto.randomUUID(),
          })
          const chosen = decision("decision", "mission")
          yield* lab.recordDirectorDecision(director.actor, chosen)
          yield* lab.settleRun("director")
          yield* fs.makeDirectory(workspace, { recursive: true })
          yield* fs.writeFileString(
            path.join(workspace, "partial.txt"),
            "Available interrupted work",
          )
          yield* Effect.scoped(
            Effect.gen(function* () {
              const harness = yield* acquireHarness(database, {
                models,
                extensions: [
                  defineExtension({ name: "external", tools: [external] }),
                ],
              })
              const conversation = yield* Effect.promise(() =>
                harness.createConversation(
                  {
                    ownership: { kind: "ownerless" },
                    agent: { model: { provider: "faux", modelId: "faux-1" } },
                  },
                  BACKGROUND_CONTEXT,
                ),
              )
              const actor = yield* lab.beginRun({
                runId: "research",
                blockId: "block",
                missionId: "mission",
                role: "researcher",
                conversationId: String(conversation.id),
                environmentId,
              })
              yield* lab.startResearchBlock(
                actor.actor,
                chosen.nextObjective.objectiveId,
                DateTime.toEpochMillis(yield* DateTime.now) + 600000,
              )
              yield* Effect.promise(() =>
                conversation.submit(
                  {
                    type: "input",
                    content: "Investigate",
                    requestId: "research",
                  },
                  BACKGROUND_CONTEXT,
                ),
              )
              yield* Effect.promise(() => ready)
            }),
          )
          assert.isTrue((yield* lab.getLifecycle("mission")).recoveryRequired)
          if (missingRuntime) yield* fs.remove(database)
          yield* Effect.scoped(
            Effect.gen(function* () {
              yield* acquireRolePrograms({
                database,
                models,
                model: { provider: "faux", modelId: "faux-1" },
                environment: {
                  nodeBinary: process.execPath,
                  nodeModules: path.resolve("node_modules"),
                  workerDirectory: path.resolve(
                    "apps/biojev/platform/pi/execution-env",
                  ),
                  artifactDirectory: path.join(directory, "artifacts"),
                  workspaceRoot,
                  ...network,
                },
              })
              const blocks = yield* lab.getResearchBlocks("mission")
              assert.lengthOf(blocks, 1)
              assert.equal(blocks[0].blockId, "block")
              assert.equal(blocks[0].status, "FAILED")
              assert.equal(blocks[0].classification, "ORPHAN")
              assert.isFalse(
                (yield* lab.getLifecycle("mission")).recoveryRequired,
              )
              assert.isTrue(
                (yield* lab.getLifecycle("mission")).directorRequired,
              )
              assert.equal(
                (yield* lab.getLifecycle("mission")).countableBlocks,
                0,
              )
              assert.equal(executions, 1)
              assert.equal(faux.state.callCount, 1)
              assert.isFalse(yield* fs.exists(workspace))
              assert.isTrue(
                (yield* lab.searchMemory("mission", "recovery-failure")).some(
                  (record) => record.record.kind === "Failure",
                ),
              )
            }),
          )
        }).pipe(
          Effect.provide(BioLabLive(path.join(directory, "biojev.sqlite"))),
        ),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
  { timeout: 15000 },
)

it.live(
  "HTTP commands drive imported Pi, stream actual activity, and acknowledge pause/revision/stop after cleanup",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fs.makeTempDirectoryScoped()
      const network = yield* LinuxNetworkConfig
      const faux = fauxProvider()
      const models = createModels()
      models.setProvider(faux.provider)
      let started = () => {}
      let ended = 0
      const gate = () =>
        new Promise<void>((resolve) => {
          started = resolve
        })
      faux.setResponses(
        Array.from({ length: 10 }, () => (context, options) => {
          const user = context.messages
            .filter((message) => message.role === "user")
            .at(-1)
          if (user?.role !== "user" || typeof user.content !== "string")
            throw new Error("Missing mission input")
          const input = Schema.decodeSync(Schema.fromJsonString(Input))(
            user.content,
          )
          if (input.role === "director") {
            const {
              decisionId: _id,
              missionId: _mission,
              nextObjective,
              ...payload
            } = decision("", input.mission.missionId)
            const {
              objectiveId: _objective,
              missionId: _objectiveMission,
              originDirectorDecisionId: _decision,
              ...objective
            } = nextObjective
            return fauxAssistantMessage(
              fauxToolCall("submit_handoff", {
                ...payload,
                nextObjective: objective,
              }),
              { stopReason: "toolUse" },
            )
          }
          started()
          return new Promise<never>((_resolve, reject) => {
            const abort = () => {
              ended++
              reject(new Error("Pi aborted by human command"))
            }
            if (options?.signal?.aborted) abort()
            else
              options?.signal?.addEventListener("abort", abort, { once: true })
          })
        }),
      )
      yield* Effect.scoped(
        Effect.gen(function* () {
          const lab = yield* BioLab
          const roles = yield* acquireRolePrograms({
            database: path.join(directory, "pi.sqlite"),
            models,
            model: { provider: "faux", modelId: "faux-1" },
            environment: {
              nodeBinary: process.execPath,
              nodeModules: path.resolve("node_modules"),
              workerDirectory: path.resolve(
                "apps/biojev/platform/pi/execution-env",
              ),
              artifactDirectory: path.join(directory, "artifacts"),
              workspaceRoot: path.join(directory, "workspaces"),
              ...network,
            },
          })
          const commands = yield* acquireMissionLoop({
            ...roles,
            genesis: (missionId: string) =>
              lab.recordGenesisDiscovery(discoveredMap(missionId)),
          })
          const server = HttpRouter.serve(
            makeMissionRoutes(lab, commands, roles.activity),
            { disableListenLog: true },
          ).pipe(Layer.provideMerge(NodeHttpServer.layerTest))
          const client = Context.get(
            yield* Layer.build(server),
            HttpClient.HttpClient,
          )
          const post = (url: string, body: unknown) =>
            client.execute(
              HttpClientRequest.post(url).pipe(
                HttpClientRequest.bodyText(
                  JSON.stringify(body),
                  "application/json",
                ),
              ),
            )
          const command = Effect.fn(function* (body: unknown) {
            const response = yield* post("/api/missions/mission/commands", body)
            assert.equal(response.status, 200)
            return yield* Schema.decodeUnknownEffect(Mission)(
              yield* response.json,
            )
          })
          let ready = gate()
          const created = yield* post("/api/missions", {
            missionId: "mission",
            statement: "Investigate a source agnostic computational question",
          })
          assert.equal(created.status, 201)
          yield* Effect.promise(() => ready)
          const observed = yield* client.get("/api/missions/mission")
          const snapshot = yield* Schema.decodeUnknownEffect(
            MissionSnapshotView,
          )(yield* observed.json)
          const projected = snapshot.activity
          const firstHistoryResponse = yield* client.get(
            "/api/missions/mission/history?limit=1",
          )
          const firstHistory = yield* Schema.decodeUnknownEffect(HistoryView)(
            yield* firstHistoryResponse.json,
          )
          assert.lengthOf(firstHistory.records, 1)
          assert.isNotNull(firstHistory.next)
          assert.isTrue(
            projected.some((run) => run.state === "ACTIVE" && run.modelActive),
          )
          assert.doesNotThrow(() => JSON.stringify(projected))
          const stream = yield* client.get("/api/missions/mission/events")
          const frames = yield* stream.stream.pipe(
            Stream.take(1),
            Stream.runCollect,
          )
          assert.match(
            new TextDecoder().decode(frames[0]),
            /"modelActive":true/,
          )
          assert.equal((yield* command({ action: "pause" })).status, "PAUSED")
          assert.equal(ended, 1)
          const initial = (yield* lab.getResearchBlocks("mission"))[0]
          assert.equal(initial.status, "CANCELLED")
          assert.equal(initial.classification, "ORPHAN")
          ready = gate()
          yield* command({ action: "resume" })
          yield* Effect.promise(() => ready)
          ready = gate()
          const revised = yield* command({
            action: "revise",
            expectedRevision: 1,
            statement: "Investigate a different open computational question",
          })
          assert.equal(revised.revision, 2)
          assert.equal(ended, 2)
          yield* Effect.promise(() => ready)
          const stopped = yield* command({ action: "stop" })
          assert.equal(stopped.status, "STOPPED")
          assert.equal(ended, 3)
          const blocks = yield* lab.getResearchBlocks("mission")
          assert.lengthOf(blocks, 3)
          assert.isTrue(
            blocks.every(
              (block) =>
                block.classification === "ORPHAN" &&
                block.status === "CANCELLED",
            ),
          )
          assert.equal(blocks[0].deadline, initial.deadline)
          assert.equal((yield* lab.getLifecycle("mission")).countableBlocks, 0)
          assert.isFalse((yield* lab.getLifecycle("mission")).recoveryRequired)
          const resume = yield* post("/api/missions/mission/commands", {
            action: "resume",
          })
          assert.equal(resume.status, 409)
          assert.lengthOf(yield* lab.getMissionRevisions("mission"), 2)
          const laterResponse = yield* client.get(
            `/api/missions/mission/history?after=${firstHistory.cursor}`,
          )
          const later = yield* Schema.decodeUnknownEffect(HistoryView)(
            yield* laterResponse.json,
          )
          assert.isTrue(
            later.records.every(
              (record) => record.id !== firstHistory.records[0].id,
            ),
          )
          const emptyResponse = yield* client.get(
            `/api/missions/mission/history?after=${later.cursor}`,
          )
          const empty = yield* Schema.decodeUnknownEffect(HistoryView)(
            yield* emptyResponse.json,
          )
          assert.lengthOf(empty.records, 0)
          assert.equal(empty.cursor, later.cursor)
        }).pipe(
          Effect.provide(BioLabLive(path.join(directory, "biojev.sqlite"))),
        ),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
  { timeout: 15000 },
)
