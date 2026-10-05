import { Cause, Effect, Exit, Fiber, Queue, Semaphore } from "effect"
import { BioLab, type BioLabError } from "../biolab/BioLab.ts"
import type { CreateMission, ReviseMission } from "../biolab/model/Mission.ts"
import { advanceMission } from "./mission.ts"
import type { NextAction } from "./next-action.ts"

export const acquireMissionLoop = Effect.fn("Core.acquireMissionLoop")(
  function* <E, R>(programs: {
    readonly genesis?: (missionId: string) => Effect.Effect<unknown, E, R>
    readonly director: (missionId: string) => Effect.Effect<unknown, E, R>
    readonly researcher: (missionId: string) => Effect.Effect<unknown, E, R>
    readonly validator: (missionId: string) => Effect.Effect<unknown, E, R>
  }) {
    const lab = yield* BioLab
    const scope = yield* Effect.scope
    const admission = yield* Semaphore.make(1)
    const wake = yield* Queue.make<void>({ capacity: 1, strategy: "sliding" })
    let active:
      | { missionId: string; fiber: Fiber.Fiber<NextAction, E | BioLabError> }
      | undefined
    let lastMission: string | undefined
    const wakeScheduler = Queue.offer(wake, undefined)
    const loop = Effect.gen(function* () {
      while (true) {
        const selected = yield* admission.withPermit(
          Effect.uninterruptible(
            Effect.gen(function* () {
              const missions = (yield* lab.listMissions).filter(
                (mission) => mission.status === "RUNNING",
              )
              if (missions.length === 0) return undefined
              const previous = missions.findIndex(
                (mission) => mission.missionId === lastMission,
              )
              const mission = missions[(previous + 1) % missions.length]
              const fiber = yield* advanceMission(
                mission.missionId,
                programs,
              ).pipe(Effect.interruptible, Effect.forkIn(scope))
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
          return yield* Effect.failCause(outcome.cause)
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
    }
  },
)
