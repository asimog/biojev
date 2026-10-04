import { describe, expect, it } from "vitest"
import { nextAction } from "../core/next-action.ts"

describe("nextAction", () => {
  it("blocks all work while paused", () => {
    expect(
      nextAction({
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
        paused: false,
        recoveryRequired: false,
        validationDue: true,
        validationCompletedAwaitingDirectorReview: false,
        directorRequired: false,
        objectiveReady: true,
      }),
    ).toBe("RUN_VALIDATION")
  })

  it("forces Director review after validation", () => {
    expect(
      nextAction({
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
