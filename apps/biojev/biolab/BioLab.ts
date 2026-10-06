import { Context, type Effect, Schema } from "effect"
import type {
  DirectorDecision,
  ResearchDossier,
  ValidationReport,
} from "../agents/contracts.ts"
import type { SemanticMeasurement } from "../jevengine/JevEngine.ts"
import type {
  CanonicalRef,
  Failure,
  HypothesisRevision,
  Interpretation,
  ResultAssessment,
  ScientificResult,
  Uncertainty,
} from "./model/Domain.ts"
import type {
  DiscoveredCandidate,
  GenesisDiscovery,
  GenesisSnapshot,
} from "./model/Genesis.ts"
import type {
  CapabilityAssessment,
  CapabilitySelection,
  CapabilityVersion,
} from "./model/Learning.ts"
import type {
  FinishBlock,
  Lifecycle,
  ResearchBlock,
  ValidationCycle,
} from "./model/Lifecycle.ts"
import type {
  CreateMission,
  Mission,
  MissionRevision,
  ReviseMission,
} from "./model/Mission.ts"
import type {
  ActorAuthority,
  AgentRun,
  Artifact,
  BeginRun,
  ExecutionAuthority,
  Operation,
  RetainedRecord,
  SemanticAuthority,
} from "./model/Recording.ts"

export class BioLabError extends Schema.TaggedError<BioLabError>()(
  "BioLabError",
  {
    code: Schema.Literals([
      "INVALID_INPUT",
      "NOT_FOUND",
      "CONFLICT",
      "UNAUTHORIZED",
      "STORAGE",
    ]),
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
) {}

export class BioLab extends Context.Service<
  BioLab,
  {
    readonly createMission: (
      input: CreateMission,
    ) => Effect.Effect<Mission, BioLabError>
    readonly reviseMission: (
      input: ReviseMission,
    ) => Effect.Effect<Mission, BioLabError>
    readonly getMission: (
      missionId: string,
    ) => Effect.Effect<Mission, BioLabError>
    readonly listMissions: Effect.Effect<ReadonlyArray<Mission>, BioLabError>
    readonly getMissionRevisions: (
      missionId: string,
    ) => Effect.Effect<ReadonlyArray<MissionRevision>, BioLabError>
    readonly beginRun: (
      input: BeginRun,
      expectedMissionRevision?: number,
    ) => Effect.Effect<
      {
        actor: ActorAuthority
        execution: ExecutionAuthority
        semantic: SemanticAuthority
      },
      BioLabError
    >
    readonly getRun: (runId: string) => Effect.Effect<AgentRun, BioLabError>
    readonly getRunCompletion: (runId: string) => Effect.Effect<
      {
        readonly handoffRetained: boolean
        readonly hasScientificResults: boolean
      },
      BioLabError
    >
    readonly reopenRun: (runId: string) => Effect.Effect<
      {
        actor: ActorAuthority
        execution: ExecutionAuthority
        semantic: SemanticAuthority
      },
      BioLabError
    >
    readonly getOperations: (
      runId: string,
    ) => Effect.Effect<ReadonlyArray<Operation>, BioLabError>
    readonly settleRun: (runId: string) => Effect.Effect<void, BioLabError>
    readonly recordOperation: (
      authority: ExecutionAuthority,
      input: Operation,
    ) => Effect.Effect<CanonicalRef, BioLabError>
    readonly recordArtifact: (
      authority: ExecutionAuthority,
      input: Artifact,
    ) => Effect.Effect<CanonicalRef, BioLabError>
    readonly getArtifact: (
      authority: ActorAuthority,
      artifactId: string,
    ) => Effect.Effect<{ artifactId: string; bytes: number }, BioLabError>
    readonly recordScientificResult: (
      authority: ActorAuthority,
      input: ScientificResult,
    ) => Effect.Effect<CanonicalRef, BioLabError>
    readonly recordInterpretation: (
      authority: ActorAuthority,
      input: Interpretation,
    ) => Effect.Effect<CanonicalRef, BioLabError>
    readonly recordHypothesisRevision: (
      authority: ActorAuthority,
      input: HypothesisRevision,
    ) => Effect.Effect<CanonicalRef, BioLabError>
    readonly recordResultAssessment: (
      authority: ActorAuthority,
      input: ResultAssessment,
    ) => Effect.Effect<CanonicalRef, BioLabError>
    readonly recordFailure: (
      authority: ActorAuthority,
      input: Failure,
    ) => Effect.Effect<CanonicalRef, BioLabError>
    readonly recordUncertainty: (
      authority: ActorAuthority,
      input: Uncertainty,
    ) => Effect.Effect<CanonicalRef, BioLabError>
    readonly getRecord: (
      ref: CanonicalRef,
    ) => Effect.Effect<RetainedRecord, BioLabError>
    readonly searchMemory: (
      missionId: string,
      text: string,
    ) => Effect.Effect<ReadonlyArray<RetainedRecord>, BioLabError>
    readonly getHistory: (
      missionId: string,
      after?: number,
      limit?: number,
    ) => Effect.Effect<
      {
        records: ReadonlyArray<RetainedRecord>
        next: number | null
        cursor: number
      },
      BioLabError
    >
    readonly recordSemanticMeasurement: (
      authority: SemanticAuthority,
      value: SemanticMeasurement,
    ) => Effect.Effect<CanonicalRef, BioLabError>
    readonly recordCapabilityVersion: (
      authority: ActorAuthority,
      value: CapabilityVersion,
    ) => Effect.Effect<CanonicalRef, BioLabError>
    readonly recordCapabilityAssessment: (
      authority: ActorAuthority,
      value: CapabilityAssessment,
    ) => Effect.Effect<CanonicalRef, BioLabError>
    readonly recordCapabilitySelection: (
      authority: ActorAuthority,
      value: CapabilitySelection,
    ) => Effect.Effect<CanonicalRef, BioLabError>
    readonly getCapabilityDefaults: (
      missionId: string,
    ) => Effect.Effect<ReadonlyArray<CapabilitySelection>, BioLabError>
    readonly searchDiscovery: (
      missionId: string,
      text: string,
      afterId?: string,
    ) => Effect.Effect<ReadonlyArray<DiscoveredCandidate>, BioLabError>
    readonly getDiscoveryCandidate: (
      missionId: string,
      candidateId: string,
    ) => Effect.Effect<DiscoveredCandidate, BioLabError>
    readonly getDiscoveryMeasurement: (
      missionId: string,
      measurementId: string,
    ) => Effect.Effect<SemanticMeasurement, BioLabError>
    readonly refreshDiscovery: (
      input: GenesisDiscovery,
    ) => Effect.Effect<void, BioLabError>
    readonly getGenesis: (
      missionId: string,
    ) => Effect.Effect<GenesisSnapshot | null, BioLabError>
    readonly recordAgentDiscovery: (
      authority: ActorAuthority,
      input: GenesisDiscovery,
    ) => Effect.Effect<GenesisSnapshot, BioLabError>
    readonly recordGenesisDiscovery: (
      input: GenesisDiscovery,
      phase?: "DISCOVERING",
    ) => Effect.Effect<GenesisSnapshot, BioLabError>
    readonly getValidationCycles: (
      missionId: string,
    ) => Effect.Effect<ReadonlyArray<ValidationCycle>, BioLabError>
    readonly getLifecycle: (
      missionId: string,
    ) => Effect.Effect<Lifecycle, BioLabError>
    readonly getRuns: (
      missionId: string,
    ) => Effect.Effect<ReadonlyArray<AgentRun>, BioLabError>
    readonly setMissionStatus: (
      missionId: string,
      status: "RUNNING" | "PAUSED" | "STOPPED",
    ) => Effect.Effect<void, BioLabError>
    readonly recordDirectorDecision: (
      authority: ActorAuthority,
      decision: DirectorDecision,
    ) => Effect.Effect<CanonicalRef, BioLabError>
    readonly startResearchBlock: (
      authority: ActorAuthority,
      objectiveId: string,
      deadline: number,
    ) => Effect.Effect<ResearchBlock, BioLabError>
    readonly recordDossier: (
      authority: ActorAuthority,
      dossier: ResearchDossier,
    ) => Effect.Effect<CanonicalRef, BioLabError>
    readonly finishResearchBlock: (
      input: FinishBlock,
    ) => Effect.Effect<ResearchBlock, BioLabError>
    readonly getResearchBlocks: (
      missionId: string,
    ) => Effect.Effect<ReadonlyArray<ResearchBlock>, BioLabError>
    readonly startValidation: (
      authority: ActorAuthority,
    ) => Effect.Effect<ValidationCycle, BioLabError>
    readonly recordValidationReport: (
      authority: ActorAuthority,
      report: ValidationReport,
    ) => Effect.Effect<CanonicalRef, BioLabError>
    readonly finishValidation: (
      authority: ActorAuthority,
      reason: string,
    ) => Effect.Effect<void, BioLabError>
    readonly markRecoveryRequired: (
      blockId: string,
      reason: string,
    ) => Effect.Effect<void, BioLabError>
  }
>()("BioJev/BioLab") {}
