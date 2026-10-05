import { Effect } from "effect"
import { BioLab, BioLabError } from "../biolab/BioLab.ts"
import { type NextAction, nextAction } from "./next-action.ts"

// Programs are supplied by application composition. Core chooses legal work only.
export const advanceMission = Effect.fn("Core.advanceMission")(function* <E, R>(
  missionId: string,
  programs: {
    readonly director: (missionId: string) => Effect.Effect<unknown, E, R>
    readonly researcher: (missionId: string) => Effect.Effect<unknown, E, R>
    readonly validator: (missionId: string) => Effect.Effect<unknown, E, R>
  },
): Effect.fn.Return<NextAction, E | BioLabError, R | BioLab> {
  const lab = yield* BioLab
  const state = yield* lab.getLifecycle(missionId)
  const action = nextAction({
    ...state,
    stopped: state.mission.status === "STOPPED",
    paused: state.mission.status === "PAUSED",
  })
  switch (action) {
    case "RUN_DIRECTOR":
      yield* programs.director(missionId)
      break
    case "RUN_RESEARCHER":
      yield* programs.researcher(missionId)
      break
    case "RUN_VALIDATOR":
      yield* programs.validator(missionId)
      break
    case "RECOVER":
      return yield* new BioLabError({
        code: "CONFLICT",
        operation: "advanceMission",
        message: "Unfinished work must be reconciled before scheduling",
      })
  }
  return action
})
