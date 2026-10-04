import { Context, type Effect, Schema } from "effect"
import type {
  DirectorDecision,
  ResearchDossier,
  ResearchObjective,
  ValidationReport,
} from "../agents/contracts.ts"
import type {
  CanonicalRef,
  CapabilityAssessment,
  CapabilityVersion,
  HypothesisRevision,
  Interpretation,
  ResultAssessment,
  ScientificResult,
} from "./model/Domain.ts"

export class BioLabError extends Schema.TaggedError<BioLabError>()(
  "BioLabError",
  {
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
) {}

export interface MemoryHit {
  readonly ref: CanonicalRef
  readonly summary: string
  readonly relevanceHint?: string
}

export interface CapabilityHit {
  readonly capabilityId: string
  readonly name: string
  readonly description: string
  readonly activeVersionId?: string
}

/**
 * BioLab is the sole canonical institutional state authority.
 *
 * It is intentionally one high-level Effect Service. Its methods use domain
 * vocabulary, not generic CRUD. Role-specific tool modules expose only the
 * subset each agent is authorized to use.
 *
 * BioLab stores and retrieves institutional memory. It does not execute code.
 */
export class BioLab extends Context.Service<
  BioLab,
  {
    // Institutional memory
    readonly searchMemory: (
      query: string,
      limit?: number,
    ) => Effect.Effect<ReadonlyArray<MemoryHit>, BioLabError>

    readonly inspect: (ref: CanonicalRef) => Effect.Effect<unknown, BioLabError>

    // Strategy and lifecycle handoffs
    readonly recordDirectorDecision: (
      decision: DirectorDecision,
    ) => Effect.Effect<void, BioLabError>

    readonly createResearchObjective: (
      objective: ResearchObjective,
    ) => Effect.Effect<void, BioLabError>

    readonly recordResearchDossier: (
      dossier: ResearchDossier,
    ) => Effect.Effect<void, BioLabError>

    readonly recordValidationReport: (
      report: ValidationReport,
    ) => Effect.Effect<void, BioLabError>

    // Scientific history
    readonly recordScientificResult: (
      result: ScientificResult,
    ) => Effect.Effect<void, BioLabError>

    readonly recordInterpretation: (
      interpretation: Interpretation,
    ) => Effect.Effect<void, BioLabError>

    readonly recordResultAssessment: (
      assessment: ResultAssessment,
    ) => Effect.Effect<void, BioLabError>

    readonly reviseHypothesis: (
      revision: HypothesisRevision,
    ) => Effect.Effect<void, BioLabError>

    // Capability memory and evolution
    readonly searchCapabilities: (
      query: string,
      limit?: number,
    ) => Effect.Effect<ReadonlyArray<CapabilityHit>, BioLabError>

    readonly registerCapabilityVersion: (
      version: CapabilityVersion,
    ) => Effect.Effect<void, BioLabError>

    readonly recordCapabilityAssessment: (
      assessment: CapabilityAssessment,
    ) => Effect.Effect<void, BioLabError>

    readonly activateCapabilityVersion: (
      capabilityId: string,
      versionId: string,
      basisRefs: ReadonlyArray<CanonicalRef>,
    ) => Effect.Effect<void, BioLabError>
  }
>()("BioJev/BioLab") {}
