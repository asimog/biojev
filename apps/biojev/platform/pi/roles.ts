import {
  BACKGROUND_CONTEXT,
  withAbortSignal,
} from "@earendil-works/chord/context"
import type { Models } from "@earendil-works/pi-ai"
import {
  type Conversation,
  type Cursor,
  createRegistry,
  LiveDoc,
  type ModelRef,
  UsageDoc,
} from "@earendil-works/pi-durable"
import { CodingTools } from "@earendil-works/pi-durable/tools"
import { Cause, DateTime, Effect, Exit, Schema } from "effect"
import { BioLab } from "../../biolab/BioLab.ts"
import type { FinishBlock } from "../../biolab/model/Lifecycle.ts"
import type { ExecutionAuthority } from "../../biolab/model/Recording.ts"
import { OpenRouterKey, OpenRouterModelConfig } from "../../config/config.ts"
import type { JevEngine } from "../../jevengine/JevEngine.ts"
import {
  acquireLinuxEnvironment,
  type LinuxOptions,
} from "./execution-env/Linux.ts"
import { acquireHarness } from "./harness.ts"
import { createResearchModels } from "./models.ts"
import { makeBioLabTools, persistOperation } from "./tools.ts"

export class PiRoleError extends Schema.TaggedError<PiRoleError>()(
  "PiRoleError",
  {
    role: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
) {}
type Role = "director" | "researcher" | "validator"
const instructions: Record<Role, string> = {
  director:
    "You are BioJev's persistent Director. Choose what investigation is most valuable next. Researcher chooses its method. Inspect BioLab history and pending Validator criticism. Submit one bounded objective and strategic rationale with submit_handoff. Cite the pending ValidationReport explicitly. Do not end the mission, spawn agents, prescribe a scientific procedure, or invent results.",
  researcher:
    "You are a fresh Researcher for one bounded objective. Choose and change sources, representations, methods, languages and action order freely. Use coding tools inside your controlled environment and retrieve institutional history as useful. Record obtained outputs through their actual receipts, retain useful artifacts, and distinguish interpretation from result. Preserve failures, negative results and missingness. Submit an honest dossier with submit_handoff; no obtained results is valid. Do not redirect the mission, fabricate execution, or spawn agents.",
  validator:
    "You are a fresh independent Validator for the exact ten countable ResearchBlocks provided. Critique search, computation, semantic judgment, memory, learning and tunnel vision. Retrieve retained history, rerun computations or try alternative methods as useful in your clean environment. Submit your independent report with submit_handoff. Inform Director; do not choose the next objective, activate defaults, rewrite hypotheses/history, or spawn agents.",
}

const promise = <A>(role: Role, work: (signal: AbortSignal) => Promise<A>) =>
  Effect.tryPromise({
    try: work,
    catch: (cause) =>
      new PiRoleError({ role, message: "Pi role operation failed", cause }),
  })

export const acquireRolePrograms = Effect.fn("Pi.acquireRolePrograms")(
  function* (
    options: {
      readonly database: string
      readonly environment: LinuxOptions
      readonly blockTimeoutMs?: number
      readonly jev?: JevEngine["Service"]
    } & (
      | { readonly models: Models; readonly model: ModelRef }
      | {
          readonly models?: never
          readonly model?: never
        }
    ),
  ) {
    const lab = yield* BioLab
    const selection = yield* OpenRouterModelConfig
    const models =
      options.models ?? createResearchModels(yield* OpenRouterKey, selection)
    const model = options.model ?? {
      provider: "openrouter",
      modelId: selection.modelId,
    }
    const registry = createRegistry()
    const environments = new Map<
      string,
      Effect.Success<ReturnType<typeof acquireLinuxEnvironment>>
    >()
    const harness = yield* acquireHarness(options.database, {
      models,
      registry,
      env: async (target) =>
        environments.get(String(target.conversationId))?.env,
    })
    const findConversation = async (id: string) => {
      const stored = await harness.commit(async (tx) => {
        let cursor: Cursor | undefined
        do {
          const page = await tx.scanConversations({}, 100, cursor)
          const found = page.items.find(
            (conversation) => String(conversation.id) === id,
          )
          if (found !== undefined) return found
          cursor = page.next
        } while (cursor !== undefined)
        return undefined
      }, BACKGROUND_CONTEXT)
      return stored === undefined
        ? undefined
        : harness.conversation(stored.id, BACKGROUND_CONTEXT)
    }

    // Abort marks are admitted before enabling upstream scheduling. No pending
    // external operation is replayed to guess whether it completed.
    const inspection = yield* promise("director", () =>
      harness.inspect(BACKGROUND_CONTEXT),
    )
    yield* promise("director", async () => {
      for (const task of inspection.tasks)
        await harness.abortTask(task.record.id, BACKGROUND_CONTEXT)
      const conversations = new Set(
        inspection.submissions.map((submission) => submission.conversationId),
      )
      for (const task of inspection.tasks)
        conversations.add(task.record.conversationId)
      for (const id of conversations) {
        const conversation = await harness.conversation(id, BACKGROUND_CONTEXT)
        await conversation?.abort(BACKGROUND_CONTEXT, { background: true })
        await conversation?.waitForIdle(BACKGROUND_CONTEXT)
      }
    })
    for (const mission of yield* lab.listMissions) {
      for (const run of (yield* lab.getRuns(mission.missionId)).filter(
        (run) => run.status === "ACTIVE",
      )) {
        yield* Effect.scoped(
          Effect.gen(function* () {
            const resource = yield* acquireLinuxEnvironment({
              ...options.environment,
              environmentId: run.environmentId,
            })
            yield* promise(run.role, () =>
              resource.env.cleanup(BACKGROUND_CONTEXT),
            )
            const actor = yield* lab.reopenRun(run.runId)
            const reason =
              "Recovered interrupted runtime work without replay; available canonical records retained"
            yield* lab.recordFailure(actor.actor, {
              failureId: `${run.runId}:recovery-failure`,
              originRunId: run.runId,
              summary: reason,
              basisRefs: [],
            })
            if (run.role === "researcher") {
              const block = (yield* lab.getResearchBlocks(
                mission.missionId,
              )).find((block) => block.runId === run.runId)
              if (block !== undefined && block.classification === "PENDING") {
                const now = DateTime.toEpochMillis(yield* DateTime.now)
                yield* lab.finishResearchBlock({
                  blockId: block.blockId,
                  status:
                    mission.status !== "RUNNING"
                      ? "CANCELLED"
                      : now >= block.deadline
                        ? "TIMED_OUT"
                        : "FAILED",
                  reason,
                })
              } else yield* lab.settleRun(run.runId)
            } else if (run.role === "validator") {
              const state = yield* lab.getLifecycle(mission.missionId)
              if (state.validation?.runId === run.runId)
                yield* lab.finishValidation(actor.actor, reason)
              else yield* lab.settleRun(run.runId)
            } else yield* lab.settleRun(run.runId)
          }),
        )
      }
    }

    const runRole = Effect.fn("Pi.runRole")(function* (
      missionId: string,
      role: Role,
    ) {
      return yield* Effect.scoped(
        Effect.uninterruptibleMask((restore) =>
          Effect.gen(function* () {
            const mission = yield* lab.getMission(missionId)
            const before = yield* lab.getLifecycle(missionId)
            if (mission.status !== "RUNNING" || before.recoveryRequired)
              return yield* new PiRoleError({
                role,
                message: "Mission is not ready for new role work",
              })
            if (
              (role === "researcher" && !before.objectiveReady) ||
              (role === "validator" && !before.validationDue) ||
              (role === "director" &&
                (!before.directorRequired || before.validationDue))
            )
              return yield* new PiRoleError({
                role,
                message: "Role is not legally allowed next",
              })
            let execution: ExecutionAuthority | undefined
            const resource = yield* acquireLinuxEnvironment({
              ...options.environment,
              onReceipt: (receipt) =>
                execution === undefined
                  ? Effect.die("Run execution authority is absent")
                  : persistOperation(lab, execution)(receipt),
            })
            let conversation: Conversation | undefined
            if (role === "director") {
              const previous = (yield* lab.getRuns(missionId))
                .filter((run) => run.role === "director")
                .at(-1)
              if (previous !== undefined)
                conversation = yield* promise(role, () =>
                  findConversation(previous.conversationId),
                )
            }
            if (conversation === undefined)
              conversation = yield* promise(role, () =>
                harness.createConversation(
                  { ownership: { kind: "ownerless" } },
                  BACKGROUND_CONTEXT,
                ),
              )
            const owned = conversation
            const runId = crypto.randomUUID()
            const blockId =
              role === "director" ? undefined : crypto.randomUUID()
            const actor = yield* lab.beginRun(
              {
                runId,
                missionId,
                role,
                conversationId: String(owned.id),
                environmentId: resource.env.id,
                ...(blockId === undefined ? {} : { blockId }),
              },
              mission.revision,
            )
            execution = actor.execution
            environments.set(String(owned.id), resource)
            let terminal: FinishBlock["status"] = "FAILED"
            let reason = "Pi did not retain the required handoff"
            let initialized = false
            let extension:
              | Effect.Success<ReturnType<typeof makeBioLabTools>>
              | undefined
            yield* Effect.addFinalizer((exit) =>
              Effect.gen(function* () {
                if (Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)) {
                  terminal = "CANCELLED"
                  reason = "Application work interrupted"
                }
                const cleanup = yield* Effect.exit(
                  promise(role, async () => {
                    await owned.abort(BACKGROUND_CONTEXT, { background: true })
                    await owned.waitForIdle(BACKGROUND_CONTEXT)
                    await resource.env.cleanup(BACKGROUND_CONTEXT)
                  }),
                )
                if (Exit.isFailure(cleanup)) {
                  if (
                    blockId !== undefined &&
                    role === "researcher" &&
                    initialized
                  )
                    yield* lab
                      .markRecoveryRequired(
                        blockId,
                        Cause.pretty(cleanup.cause),
                      )
                      .pipe(Effect.orDie)
                  return yield* Effect.die(cleanup.cause)
                }
                const currentMission = yield* lab
                  .getMission(missionId)
                  .pipe(Effect.orDie)
                if (currentMission.status !== "RUNNING") {
                  terminal = "CANCELLED"
                  reason = `Human ${currentMission.status.toLowerCase()}`
                }
                if (
                  terminal === "FAILED" ||
                  terminal === "TIMED_OUT" ||
                  terminal === "CANCELLED"
                )
                  yield* lab
                    .recordFailure(actor.actor, {
                      failureId: `${runId}:failure`,
                      originRunId: runId,
                      summary: reason,
                      basisRefs: [],
                    })
                    .pipe(Effect.orDie)
                if (
                  role === "researcher" &&
                  blockId !== undefined &&
                  initialized
                ) {
                  yield* lab
                    .finishResearchBlock({ blockId, status: terminal, reason })
                    .pipe(Effect.orDie)
                } else if (role === "validator" && initialized) {
                  yield* lab
                    .finishValidation(actor.actor, reason)
                    .pipe(Effect.orDie)
                } else yield* lab.settleRun(runId).pipe(Effect.orDie)
                environments.delete(String(owned.id))
                if (extension !== undefined) registry.uninstall(extension)
              }),
            )
            const now = DateTime.toEpochMillis(yield* DateTime.now)
            const timeout = options.blockTimeoutMs ?? 600000
            if (role === "researcher") {
              yield* lab.startResearchBlock(
                actor.actor,
                before.objectiveId ?? "",
                now + timeout,
              )
            } else if (role === "validator")
              yield* lab.startValidation(actor.actor)
            initialized = true
            extension = yield* makeBioLabTools({
              ...actor,
              environment: resource,
              ...(options.jev === undefined ? {} : { jev: options.jev }),
            })
            registry.install(extension)
            yield* promise(role, () =>
              owned.configure(
                {
                  model,
                  instructions: instructions[role],
                  cwd: "/work",
                  extensions: [CodingTools, extension].filter(
                    (entry) => entry !== undefined,
                  ),
                },
                BACKGROUND_CONTEXT,
              ),
            )
            const context = {
              mission,
              role,
              runId,
              blockId,
              lifecycle: before,
              ...(role !== "researcher" || before.objectiveId === undefined
                ? {}
                : {
                    objective: yield* lab.getRecord({
                      kind: "ResearchObjective",
                      id: before.objectiveId,
                    }),
                  }),
              ...(before.validation?.reportId === undefined
                ? {}
                : {
                    validationReport: yield* lab.getRecord({
                      kind: "ValidationReport",
                      id: before.validation.reportId,
                    }),
                  }),
              ...(role !== "validator"
                ? {}
                : {
                    trajectory: (yield* lab.getResearchBlocks(
                      missionId,
                    )).filter((block) =>
                      before.validation?.blockIds.includes(block.blockId),
                    ),
                  }),
            }
            const outcome = yield* Effect.exit(
              restore(
                promise(role, async (signal) => {
                  const chord = withAbortSignal(signal, BACKGROUND_CONTEXT)
                  const submission = await owned.submit(
                    {
                      type: "input",
                      content: JSON.stringify(context),
                      requestId: runId,
                    },
                    chord,
                  )
                  await submission.wait(chord)
                  await owned.waitForIdle(chord)
                }).pipe(Effect.timeout(timeout)),
              ),
            )
            if (Exit.isFailure(outcome)) {
              terminal = Cause.hasInterrupts(outcome.cause)
                ? "CANCELLED"
                : Cause.isTimeoutError(Cause.squash(outcome.cause))
                  ? "TIMED_OUT"
                  : "FAILED"
              reason = Cause.pretty(outcome.cause)
            } else {
              const completion = yield* lab.getRunCompletion(runId)
              if (completion.handoffRetained) {
                terminal = completion.hasScientificResults
                  ? "COMPLETED"
                  : "COMPLETED_NO_RESULTS"
                reason =
                  "Required handoff retained; Pi work settled and environment cleanup requested"
              }
            }
            return {
              role,
              runId,
              conversationId: String(owned.id),
              blockId,
            }
          }),
        ),
      )
    })
    const activity = Effect.fn("Pi.activity")(function* (missionId: string) {
      const runs = yield* lab.getRuns(missionId)
      const recent = runs.slice(-20)
      return yield* Effect.forEach(recent, (run) =>
        promise(run.role, async () => {
          const conversation = await findConversation(run.conversationId)
          if (conversation === undefined)
            return {
              runId: run.runId,
              role: run.role,
              state: run.status,
              runtimeAvailable: false,
            }
          return conversation.commit(async (tx) => {
            const live = await tx.doc(LiveDoc, conversation.id)
            const usage = await tx.doc(UsageDoc, conversation.id)
            return {
              runId: run.runId,
              role: run.role,
              blockId: run.blockId ?? null,
              state: run.status,
              startedAt: run.createdAt,
              runtimeAvailable: true,
              modelActive:
                run.status === "ACTIVE" && live?.generation !== undefined,
              tools:
                run.status === "ACTIVE"
                  ? (live?.tools ?? []).map((tool) => ({
                      name: tool.name,
                      status: tool.status,
                      output: tool.output ?? null,
                      diagnostics: tool.diagnostics ?? [],
                    }))
                  : [],
              usage: usage ?? null,
            }
          }, BACKGROUND_CONTEXT)
        }),
      )
    })
    return {
      director: (missionId: string) => runRole(missionId, "director"),
      researcher: (missionId: string) => runRole(missionId, "researcher"),
      validator: (missionId: string) => runRole(missionId, "validator"),
      activity,
    }
  },
)
