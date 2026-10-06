import type { SemanticAnswer } from "./JevEngine.ts"

/** Deterministic semantic features, never scientific confidence or evidence. */
export const semanticFeatures = (
  answer: SemanticAnswer,
): Record<string, number> => {
  if (answer.type === "noul") {
    const p = answer.noul
    const entropy = [p, 1 - p].reduce(
      (sum, value) => (value === 0 ? sum : sum - value * Math.log2(value)),
      0,
    )
    return { probability_true: p, semantic_entropy_bits: entropy }
  }
  const features: Record<string, number> = {
    semantic_confidence: answer.confidence,
  }
  const values = Object.values(answer.probabilities)
  features.semantic_entropy_bits = values.reduce(
    (sum, value) => (value === 0 ? sum : sum - value * Math.log2(value)),
    0,
  )
  for (const [label, probability] of Object.entries(answer.probabilities))
    features[`probability_${label}`] = probability
  if (answer.type === "score") {
    const expected = Object.entries(answer.probabilities).reduce(
      (sum, [level, probability]) => sum + Number(level) * probability,
      0,
    )
    features.expected_level = expected
    features.semantic_variance = Object.entries(answer.probabilities).reduce(
      (sum, [level, probability]) =>
        sum + (Number(level) - expected) ** 2 * probability,
      0,
    )
  }
  return features
}
