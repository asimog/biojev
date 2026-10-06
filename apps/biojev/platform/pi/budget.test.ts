import { assert, it } from "vitest"
import { roleBudgetMs } from "./budget.ts"

it("adapts retained timeouts up to the configured cap without counting success or cancellation", () => {
  assert.equal(roleBudgetMs(120_000, 300_000, []), 120_000)
  assert.equal(
    roleBudgetMs(120_000, 300_000, [{ status: "TIMED_OUT" }]),
    180_000,
  )
  assert.equal(
    roleBudgetMs(120_000, 300_000, [
      { status: "COMPLETED" },
      { status: "CANCELLED" },
    ]),
    120_000,
  )
  assert.equal(
    roleBudgetMs(
      120_000,
      300_000,
      Array.from({ length: 20 }, () => ({ status: "TIMED_OUT" as const })),
    ),
    300_000,
  )
  assert.equal(roleBudgetMs(5000, undefined, [{ status: "TIMED_OUT" }]), 5000)
})
