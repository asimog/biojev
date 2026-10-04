export type NextAction =
  | "WAIT"
  | "RECOVER"
  | "RUN_DIRECTOR"
  | "RUN_RESEARCH_BLOCK"
  | "RUN_VALIDATION"

export interface MissionLifecycleState {
  readonly paused: boolean
  readonly recoveryRequired: boolean
  readonly validationDue: boolean
  readonly validationCompletedAwaitingDirectorReview: boolean
  readonly directorRequired: boolean
  readonly objectiveReady: boolean
}

/**
 * Pure deterministic lifecycle policy.
 *
 * It decides WHEN work may happen. It does not decide scientific strategy.
 */
export const nextAction = (state: MissionLifecycleState): NextAction => {
  if (state.paused) return "WAIT"
  if (state.recoveryRequired) return "RECOVER"
  if (state.validationDue) return "RUN_VALIDATION"
  if (state.validationCompletedAwaitingDirectorReview) return "RUN_DIRECTOR"
  if (state.directorRequired) return "RUN_DIRECTOR"
  if (state.objectiveReady) return "RUN_RESEARCH_BLOCK"
  return "WAIT"
}
