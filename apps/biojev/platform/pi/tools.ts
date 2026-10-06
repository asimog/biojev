import type { Context as ChordContext } from "@earendil-works/chord"
import { Type } from "@earendil-works/pi-ai"
import {
  defineExtension,
  defineTool,
  type ToolExecutionApi,
} from "@earendil-works/pi-durable"
import { type Context, Effect, Schema, Struct } from "effect"
import {
  DirectorDecision,
  ResearchDossier,
  ResearchObjective,
  ValidationReport,
} from "../../agents/contracts.ts"
import { BioLab, BioLabError } from "../../biolab/BioLab.ts"
import {
  CapabilityAssessment,
  CapabilityVersion,
  Failure,
  HypothesisRevision,
  Interpretation,
  ResultAssessment,
  ScientificResult,
  Uncertainty,
} from "../../biolab/model/Domain.ts"
import {
  GenesisDiscovery,
  type GenesisSnapshot,
} from "../../biolab/model/Genesis.ts"
import { CapabilitySelection } from "../../biolab/model/Learning.ts"
import type {
  ResearchBlock,
  ValidationCycle,
} from "../../biolab/model/Lifecycle.ts"
import type {
  ActorAuthority,
  ExecutionAuthority,
  SemanticAuthority,
} from "../../biolab/model/Recording.ts"
import { Operation, ScienceRecord } from "../../biolab/model/Recording.ts"
import { semanticFeatures } from "../../jevengine/features.ts"
import { type JevEngine, SemanticQuestion } from "../../jevengine/JevEngine.ts"
import type {
  acquireLinuxEnvironment,
  OperationReceipt,
} from "./execution-env/Linux.ts"

type Environment = Effect.Success<ReturnType<typeof acquireLinuxEnvironment>>

// Pi invokes these callbacks outside application Effects.
const bridge = (context: Context.Context<BioLab>) =>
  Effect.runPromiseWith(context)

const LearningInput = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("ScientificResult"),
    value: ScientificResult.mapFields(
      Struct.omit(["resultId", "originRunId", "originBlockId"]),
    ),
  }),
  Schema.Struct({
    kind: Schema.Literal("Interpretation"),
    value: Interpretation.mapFields(
      Struct.omit(["interpretationId", "originRunId", "actorRole"]),
    ),
  }),
  Schema.Struct({
    kind: Schema.Literal("HypothesisRevision"),
    value: HypothesisRevision.mapFields(
      Struct.omit(["revisionId", "originRunId"]),
    ),
  }),
  Schema.Struct({
    kind: Schema.Literal("ResultAssessment"),
    value: ResultAssessment.mapFields(
      Struct.omit(["assessmentId", "originRunId", "actorRole"]),
    ),
  }),
  Schema.Struct({
    kind: Schema.Literal("Failure"),
    value: Failure.mapFields(Struct.omit(["failureId", "originRunId"])),
  }),
  Schema.Struct({
    kind: Schema.Literal("Uncertainty"),
    value: Uncertainty.mapFields(Struct.omit(["uncertaintyId", "originRunId"])),
  }),
])

export const persistOperation =
  (lab: BioLab["Service"], authority: ExecutionAuthority) =>
  (receipt: OperationReceipt) =>
    Schema.decodeEffect(Schema.fromJsonString(Operation))(
      JSON.stringify(receipt),
    ).pipe(
      Effect.flatMap((value) => lab.recordOperation(authority, value)),
      Effect.asVoid,
    )

export const makeBioLabTools = Effect.fn("Pi.makeBioLabTools")(
  function* (input: {
    readonly actor: ActorAuthority
    readonly execution: ExecutionAuthority
    readonly semantic?: SemanticAuthority
    readonly jev?: JevEngine["Service"]
    readonly environment: Environment
  }) {
    const lab = yield* BioLab
    const actor = yield* lab.getRun(input.actor.runId)
    const run = bridge(yield* Effect.context<BioLab>())
    const emit = async <A, E>(
      program: Effect.Effect<A, E>,
      api: ToolExecutionApi,
      context: ChordContext,
    ) => {
      const value = await run(program, {
        ...(context.abortSignal === undefined
          ? {}
          : { signal: context.abortSignal }),
      })
      api.output(JSON.stringify(value))
      return {}
    }
    const discoveryInput = Schema.Struct({
      ...GenesisDiscovery.mapFields(
        Struct.omit(["missionId", "missionRevision", "measurements"]),
      ).fields,
      measurementRefs: Schema.optionalKey(
        Schema.Array(
          Schema.Struct({
            kind: Schema.Literal("SemanticMeasurement"),
            id: Schema.NonEmptyString,
          }),
        ),
      ),
    })
    const discoveryTools =
      actor.role !== "director"
        ? []
        : [
            defineTool({
              name: "record_discovery",
              description:
                "Retain a broad discovered scientific landscape in BioLab. Retrieve and paginate sources freely with coding tools; retain actual snapshots first and use their Artifact ids as snapshotRef. Declare the inputIds you chose in configuredInputIds, including failed sources; this is your discovery scope, not a preconfigured catalog. Every declared input must have exactly one explicit outcome. Outcome inputIds also declare discovery scope automatically. Previously retained candidates are immutable: use candidates: [] when attaching measurements or updating discovery scope; add new candidate ids for later discoveries. Supply a candidate batch and explicit partial failures; BioLab retains the accumulated map. Pass measurementRefs from actual semantic tool results to associate relevant retained measurements with discovery. Later calls after Genesis are Refresh, never reinitialization. No source or scientific method is prescribed.",
              parameters: Type.Unsafe<typeof discoveryInput.Type>(
                Schema.toJsonSchemaDocument(discoveryInput).schema,
              ),
              replay: "unsafe",
              execute: (value, api, context) =>
                emit(
                  Effect.gen(function* () {
                    const decoded =
                      yield* Schema.decodeEffect(discoveryInput)(value)
                    const { measurementRefs = [], ...discovery } = decoded
                    const measurements = yield* Effect.forEach(
                      measurementRefs,
                      (ref) =>
                        Effect.gen(function* () {
                          const retained = yield* lab.getRecord(ref)
                          if (retained.record.kind !== "SemanticMeasurement")
                            return yield* Effect.die(
                              "Invalid semantic reference",
                            )
                          return retained.record.value
                        }),
                    )
                    return yield* lab.recordAgentDiscovery(input.actor, {
                      ...discovery,
                      configuredInputIds: [
                        ...new Set([
                          ...discovery.configuredInputIds,
                          ...discovery.outcomes.map(
                            (outcome) => outcome.inputId,
                          ),
                        ]),
                      ],
                      missionId: actor.missionId,
                      missionRevision: actor.missionRevision ?? 0,
                      measurements,
                    })
                  }),
                  api,
                  context,
                ),
            }),
          ]
    const search = defineTool({
      name: "search_memory",
      description:
        "Search this mission’s retained records by words, ranked by matched-word count then recency (up to 100). Matching is lexical, not semantic; an empty page does not prove absent history. Empty text lists recent records. Use browse_memory for complete cursor-paginated history and exact returned kind/id references.",
      parameters: Type.Object({ text: Type.String() }),
      replay: "safe",
      execute: ({ text }, api, context) =>
        emit(lab.searchMemory(actor.missionId, text), api, context),
    })
    const browse = defineTool({
      name: "browse_memory",
      description:
        "Browse canonical mission history without guessing search terms. Pass the returned next cursor as after until next is null. Use record.kind and id exactly with read_record.",
      parameters: Type.Object({
        after: Type.Optional(Type.Integer({ minimum: 0 })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
      }),
      replay: "safe",
      execute: ({ after, limit }, api, context) =>
        emit(lab.getHistory(actor.missionId, after, limit), api, context),
    })
    const readableRef = Schema.Struct({
      kind: Schema.Literals([
        "ScientificResult",
        "Interpretation",
        "HypothesisRevision",
        "ResultAssessment",
        "Failure",
        "Uncertainty",
        "SemanticMeasurement",
        "CapabilityVersion",
        "CapabilityAssessment",
        "CapabilitySelection",
        "DirectorDecision",
        "ResearchObjective",
        "ResearchDossier",
        "ValidationReport",
        "DiscoveredSource",
        "DiscoveredCapability",
        "Artifact",
        "ResearchBlock",
        "ValidationCycle",
        "GenesisSnapshot",
      ]),
      id: Schema.NonEmptyString,
    })
    const read = defineTool({
      name: "read_record",
      description:
        "Retrieve a canonical record by the exact supported kind/id returned by tools or handoff context. ResearchDossier is the dossier kind. Artifact reads return authorized metadata; use restore_artifact to retrieve file bytes. Missing records do not prove all prior work is absent.",
      parameters: Type.Unsafe<typeof readableRef.Type>(
        Schema.toJsonSchemaDocument(readableRef).schema,
      ),
      replay: "safe",
      execute: (args, api, context) =>
        emit(
          Schema.decodeEffect(readableRef)(args).pipe(
            Effect.flatMap((ref): Effect.Effect<unknown, BioLabError> => {
              if (ref.kind === "Artifact")
                return lab.getArtifact(input.actor, ref.id).pipe(
                  Effect.map((value) => ({
                    ref,
                    value,
                    retrieval: "Use restore_artifact for file bytes",
                  })),
                )
              if (
                ref.kind === "ResearchBlock" ||
                ref.kind === "ValidationCycle" ||
                ref.kind === "GenesisSnapshot"
              ) {
                const records: Effect.Effect<
                  ReadonlyArray<
                    ResearchBlock | ValidationCycle | GenesisSnapshot
                  >,
                  BioLabError
                > = ref.kind === "ResearchBlock"
                  ? lab.getResearchBlocks(actor.missionId)
                  : ref.kind === "ValidationCycle"
                    ? lab.getValidationCycles(actor.missionId)
                    : lab
                        .getGenesis(actor.missionId)
                        .pipe(
                          Effect.map((value) =>
                            value === null ? [] : [value],
                          ),
                        )
                return records.pipe(
                  Effect.flatMap((values) => {
                    const value = values.find(
                      (value) =>
                        ("blockId" in value
                          ? value.blockId
                          : "cycleId" in value
                            ? value.cycleId
                            : value.genesisId) === ref.id,
                    )
                    return value === undefined
                      ? Effect.fail(
                          new BioLabError({
                            code: "NOT_FOUND",
                            operation: "read_record",
                            message:
                              "Canonical lifecycle reference was not found for this mission",
                          }),
                        )
                      : Effect.succeed({ ref, value })
                  }),
                )
              }
              if (
                ref.kind === "DiscoveredSource" ||
                ref.kind === "DiscoveredCapability"
              )
                return lab.getDiscoveryCandidate(actor.missionId, ref.id).pipe(
                  Effect.flatMap((value) =>
                    ref.kind ===
                    (value.kind === "source"
                      ? "DiscoveredSource"
                      : "DiscoveredCapability")
                      ? Effect.succeed({ kind: ref.kind, value })
                      : Effect.fail(
                          new BioLabError({
                            code: "INVALID_INPUT",
                            operation: "read_record",
                            message: "Discovery reference kind mismatch",
                          }),
                        ),
                  ),
                )
              if (ref.kind === "SemanticMeasurement")
                return lab.getRecord(ref).pipe(
                  Effect.map((value): unknown => value),
                  Effect.catchIf(
                    (error) => error.code === "NOT_FOUND",
                    () =>
                      lab.getDiscoveryMeasurement(actor.missionId, ref.id).pipe(
                        Effect.map((value) => ({
                          kind: ref.kind,
                          value,
                        })),
                      ),
                  ),
                )
              return lab.getRecord(ref)
            }),
          ),
          api,
          context,
        ),
    })
    const receipts = defineTool({
      name: "operation_receipts",
      description:
        "List trusted receipts from actual operations in this run. Use receiptId to record an obtained result. A failed or interrupted operation is not success.",
      parameters: Type.Object({}),
      replay: "safe",
      execute: (_args, api, context) =>
        emit(lab.getOperations(actor.runId), api, context),
    })
    const retainArtifact = defineTool({
      name: "retain_artifact",
      description:
        "Retain an obtained workspace file for later inspection and fresh-role reuse. Returns an Artifact reference; no host path is exposed.",
      parameters: Type.Object({ path: Type.String() }),
      replay: "safe",
      execute: ({ path }, api, context) =>
        emit(
          Effect.gen(function* () {
            const artifact = yield* input.environment.retainArtifact(
              path,
              context,
            )
            return yield* lab.recordArtifact(input.execution, {
              artifactId: artifact.artifactId,
              bytes: artifact.bytes,
              receiptId: artifact.receiptId,
            })
          }),
          api,
          context,
        ),
    })
    const searchDiscovery = defineTool({
      name: "search_discovery",
      description:
        "Search retained source/capability candidates, up to 100 per page. Each result includes ref: use that exact kind/id with read_record and handoff basisRefs/relevantRefs. Continue with afterId equal to the last returned id. A source/capability category is not a canonical reference kind. Discovery does not imply qualification.",
      parameters: Type.Object({
        text: Type.String(),
        afterId: Type.Optional(Type.String()),
      }),
      replay: "safe",
      execute: ({ text, afterId }, api, context) =>
        emit(
          lab.searchDiscovery(actor.missionId, text, afterId).pipe(
            Effect.map((candidates) =>
              candidates.map((candidate) => ({
                ...candidate,
                ref: {
                  kind:
                    candidate.kind === "source"
                      ? "DiscoveredSource"
                      : "DiscoveredCapability",
                  id: candidate.id,
                },
              })),
            ),
          ),
          api,
          context,
        ),
    })
    const inspectDiscoveryMeasurement = defineTool({
      name: "inspect_discovery_measurement",
      description:
        "Inspect a retained Genesis or Refresh semantic measurement. It describes meaning, not scientific truth or mandatory action.",
      parameters: Type.Object({ measurementId: Type.String() }),
      replay: "safe",
      execute: ({ measurementId }, api, context) =>
        emit(
          lab.getDiscoveryMeasurement(actor.missionId, measurementId),
          api,
          context,
        ),
    })
    const restoreArtifact = defineTool({
      name: "restore_artifact",
      description:
        "Restore a retained Artifact from this mission into your environment. Integrity is verified before use.",
      parameters: Type.Object({
        artifactId: Type.String(),
        path: Type.String(),
      }),
      replay: "safe",
      execute: ({ artifactId, path }, api, context) =>
        emit(
          Effect.gen(function* () {
            yield* lab.getArtifact(input.actor, artifactId)
            yield* input.environment.restoreArtifact(artifactId, path, context)
            return { artifactId, path }
          }),
          api,
          context,
        ),
    })
    const recording = defineTool({
      name: "record_learning",
      description:
        "Retain ScientificResult, Interpretation, HypothesisRevision, ResultAssessment, Failure, or Uncertainty. Supply kind and value with the documented record fields; ids, actor role, run and block are set by BioJev. ScientificResult requires a real executionReceiptId and retained Artifact outputRefs; other records use existing basisRefs. Schema shape does not confer authority. Missing values remain explicit; never substitute literature or semantic confidence for obtained output.",
      parameters: Type.Unsafe<typeof LearningInput.Type>(
        Schema.toJsonSchemaDocument(LearningInput).schema,
      ),
      replay: "safe",
      execute: ({ kind, value }, api, context) => {
        const id = `${actor.runId}:${api.taskId}`
        const program = Effect.gen(function* () {
          const payload = yield* Schema.decodeEffect(Schema.JsonObject)(value)
          const identity = {
            originRunId: actor.runId,
            actorRole: actor.role,
            ...(actor.blockId === undefined
              ? {}
              : { originBlockId: actor.blockId }),
            resultId: id,
            interpretationId: id,
            revisionId: id,
            assessmentId: id,
            failureId: id,
            uncertaintyId: id,
          }
          const record = yield* Schema.decodeUnknownEffect(ScienceRecord)({
            kind,
            value: { ...payload, ...identity },
          })
          switch (record.kind) {
            case "ScientificResult":
              return yield* lab.recordScientificResult(
                input.actor,
                record.value,
              )
            case "Interpretation":
              return yield* lab.recordInterpretation(input.actor, record.value)
            case "HypothesisRevision":
              return yield* lab.recordHypothesisRevision(
                input.actor,
                record.value,
              )
            case "ResultAssessment":
              return yield* lab.recordResultAssessment(
                input.actor,
                record.value,
              )
            case "Failure":
              return yield* lab.recordFailure(input.actor, record.value)
            case "Uncertainty":
              return yield* lab.recordUncertainty(input.actor, record.value)
          }
        })
        return emit(program, api, context)
      },
    })
    const directorInput = DirectorDecision.mapFields(
      Struct.omit(["decisionId", "missionId", "nextObjective"]),
    ).mapFields((fields) => ({
      ...fields,
      nextObjective: ResearchObjective.mapFields(
        Struct.omit(["objectiveId", "missionId", "originDirectorDecisionId"]),
      ),
    }))
    const researcherInput = ResearchDossier.mapFields(
      Struct.omit(["dossierId", "blockId", "objectiveId"]),
    )
    const validatorInput = ValidationReport.mapFields(
      Struct.omit(["reportId", "cycleId", "blockRefs"]),
    )
    const handoffSchema =
      actor.purpose === "DIRECTOR_SIDE_WORK"
        ? Schema.Struct({})
        : actor.role === "director"
          ? directorInput
          : actor.role === "researcher"
            ? researcherInput
            : validatorInput
    const handoff = defineTool({
      name: "submit_handoff",
      description:
        actor.purpose === "DIRECTOR_SIDE_WORK"
          ? "Finish Director side work; retained learning remains canonical. No next objective is created."
          : actor.role === "director"
            ? "Retain your strategic decision and one bounded objective. Cite basisValidationReportId when review is pending. You choose the problem; Researcher chooses the method."
            : actor.role === "researcher"
              ? "Retain your honest ResearchDossier. Reference actual canonical records; explicit absence of results is valid. This ends your investigation."
              : "Retain your independent ValidationReport for the exact provided window. Critique and recommend; Director chooses the next objective.",
      parameters: Type.Unsafe<unknown>(
        Schema.toJsonSchemaDocument(handoffSchema).schema,
      ),
      replay: "safe",
      execute: async (value, api, context) => {
        const id = `${actor.runId}:${api.taskId}`
        await emit(
          Effect.gen(function* () {
            const payload = yield* Schema.decodeUnknownEffect(
              Schema.JsonObject,
            )(value)
            if (
              actor.role === "director" &&
              actor.purpose === "DIRECTOR_SIDE_WORK"
            )
              return { completed: true }
            if (actor.role === "director") {
              const objective = yield* Schema.decodeUnknownEffect(
                Schema.JsonObject,
              )(payload.nextObjective)
              const decision = yield* Schema.decodeUnknownEffect(
                DirectorDecision,
              )({
                ...payload,
                decisionId: id,
                missionId: actor.missionId,
                nextObjective: {
                  ...objective,
                  objectiveId: `${id}:objective`,
                  missionId: actor.missionId,
                  originDirectorDecisionId: id,
                },
              })
              return yield* lab.recordDirectorDecision(input.actor, decision)
            }
            if (actor.role === "researcher") {
              const block = (yield* lab.getResearchBlocks(
                actor.missionId,
              )).find((block) => block.runId === actor.runId)
              if (block === undefined)
                return yield* Effect.die("Active ResearchBlock is absent")
              const dossier = yield* Schema.decodeUnknownEffect(
                ResearchDossier,
              )({
                ...payload,
                dossierId: id,
                blockId: block.blockId,
                objectiveId: block.objectiveId,
              })
              return yield* lab.recordDossier(input.actor, dossier)
            }
            const cycle = (yield* lab.getLifecycle(actor.missionId)).validation
            if (cycle === undefined || cycle.runId !== actor.runId)
              return yield* Effect.die("Active ValidationCycle is absent")
            const report = yield* Schema.decodeUnknownEffect(ValidationReport)({
              ...payload,
              reportId: id,
              cycleId: cycle.cycleId,
              blockRefs: cycle.blockIds.map((id) => ({
                kind: "ResearchBlock",
                id,
              })),
            })
            return yield* lab.recordValidationReport(input.actor, report)
          }),
          api,
          context,
        )
        return { control: { terminate: true } }
      },
    })
    const capabilityVersionInput = CapabilityVersion.mapFields(
      Struct.omit(["versionId", "originRunId"]),
    )
    const capabilityAssessmentInput = CapabilityAssessment.mapFields(
      Struct.omit(["assessmentId", "originRunId", "actorRole"]),
    )
    const capabilitySelectionInput = CapabilitySelection.mapFields(
      Struct.omit(["selectionId", "originRunId"]),
    )
    const capabilityTools = [
      defineTool({
        name: "capability_defaults",
        description:
          "Read Director's selected capability defaults. Selection is advice, not a mandatory method.",
        parameters: Type.Object({}),
        replay: "safe",
        execute: (_args, api, context) =>
          emit(lab.getCapabilityDefaults(actor.missionId), api, context),
      }),
      defineTool({
        name: "assess_capability",
        description:
          "Retain an attributable critique of a capability version without activating it.",
        parameters: Type.Unsafe<typeof capabilityAssessmentInput.Type>(
          Schema.toJsonSchemaDocument(capabilityAssessmentInput).schema,
        ),
        replay: "safe",
        execute: (value, api, context) =>
          emit(
            lab.recordCapabilityAssessment(input.actor, {
              ...value,
              assessmentId: `${actor.runId}:${api.taskId}`,
              originRunId: actor.runId,
              actorRole: actor.role,
            }),
            api,
            context,
          ),
      }),
      ...(actor.role !== "researcher"
        ? []
        : [
            defineTool({
              name: "retain_capability",
              description:
                "Retain reusable code or method metadata with retained Artifact references. QUALIFIED requires successful obtained qualification results from this run. Ad hoc computation needs no registration.",
              parameters: Type.Unsafe<typeof capabilityVersionInput.Type>(
                Schema.toJsonSchemaDocument(capabilityVersionInput).schema,
              ),
              replay: "safe",
              execute: (value, api, context) =>
                emit(
                  lab.recordCapabilityVersion(input.actor, {
                    ...value,
                    versionId: `${actor.runId}:${api.taskId}`,
                    originRunId: actor.runId,
                  }),
                  api,
                  context,
                ),
            }),
          ]),
      ...(actor.role !== "director"
        ? []
        : [
            defineTool({
              name: "select_capability",
              description:
                "Select or roll back a qualified default by versionRef, or clear it with null. Preserve old versions and explain your choice.",
              parameters: Type.Unsafe<typeof capabilitySelectionInput.Type>(
                Schema.toJsonSchemaDocument(capabilitySelectionInput).schema,
              ),
              replay: "safe",
              execute: (value, api, context) =>
                emit(
                  lab.recordCapabilitySelection(input.actor, {
                    ...value,
                    selectionId: `${actor.runId}:${api.taskId}`,
                    originRunId: actor.runId,
                  }),
                  api,
                  context,
                ),
            }),
          ]),
    ]
    const semanticInput = SemanticQuestion.mapFields(
      Struct.omit(["originRunId"]),
    )
    const semanticTools =
      input.jev === undefined || input.semantic === undefined
        ? []
        : [
            defineTool({
              name: "measure_semantics",
              description:
                "Ask Jev a versioned Noul, Choice or Score question and retain its semantic measurement. Confidence is semantic, not scientific probability. You decide consequences.",
              parameters: Type.Unsafe<typeof semanticInput.Type>(
                Schema.toJsonSchemaDocument(semanticInput).schema,
              ),
              replay: "unsafe",
              execute: (value, api, context) =>
                emit(
                  Effect.gen(function* () {
                    const jev = input.jev
                    const authority = input.semantic
                    if (jev === undefined || authority === undefined)
                      return yield* Effect.die("Semantic capability is absent")
                    const measurement = yield* jev.measure({
                      ...value,
                      originRunId: actor.runId,
                    })
                    const retained = {
                      ...measurement,
                      measurementId: `${actor.runId}:${api.taskId}`,
                    }
                    const ref = yield* lab.recordSemanticMeasurement(
                      authority,
                      retained,
                    )
                    return {
                      ref,
                      measurement: retained,
                      features: semanticFeatures(retained.answer),
                    }
                  }),
                  api,
                  context,
                ),
            }),
          ]
    const batchQuestion = SemanticQuestion.mapFields(
      Struct.omit(["originRunId"]),
    )
    const batchInput = Schema.Struct({
      questions: Schema.Array(batchQuestion).check(
        Schema.isMinLength(1),
        Schema.isMaxLength(64),
      ),
    })
    const batchTools =
      input.jev?.measureBatch === undefined || input.semantic === undefined
        ? []
        : [
            defineTool({
              name: "measure_semantics_batch",
              description:
                "Ask up to 64 independently versioned Jev questions over the same projected state in one native TypeSafe request. Every question must have identical projection.value; put question-specific criteria in instructions, not in different projected values. Use measure_semantics separately when inputs differ. Use any Noul, Choice or Score rubric you design. Supports semantic search/comparison, entity alignment, citation checks, question-derived numeric features and uncertainty analysis. You decide whether/how to use results; no automatic research policy or feature-search loop is imposed. Usage belongs to the shared receipt, not each answer independently.",
              parameters: Type.Unsafe<typeof batchInput.Type>(
                Schema.toJsonSchemaDocument(batchInput).schema,
              ),
              replay: "unsafe",
              execute: (value, api, context) =>
                emit(
                  Effect.gen(function* () {
                    const decoded =
                      yield* Schema.decodeEffect(batchInput)(value)
                    const measureBatch = input.jev?.measureBatch
                    const authority = input.semantic
                    if (measureBatch === undefined || authority === undefined)
                      return yield* Effect.die("Batch semantics unavailable")
                    const measurements = yield* measureBatch(
                      decoded.questions.map((question) => ({
                        ...question,
                        originRunId: actor.runId,
                      })),
                    )
                    return yield* Effect.forEach(
                      measurements,
                      (measurement, index) =>
                        Effect.gen(function* () {
                          const retained = {
                            ...measurement,
                            measurementId: `${actor.runId}:${api.taskId}:${index}`,
                          }
                          const ref = yield* lab.recordSemanticMeasurement(
                            authority,
                            retained,
                          )
                          return {
                            ref,
                            measurement: retained,
                            features: semanticFeatures(retained.answer),
                          }
                        }),
                    )
                  }),
                  api,
                  context,
                ),
            }),
          ]
    return defineExtension({
      name: `biolab-${actor.runId}`,
      tools: [
        search,
        browse,
        searchDiscovery,
        inspectDiscoveryMeasurement,
        read,
        receipts,
        retainArtifact,
        restoreArtifact,
        recording,
        handoff,
        ...capabilityTools,
        ...semanticTools,
        ...batchTools,
        ...discoveryTools,
      ],
    })
  },
)
