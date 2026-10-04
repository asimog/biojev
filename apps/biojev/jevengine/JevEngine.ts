import { Context, type Effect, Schema } from "effect"
import type { CanonicalRef } from "../agents/contracts.ts"

export class JevEngineError extends Schema.TaggedError<JevEngineError>()(
  "JevEngineError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
) {}

export interface SemanticMeasurement {
  readonly measurementId: string
  readonly primitive: "measure" | "compare" | "classify" | "score"
  readonly question: string
  readonly subjectRefs: ReadonlyArray<CanonicalRef>
  readonly answer: unknown
  readonly modelIdentity?: string
  readonly receipt?: unknown
}

/**
 * Jev measures semantic properties. Agents decide what the measurements mean
 * for research strategy.
 */
export class JevEngine extends Context.Service<
  JevEngine,
  {
    readonly measure: (
      question: string,
      subjectRefs: ReadonlyArray<CanonicalRef>,
    ) => Effect.Effect<SemanticMeasurement, JevEngineError>

    readonly compare: (
      question: string,
      subjectRefs: ReadonlyArray<CanonicalRef>,
    ) => Effect.Effect<SemanticMeasurement, JevEngineError>

    readonly classify: (
      question: string,
      subjectRefs: ReadonlyArray<CanonicalRef>,
    ) => Effect.Effect<SemanticMeasurement, JevEngineError>

    readonly score: (
      question: string,
      subjectRefs: ReadonlyArray<CanonicalRef>,
    ) => Effect.Effect<SemanticMeasurement, JevEngineError>
  }
>()("BioJev/JevEngine") {}
