import type { ResearchBlock } from "../../biolab/model/Lifecycle.ts"

/** Adapt resource limits from retained timeouts, never from scientific scores. */
export const roleBudgetMs = (
  initialMs: number,
  maximumMs: number | undefined,
  blocks: ReadonlyArray<Pick<ResearchBlock, "status">>,
): number =>
  maximumMs === undefined
    ? initialMs
    : Math.min(
        maximumMs,
        initialMs +
          blocks.filter((block) => block.status === "TIMED_OUT").length *
            60_000,
      )
