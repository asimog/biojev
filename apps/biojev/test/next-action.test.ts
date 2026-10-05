import { describe, expect, it } from "vitest"
import { nextAction } from "../core/next-action.ts"

describe("nextAction", () => {
  it("requires Genesis before research but reconciles unfinished work first", () => {
    const state = {
      stopped: false,
      paused: false,
      recoveryRequired: false,
      genesisComplete: false,
      validationDue: false,
      validationCompletedAwaitingDirectorReview: false,
      directorRequired: true,
      objectiveReady: true,
    }
    expect(nextAction(state)).toBe("RUN_GENESIS")
    expect(nextAction({ ...state, recoveryRequired: true })).toBe("RECOVER")
    expect(nextAction({ ...state, paused: true })).toBe("WAIT")
    expect(nextAction({ ...state, stopped: true })).toBe("STOP")
  })
  it("stops before recovery, validation, or research", () => {
    expect(
      nextAction({
        genesisComplete: true,
        stopped: true,
        paused: true,
        recoveryRequired: true,
        validationDue: true,
        validationCompletedAwaitingDirectorReview: true,
        directorRequired: true,
        objectiveReady: true,
      }),
    ).toBe("STOP")
  })

  it("blocks all work while paused", () => {
    expect(
      nextAction({
        genesisComplete: true,
        stopped: false,
        paused: true,
        recoveryRequired: true,
        validationDue: true,
        validationCompletedAwaitingDirectorReview: true,
        directorRequired: true,
        objectiveReady: true,
      }),
    ).toBe("WAIT")
  })

  it("runs validation before a new research block", () => {
    expect(
      nextAction({
        genesisComplete: true,
        stopped: false,
        paused: false,
        recoveryRequired: false,
        validationDue: true,
        validationCompletedAwaitingDirectorReview: false,
        directorRequired: false,
        objectiveReady: true,
      }),
    ).toBe("RUN_VALIDATOR")
  })

  it("forces Director review after validation", () => {
    expect(
      nextAction({
        genesisComplete: true,
        stopped: false,
        paused: false,
        recoveryRequired: false,
        validationDue: false,
        validationCompletedAwaitingDirectorReview: true,
        directorRequired: false,
        objectiveReady: true,
      }),
    ).toBe("RUN_DIRECTOR")
  })
})
