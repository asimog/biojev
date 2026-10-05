export type NextAction =
  | "STOP"
  | "WAIT"
  | "RECOVER"
  | "RUN_GENESIS"
  | "RUN_DIRECTOR"
  | "RUN_RESEARCHER"
  | "RUN_VALIDATOR"

export interface MissionLifecycleState {
  readonly stopped: boolean
  readonly paused: boolean
  readonly genesisComplete: boolean
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
  if (state.stopped) return "STOP"
  if (state.paused) return "WAIT"
  if (state.recoveryRequired) return "RECOVER"
  if (!state.genesisComplete) return "RUN_GENESIS"
  if (state.validationDue) return "RUN_VALIDATOR"
  if (state.validationCompletedAwaitingDirectorReview) return "RUN_DIRECTOR"
  if (state.directorRequired) return "RUN_DIRECTOR"
  if (state.objectiveReady) return "RUN_RESEARCHER"
  return "WAIT"
}
