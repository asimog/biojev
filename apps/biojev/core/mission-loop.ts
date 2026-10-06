import { Cause, Effect, Exit, Fiber, Queue, Semaphore } from "effect"
import { BioLab, type BioLabError } from "../biolab/BioLab.ts"
import type { CreateMission, ReviseMission } from "../biolab/model/Mission.ts"
import { advanceMission } from "./mission.ts"
import { type NextAction, nextAction } from "./next-action.ts"

export const acquireMissionLoop = Effect.fn("Core.acquireMissionLoop")(
  function* <E, R, GE = E, GR = R>(
    programs: {
      readonly genesis?: (missionId: string) => Effect.Effect<unknown, GE, GR>
      readonly director: (missionId: string) => Effect.Effect<unknown, E, R>
      readonly researcher: (missionId: string) => Effect.Effect<unknown, E, R>
      readonly validator: (missionId: string) => Effect.Effect<unknown, E, R>
    },
    enabled = true,
  ) {
    const lab = yield* BioLab
    const scope = yield* Effect.scope
    const admission = yield* Semaphore.make(1)
    const wake = yield* Queue.make<void>({ capacity: 1, strategy: "sliding" })
    let active:
      | {
          missionId: string
          fiber: Fiber.Fiber<NextAction, E | GE | BioLabError>
        }
      | undefined
    let lastMission: string | undefined
    const failures = new Map<string, string>()
    const wakeScheduler = Queue.offer(wake, undefined)
    const loop = Effect.gen(function* () {
      while (true) {
        const selected = yield* admission.withPermit(
          Effect.uninterruptible(
            Effect.gen(function* () {
              const missions = (yield* lab.listMissions).filter(
                (mission) =>
                  enabled &&
                  mission.status === "RUNNING" &&
                  !failures.has(mission.missionId),
              )
              if (missions.length === 0) return undefined
              const previous = missions.findIndex(
                (mission) => mission.missionId === lastMission,
              )
              const mission = missions[(previous + 1) % missions.length]
              const fiber = yield* Effect.gen(function* () {
                const before = yield* lab.getGenesis(mission.missionId)
                const action = yield* advanceMission(
                  mission.missionId,
                  programs,
                )
                const state = yield* lab.getLifecycle(mission.missionId)
                const next = nextAction({
                  ...state,
                  paused: state.mission.status === "PAUSED",
                  stopped: state.mission.status === "STOPPED",
                })
                const genesis = yield* lab.getGenesis(mission.missionId)
                if (
                  ((action === "RUN_DIRECTOR" || action === "RUN_VALIDATOR") &&
                    next === action) ||
                  (action === "RUN_GENESIS" &&
                    (genesis === null ||
                      genesis?.status === "FAILED" ||
                      (before?.status === "READY_FOR_DIRECTION" &&
                        before.missionRevision === state.mission.revision &&
                        next === "RUN_GENESIS")))
                )
                  failures.set(
                    mission.missionId,
                    "Required lifecycle handoff was not retained. Inspect recorded failures and retry the mission.",
                  )
                return action
              }).pipe(Effect.interruptible, Effect.forkIn(scope))
              active = { missionId: mission.missionId, fiber }
              lastMission = mission.missionId
              return active
            }),
          ),
        )
        if (selected === undefined) {
          yield* Queue.take(wake)
          continue
        }
        const outcome = yield* Effect.exit(Fiber.join(selected.fiber))
        yield* admission.withPermit(
          Effect.sync(() => {
            active = undefined
          }),
        )
        if (Exit.isFailure(outcome) && !Cause.hasInterrupts(outcome.cause))
          failures.set(
            selected.missionId,
            "Scheduling failed. Inspect retained failures and retry after correcting configuration.",
          )
        else if (Exit.isSuccess(outcome) && outcome.value === "WAIT")
          yield* Queue.take(wake)
      }
    })
    const worker = yield* loop.pipe(Effect.forkScoped)
    const change = Effect.fn("Core.missionCommand")(function* (
      missionId: string,
      operation: Effect.Effect<unknown, BioLabError>,
      interrupt: boolean,
    ) {
      return yield* Effect.uninterruptible(
        Effect.gen(function* () {
          const owned = yield* admission.withPermit(
            Effect.gen(function* () {
              yield* operation
              failures.delete(missionId)
              return active?.missionId === missionId ? active.fiber : undefined
            }),
          )
          if (interrupt && owned !== undefined) yield* Fiber.interrupt(owned)
          yield* wakeScheduler
          return yield* lab.getMission(missionId)
        }),
      )
    })
    return {
      start: (input: CreateMission) =>
        change(input.missionId, lab.createMission(input), false),
      pause: (missionId: string) =>
        change(missionId, lab.setMissionStatus(missionId, "PAUSED"), true),
      resume: (missionId: string) =>
        change(missionId, lab.setMissionStatus(missionId, "RUNNING"), false),
      stop: (missionId: string) =>
        change(missionId, lab.setMissionStatus(missionId, "STOPPED"), true),
      revise: (input: ReviseMission) =>
        change(input.missionId, lab.reviseMission(input), true),
      wait: Fiber.join(worker),
      state: Effect.sync(() => ({
        enabled,
        activeMissionId: active?.missionId ?? null,
        failures: Object.fromEntries(failures),
      })),
    }
  },
)
