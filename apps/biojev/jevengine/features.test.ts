import { assert, describe, it } from "vitest"
import { semanticFeatures } from "./features.ts"

describe("semantic features", () => {
  it("keeps probability endpoints finite and measures semantic uncertainty", () => {
    assert.deepEqual(semanticFeatures({ type: "noul", noul: 0 }), {
      probability_true: 0,
      semantic_entropy_bits: 0,
    })
    assert.equal(
      semanticFeatures({ type: "noul", noul: 0.5 }).semantic_entropy_bits,
      1,
    )
  })
  it("derives expected rubric level and variance without treating confidence as scientific confidence", () => {
    const features = semanticFeatures({
      type: "score",
      score: 0.75,
      confidence: 0.8,
      legend: { "0": "Absent", "1": "Present" },
      probabilities: { "0": 0.25, "1": 0.75 },
    })
    assert.equal(features.expected_level, 0.75)
    assert.equal(features.semantic_variance, 0.1875)
    assert.equal(features.probability_0, 0.25)
    assert.equal(features.semantic_confidence, 0.8)
  })
})
