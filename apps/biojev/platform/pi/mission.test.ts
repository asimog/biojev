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
import { NodeServices } from "@effect/platform-node"
import { assert, it } from "@effect/vitest"
import { DateTime, Effect, Fiber, FileSystem, Path, Schema } from "effect"
import { BioLab } from "../../biolab/BioLab.ts"
import { CanonicalRef } from "../../biolab/model/Domain.ts"
import { Operation } from "../../biolab/model/Recording.ts"
import { BioLabLive } from "../../biolab/SqliteLive.ts"
import { LinuxNetworkConfig } from "../../config/config.ts"
import { advanceMission } from "../../core/mission.ts"
import { acquireMissionLoop } from "../../core/mission-loop.ts"
import { decision, dossier, report } from "../../test/fixtures.ts"
import { acquireHarness } from "./harness.ts"
import { acquireRolePrograms } from "./roles.ts"

const Input = Schema.Struct({
  runId: Schema.String,
  role: Schema.Literals(["director", "researcher", "validator"]),
  mission: Schema.Struct({ missionId: Schema.String }),
  lifecycle: Schema.Struct({
    validation: Schema.optionalKey(
      Schema.Struct({ reportId: Schema.optionalKey(Schema.String) }),
    ),
  }),
})

it.live(
  "runs a real ten-block Pi/BioLab lifecycle, a fresh Validator, explicit Director review and the next Researcher",
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
        Array.from({ length: 45 }, () => (context) => {
          const user = context.messages
            .filter((message) => message.role === "user")
            .at(-1)
          if (user?.role !== "user" || typeof user.content !== "string")
            throw new Error("Expected institutional role input")
          const input = Schema.decodeSync(Schema.fromJsonString(Input))(
            user.content,
          )
          if (input.role === "director") {
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
          if (input.role === "researcher") {
            if (!computedRuns.has(input.runId))
              computedRuns.set(input.runId, computedRuns.size)
            const variant = computedRuns.get(input.runId) ?? 100
            const results = context.messages.filter(
              (message) => message.role === "toolResult",
            )
            for (const result of results)
              assert.isFalse(result.isError, JSON.stringify(result))
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
              scientificResultRefs,
              summary:
                variant < 2
                  ? "Retained actual outputs"
                  : "No obtained results in this investigation",
            })
          }
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
              ...network,
            },
          })
          yield* lab.createMission({
            missionId: "mission",
            statement: "Investigate an open computational question",
          })
          for (let block = 0; block < 10; block++) {
            assert.equal(
              yield* advanceMission("mission", roles),
              "RUN_DIRECTOR",
            )
            assert.equal(
              yield* advanceMission("mission", roles),
              "RUN_RESEARCHER",
            )
          }
          const due = yield* lab.getLifecycle("mission")
          assert.isTrue(due.validationDue)
          assert.equal(due.countableBlocks, 10)
          assert.equal(yield* advanceMission("mission", roles), "RUN_VALIDATOR")
          assert.isTrue((yield* lab.getLifecycle("mission")).validationDue)
          assert.equal((yield* lab.getLifecycle("mission")).countableBlocks, 10)
          assert.equal(yield* advanceMission("mission", roles), "RUN_VALIDATOR")
          const pending = yield* lab.getLifecycle("mission")
          assert.isTrue(pending.validationCompletedAwaitingDirectorReview)
          assert.isFalse(pending.objectiveReady)
          assert.equal(yield* advanceMission("mission", roles), "RUN_DIRECTOR")
          assert.isTrue(
            (yield* lab.getLifecycle("mission"))
              .validationCompletedAwaitingDirectorReview,
          )
          assert.isFalse((yield* lab.getLifecycle("mission")).objectiveReady)
          assert.equal(yield* advanceMission("mission", roles), "RUN_DIRECTOR")
          const reviewed = yield* lab.getLifecycle("mission")
          assert.equal(reviewed.countableBlocks, 0)
          assert.isFalse(reviewed.validationCompletedAwaitingDirectorReview)
          assert.equal(
            yield* advanceMission("mission", roles),
            "RUN_RESEARCHER",
          )
          const blocks = yield* lab.getResearchBlocks("mission")
          assert.lengthOf(blocks, 11)
          assert.isTrue(
            blocks.every(
              (block) =>
                ["COMPLETED", "COMPLETED_NO_RESULTS"].includes(block.status) &&
                block.classification === "COUNTABLE",
            ),
          )
          assert.equal((yield* lab.getLifecycle("mission")).countableBlocks, 1)
          assert.equal(
            blocks.filter((block) => block.status === "COMPLETED").length,
            2,
          )
          const runs = yield* lab.getRuns("mission")
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
            11,
          )
          assert.lengthOf(validators, 2)
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
          assert.equal(yield* advanceMission("mission", roles), "STOP")
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
  "application commands drive Pi work and acknowledge pause/revision/stop after cleanup",
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
          const commands = yield* acquireMissionLoop(roles)
          let ready = gate()
          yield* commands.start({
            missionId: "mission",
            statement: "Investigate a source agnostic computational question",
          })
          yield* Effect.promise(() => ready)
          assert.equal((yield* commands.pause("mission")).status, "PAUSED")
          assert.equal(ended, 1)
          const initial = (yield* lab.getResearchBlocks("mission"))[0]
          assert.equal(initial.status, "CANCELLED")
          assert.equal(initial.classification, "ORPHAN")
          ready = gate()
          yield* commands.resume("mission")
          yield* Effect.promise(() => ready)
          ready = gate()
          const revised = yield* commands.revise({
            missionId: "mission",
            expectedRevision: 1,
            statement: "Investigate a different open computational question",
          })
          assert.equal(revised.revision, 2)
          assert.equal(ended, 2)
          yield* Effect.promise(() => ready)
          const stopped = yield* commands.stop("mission")
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
          const resume = yield* commands.resume("mission").pipe(Effect.flip)
          assert.equal(resume.code, "CONFLICT")
          assert.lengthOf(yield* lab.getMissionRevisions("mission"), 2)
        }).pipe(
          Effect.provide(BioLabLive(path.join(directory, "biojev.sqlite"))),
        ),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
  { timeout: 15000 },
)
