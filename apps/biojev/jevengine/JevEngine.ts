import { Context, type Effect, Schema } from "effect"
import { CanonicalRef } from "../agents/contracts.ts"

export class JevEngineError extends Schema.TaggedError<JevEngineError>()(
  "JevEngineError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
) {}

const Entry = Schema.Union([
  Schema.String,
  Schema.JsonObject,
  Schema.Array(Schema.Json),
  Schema.Null,
])
export const SemanticQuestion = Schema.Struct({
  questionId: Schema.NonEmptyString,
  questionVersion: Schema.NonEmptyString,
  originRunId: Schema.NonEmptyString,
  subjectRefs: Schema.Array(CanonicalRef),
  projection: Schema.Struct({
    identity: Schema.NonEmptyString,
    version: Schema.NonEmptyString,
    value: Schema.Json,
  }),
  question: Schema.Union([
    Schema.Struct({
      type: Schema.Literal("noul"),
      instructions: Schema.NonEmptyString,
    }),
    Schema.Struct({
      type: Schema.Literal("choice"),
      instructions: Schema.NonEmptyString,
      criteria: Schema.Record(Schema.NonEmptyString, Entry).check(
        Schema.isMinProperties(1),
      ),
    }),
    Schema.Struct({
      type: Schema.Literal("score"),
      instructions: Schema.NonEmptyString,
      criteria: Schema.TupleWithRest(Schema.Tuple([Entry, Entry]), [Entry]),
    }),
  ]),
})
export type SemanticQuestion = typeof SemanticQuestion.Type

const Probability = Schema.Finite.check(
  Schema.isBetween({ minimum: 0, maximum: 1 }),
)
export const SemanticAnswer = Schema.Union([
  Schema.Struct({ type: Schema.Literal("noul"), noul: Probability }),
  Schema.Struct({
    type: Schema.Literal("choice"),
    choice: Schema.NonEmptyString,
    confidence: Probability,
    probabilities: Schema.Record(Schema.NonEmptyString, Probability),
  }),
  Schema.Struct({
    type: Schema.Literal("score"),
    score: Schema.Finite,
    confidence: Probability,
    legend: Schema.Record(Schema.String, Entry),
    probabilities: Schema.Record(Schema.String, Probability),
  }),
])
export type SemanticAnswer = typeof SemanticAnswer.Type

export const SemanticMeasurement = Schema.Struct({
  measurementId: Schema.NonEmptyString,
  originRunId: Schema.NonEmptyString,
  questionId: Schema.NonEmptyString,
  questionVersion: Schema.NonEmptyString,
  primitive: Schema.Literals(["noul", "choice", "score"]),
  subjectRefs: Schema.Array(CanonicalRef),
  projection: SemanticQuestion.fields.projection,
  question: SemanticQuestion.fields.question,
  inputHash: Schema.String,
  provider: Schema.Literal("typesafe"),
  requestedModel: Schema.NonEmptyString,
  model: Schema.NonEmptyString,
  answer: SemanticAnswer,
  usage: Schema.Struct({
    input_tokens: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    output_tokens: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  }),
  receipt: Schema.Struct({ requestId: Schema.NullOr(Schema.String) }),
  createdAt: Schema.Finite,
})
export type SemanticMeasurement = typeof SemanticMeasurement.Type

/**
 * Jev measures semantic properties. Agents decide what the measurements mean
 * for research strategy.
 */
export class JevEngine extends Context.Service<
  JevEngine,
  {
    readonly measure: (
      request: SemanticQuestion,
    ) => Effect.Effect<SemanticMeasurement, JevEngineError>
  }
>()("BioJev/JevEngine") {}
