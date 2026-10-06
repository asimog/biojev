import { DateTime, Effect, Schema } from "effect"
import type { SqlClient, SqlError } from "effect/sql"
import {
  DirectorDecision,
  ResearchDossier,
  ValidationReport,
} from "../agents/contracts.ts"
import { genesisMapSufficient } from "../core/genesis.ts"
import { SemanticMeasurement } from "../jevengine/JevEngine.ts"
import { BioLabError } from "./BioLab.ts"
import type { CanonicalRef } from "./model/Domain.ts"
import {
  DiscoveredCandidate,
  GenesisDiscovery,
  GenesisSnapshot,
} from "./model/Genesis.ts"
import {
  FinishBlock,
  type Lifecycle,
  ResearchBlock,
  ValidationCycle,
} from "./model/Lifecycle.ts"
import type { Mission } from "./model/Mission.ts"
import {
  type ActorAuthority,
  AgentRun,
  type InstitutionalRecord,
  RetainedRecord,
} from "./model/Recording.ts"

const reject = (message: string) =>
  new BioLabError({ code: "CONFLICT", operation: "lifecycle", message })
const decode = <A, I>(schema: Schema.Codec<A, I>, value: unknown) =>
  Schema.decodeUnknownEffect(schema)(value).pipe(
    Effect.mapError(
      (cause) =>
        new BioLabError({
          code: "INVALID_INPUT",
          operation: "lifecycle",
          message: "Invalid lifecycle record",
          cause,
        }),
    ),
  )

export const makeLifecycle = (
  sql: SqlClient.SqlClient,
  deps: {
    getMission: (id: string) => Effect.Effect<Mission, BioLabError>
    getRun: (id: string) => Effect.Effect<AgentRun, BioLabError>
    authorize: (
      authority: ActorAuthority,
    ) => Effect.Effect<AgentRun, BioLabError>
    artifact: (
      authority: ActorAuthority,
      id: string,
    ) => Effect.Effect<unknown, BioLabError>
    refs: (
      refs: ReadonlyArray<CanonicalRef>,
      expectedKind?: string,
      missionId?: string,
    ) => Effect.Effect<void, BioLabError | SqlError.SqlError>
  },
) => {
  const checked = <A, R>(
    work: Effect.Effect<A, BioLabError | SqlError.SqlError, R>,
  ) =>
    work.pipe(
      Effect.catchTag(
        "SqlError",
        (cause) =>
          new BioLabError({
            code: "STORAGE",
            operation: "lifecycle",
            message: "Lifecycle storage failed",
            cause,
          }),
      ),
    )
  const atomic = <A, R>(
    work: Effect.Effect<A, BioLabError | SqlError.SqlError, R>,
  ) => checked(sql.withTransaction(work))
  const getGenesis = Effect.fn("BioLab.getGenesis")(function* (
    missionId: string,
  ) {
    yield* deps.getMission(missionId)
    const rows = yield* sql<{
      body: string
    }>`SELECT body FROM genesis WHERE missionId = ${missionId}`
    return rows.length === 0
      ? null
      : yield* decode(Schema.fromJsonString(GenesisSnapshot), rows[0].body)
  }, checked)
  const searchDiscovery = Effect.fn("BioLab.searchDiscovery")(function* (
    missionId: string,
    text: string,
    afterId = "",
  ) {
    yield* deps.getMission(missionId)
    const rows = yield* sql<{
      body: string
    }>`SELECT body FROM discovered_candidates WHERE missionId = ${missionId} AND id > ${afterId} AND body LIKE ${`%${text}%`} ORDER BY id LIMIT 100`
    return yield* Effect.forEach(rows, (row) =>
      decode(Schema.fromJsonString(DiscoveredCandidate), row.body),
    )
  }, checked)
  const getDiscoveryCandidate = Effect.fn("BioLab.getDiscoveryCandidate")(
    function* (missionId: string, candidateId: string) {
      yield* deps.getMission(missionId)
      const rows = yield* sql<{
        body: string
      }>`SELECT body FROM discovered_candidates WHERE missionId = ${missionId} AND id = ${candidateId}`
      if (rows.length === 0)
        return yield* new BioLabError({
          code: "NOT_FOUND",
          operation: "getDiscoveryCandidate",
          message: "Discovery candidate not found",
        })
      return yield* decode(
        Schema.fromJsonString(DiscoveredCandidate),
        rows[0].body,
      )
    },
    checked,
  )
  const getDiscoveryMeasurement = Effect.fn("BioLab.getDiscoveryMeasurement")(
    function* (missionId: string, measurementId: string) {
      yield* deps.getMission(missionId)
      const rows = yield* sql<{
        body: string
      }>`SELECT body FROM genesis_measurements WHERE missionId = ${missionId} AND id = ${measurementId}`
      if (rows.length === 0) {
        const ordinary = yield* sql<{
          body: string
        }>`SELECT body FROM records WHERE missionId = ${missionId} AND id = ${measurementId} AND kind = 'SemanticMeasurement'`
        if (ordinary.length === 1) {
          const retained = yield* decode(
            Schema.fromJsonString(RetainedRecord),
            ordinary[0].body,
          )
          if (retained.record.kind === "SemanticMeasurement")
            return retained.record.value
        }
      }
      if (rows.length === 0)
        return yield* new BioLabError({
          code: "NOT_FOUND",
          operation: "getDiscoveryMeasurement",
          message: "Discovery measurement was not found",
        })
      return yield* decode(
        Schema.fromJsonString(SemanticMeasurement),
        rows[0].body,
      )
    },
    checked,
  )
  const recordGenesisDiscovery = Effect.fn("BioLab.recordGenesisDiscovery")(
    function* (
      input: GenesisDiscovery,
      refresh = false,
      phase?: "DISCOVERING",
    ) {
      const value = yield* decode(GenesisDiscovery, input)
      return yield* atomic(
        Effect.gen(function* () {
          const mission = yield* deps.getMission(value.missionId)
          const previous = yield* getGenesis(value.missionId)
          if (
            mission.status !== "RUNNING" ||
            mission.revision !== value.missionRevision ||
            (!refresh && previous?.status === "COMPLETED") ||
            (refresh && previous?.status !== "COMPLETED")
          )
            return yield* reject(
              "Genesis cannot replace completed initialization or use stale mission context",
            )
          if (
            new Set(value.configuredInputIds).size !==
              value.configuredInputIds.length ||
            new Set(value.outcomes.map((outcome) => outcome.inputId)).size !==
              value.outcomes.length
          )
            return yield* reject(
              "Discovery input identities and outcomes must be unique",
            )
          const { candidates, measurements, ...details } = value
          const ids = new Set(candidates.map((candidate) => candidate.id))
          if (ids.size !== candidates.length)
            return yield* reject(
              "Discovery candidate identities must be unique",
            )
          for (const measurement of measurements) {
            if (measurement.originRunId !== `${value.missionId}:genesis`) {
              const origin = yield* deps.getRun(measurement.originRunId)
              if (
                origin.role !== "director" ||
                origin.missionId !== value.missionId
              )
                return yield* reject(
                  "Discovery measurement must belong to this Director",
                )
              const retained = yield* sql<{
                body: string
              }>`SELECT body FROM records WHERE id = ${measurement.measurementId} AND kind = 'SemanticMeasurement' AND runId = ${origin.runId}`
              if (retained.length !== 1)
                return yield* reject(
                  "Discovery requires a retained semantic measurement",
                )
              const stored = yield* decode(
                Schema.fromJsonString(RetainedRecord),
                retained[0].body,
              )
              if (
                stored.record.kind !== "SemanticMeasurement" ||
                !Schema.toEquivalence(SemanticMeasurement)(
                  stored.record.value,
                  measurement,
                )
              )
                return yield* reject(
                  "Discovery semantic measurement must match canonical history",
                )
            }
            if (measurement.subjectRefs.length === 0)
              return yield* reject(
                "Discovery measurement requires candidate references",
              )
            for (const ref of measurement.subjectRefs) {
              const candidate =
                candidates.find((candidate) => candidate.id === ref.id) ??
                (yield* getDiscoveryCandidate(value.missionId, ref.id))
              if (
                ref.kind !==
                (candidate.kind === "source"
                  ? "DiscoveredSource"
                  : "DiscoveredCapability")
              )
                return yield* reject(
                  "Discovery measurement attribution does not match candidates",
                )
            }
          }
          for (const candidate of candidates) {
            const rows = yield* sql<{
              body: string
            }>`SELECT body FROM discovered_candidates WHERE missionId = ${value.missionId} AND id = ${candidate.id}`
            if (rows.length > 0 && rows[0].body !== JSON.stringify(candidate))
              return yield* reject("Discovery identity is immutable")
            yield* sql`INSERT OR IGNORE INTO discovered_candidates (missionId, id, body) VALUES (${value.missionId}, ${candidate.id}, ${JSON.stringify(candidate)})`
          }
          for (const measurement of measurements) {
            if (measurement.originRunId !== `${value.missionId}:genesis`)
              continue
            const rows = yield* sql<{
              body: string
            }>`SELECT body FROM genesis_measurements WHERE missionId = ${value.missionId} AND id = ${measurement.measurementId}`
            if (rows.length > 0 && rows[0].body !== JSON.stringify(measurement))
              return yield* reject("Semantic measurement identity is immutable")
            yield* sql`INSERT OR IGNORE INTO genesis_measurements (missionId, id, body) VALUES (${value.missionId}, ${measurement.measurementId}, ${JSON.stringify(measurement)})`
          }
          const priorProgram =
            previous?.programId === details.programId &&
            previous.programVersion === details.programVersion
              ? previous
              : null
          const outcomes = new Map(
            (priorProgram?.outcomes ?? []).map((outcome) => [
              outcome.inputId,
              outcome,
            ]),
          )
          for (const outcome of details.outcomes)
            outcomes.set(outcome.inputId, outcome)
          const retained = {
            ...details,
            configuredInputIds: [
              ...new Set([
                ...(priorProgram?.configuredInputIds ?? []),
                ...details.configuredInputIds,
              ]),
            ],
            outcomes: [...outcomes.values()],
            sourceIds: [
              ...new Set([
                ...(previous?.sourceIds ?? []),
                ...candidates
                  .filter((candidate) => candidate.kind === "source")
                  .map((candidate) => candidate.id),
              ]),
            ],
            capabilityIds: [
              ...new Set([
                ...(previous?.capabilityIds ?? []),
                ...candidates
                  .filter((candidate) => candidate.kind === "capability")
                  .map((candidate) => candidate.id),
              ]),
            ],
            semanticMeasurementIds: [
              ...new Set([
                ...(previous?.semanticMeasurementIds ?? []),
                ...measurements.map((measurement) => measurement.measurementId),
              ]),
            ],
          }
          const snapshot: GenesisSnapshot = {
            ...retained,
            normalizerVersions: [
              ...new Set([
                ...(previous?.normalizerVersions ?? []),
                ...candidates.map((candidate) => candidate.normalizerVersion),
              ]),
            ],
            sourceRecordsImported: retained.sourceIds.length,
            capabilityCandidatesImported: retained.capabilityIds.length,
            genesisId: `${value.missionId}:genesis`,
            startedAt:
              previous?.startedAt ??
              DateTime.toEpochMillis(yield* DateTime.now),
            completedAt: null,
            status:
              phase ??
              (genesisMapSufficient(retained)
                ? "READY_FOR_DIRECTION"
                : "FAILED"),
            inauguralDirectorDecisionId: null,
            initialResearchObjectiveId: null,
          }
          yield* sql`INSERT INTO genesis_attempts (missionId, body) VALUES (${value.missionId}, ${JSON.stringify({ purpose: refresh ? "REFRESH" : "GENESIS", snapshot })})`
          if (refresh && previous !== null) return previous
          yield* sql`INSERT INTO genesis (missionId, body) VALUES (${value.missionId}, ${JSON.stringify(snapshot)}) ON CONFLICT(missionId) DO UPDATE SET body = excluded.body`
          return snapshot
        }),
      )
    },
  )
  const recordAgentDiscovery = Effect.fn("BioLab.recordAgentDiscovery")(
    function* (authority: ActorAuthority, input: GenesisDiscovery) {
      const run = yield* deps.authorize(authority)
      if (
        run.role !== "director" ||
        input.missionId !== run.missionId ||
        input.missionRevision !== run.missionRevision
      )
        return yield* reject("Only the current Director can record discovery")
      for (const candidate of input.candidates) {
        yield* deps.artifact(authority, candidate.snapshotRef)
      }
      for (const outcome of input.outcomes) {
        if (outcome.snapshotRef !== null)
          yield* deps.artifact(authority, outcome.snapshotRef)
      }
      const previous = yield* getGenesis(run.missionId)
      return yield* recordGenesisDiscovery(
        input,
        previous?.status === "COMPLETED",
        previous?.status !== "COMPLETED" &&
          (previous?.semanticMeasurementIds.length ?? 0) +
            input.measurements.length ===
            0
          ? "DISCOVERING"
          : undefined,
      )
    },
    atomic,
  )
  const getRuns = Effect.fn("BioLab.getRuns")(function* (missionId: string) {
    const rows = yield* sql<{
      body: string
    }>`SELECT body FROM agent_runs WHERE missionId = ${missionId} ORDER BY rowid`
    return yield* Effect.forEach(rows, (row) =>
      decode(Schema.fromJsonString(AgentRun), row.body),
    )
  }, checked)
  const getResearchBlocks = Effect.fn("BioLab.getResearchBlocks")(function* (
    missionId: string,
  ) {
    const rows = yield* sql<{
      body: string
    }>`SELECT body FROM research_blocks WHERE missionId = ${missionId} ORDER BY rowid`
    return yield* Effect.forEach(rows, (row) =>
      decode(Schema.fromJsonString(ResearchBlock), row.body),
    )
  }, checked)
  const cycles = Effect.fn("BioLab.validationCycles")(function* (
    missionId: string,
  ) {
    const rows = yield* sql<{
      body: string
    }>`SELECT body FROM validation_cycles WHERE missionId = ${missionId} ORDER BY rowid`
    return yield* Effect.forEach(rows, (row) =>
      decode(Schema.fromJsonString(ValidationCycle), row.body),
    )
  })
  const state = Effect.fn("BioLab.lifecycleState")(function* (
    missionId: string,
    excludeRun: string | undefined,
  ): Effect.fn.Return<Lifecycle, BioLabError | SqlError.SqlError> {
    const mission = yield* deps.getMission(missionId)
    const genesis = yield* getGenesis(missionId)
    const blocks = yield* getResearchBlocks(missionId)
    const history = yield* cycles(missionId)
    const reviewed = new Set(
      history
        .filter((cycle) => cycle.status === "REVIEWED")
        .flatMap((cycle) => cycle.blockIds),
    )
    const countableBlocks = blocks.filter(
      (block) =>
        block.classification === "COUNTABLE" && !reviewed.has(block.blockId),
    ).length
    const validation = history.find((cycle) => cycle.status !== "REVIEWED")
    const objectives = yield* sql<{
      objectiveId: string
    }>`SELECT objectiveId FROM objectives WHERE missionId = ${missionId} AND status = 'READY' ORDER BY rowid LIMIT 1`
    const ignoreSide =
      excludeRun !== undefined &&
      (yield* deps.getRun(excludeRun)).role === "researcher"
    const active = (yield* getRuns(missionId)).filter(
      (run) =>
        run.status === "ACTIVE" &&
        run.runId !== excludeRun &&
        !(ignoreSide && run.purpose === "DIRECTOR_SIDE_WORK"),
    )
    const validationDue =
      validation !== undefined &&
      (validation.status === "DUE" || validation.status === "RUNNING")
    const pending = validation?.status === "AWAITING_DIRECTOR"
    return {
      mission,
      genesisComplete: genesis?.status === "COMPLETED",
      recoveryRequired:
        active.length > 0 ||
        blocks.some((block) => block.status === "RECOVERY_REQUIRED"),
      validationDue,
      validationCompletedAwaitingDirectorReview: pending,
      objectiveReady: objectives.length > 0 && !validationDue && !pending,
      directorRequired: objectives.length === 0 && !validationDue,
      ...(objectives.length === 0
        ? {}
        : { objectiveId: objectives[0].objectiveId }),
      ...(validation === undefined ? {} : { validation }),
      countableBlocks,
    }
  })
  const getLifecycle = Effect.fn("BioLab.getLifecycle")(
    (missionId: string) => state(missionId, undefined),
    checked,
  )
  const requireRunning = Effect.fn("BioLab.requireRunning")(function* (
    run: AgentRun,
  ) {
    const current = yield* state(run.missionId, run.runId)
    if (current.mission.status !== "RUNNING" || current.recoveryRequired)
      return yield* reject("Mission cannot admit new work")
    return current
  })
  const put = Effect.fn("BioLab.retainHandoff")(function* (
    run: AgentRun,
    id: string,
    record: InstitutionalRecord,
  ) {
    const existing = yield* sql<{
      body: string
    }>`SELECT body FROM records WHERE kind = ${record.kind} AND id = ${id}`
    if (existing.length > 0) {
      const parsed = yield* decode(
        Schema.fromJsonString(Schema.Struct({ record: Schema.Json })),
        existing[0].body,
      )
      if (JSON.stringify(parsed.record) !== JSON.stringify(record))
        return yield* reject("Handoff is immutable")
      return { kind: record.kind, id }
    }
    const retained: RetainedRecord = {
      id,
      missionId: run.missionId,
      originRunId: run.runId,
      createdAt: DateTime.toEpochMillis(yield* DateTime.now),
      record,
    }
    yield* sql`INSERT INTO records (kind, id, missionId, runId, body) VALUES (${record.kind}, ${id}, ${run.missionId}, ${run.runId}, ${JSON.stringify(retained)})`
    return { kind: record.kind, id }
  })
  const setMissionStatus = Effect.fn("BioLab.setMissionStatus")(function* (
    missionId: string,
    status: "RUNNING" | "PAUSED" | "STOPPED",
  ) {
    yield* decode(Schema.Literals(["RUNNING", "PAUSED", "STOPPED"]), status)
    return yield* atomic(
      Effect.gen(function* () {
        const mission = yield* deps.getMission(missionId)
        if (mission.status === "STOPPED" && status !== "STOPPED")
          return yield* reject("Stopped missions cannot resume")
        const now = DateTime.toEpochMillis(yield* DateTime.now)
        yield* sql`UPDATE missions SET status = ${status}, updatedAt = ${now} WHERE missionId = ${missionId}`
      }),
    )
  })
  const recordDirectorDecision = Effect.fn("BioLab.recordDirectorDecision")(
    function* (authority: ActorAuthority, input: DirectorDecision) {
      const value = yield* decode(DirectorDecision, input)
      return yield* atomic(
        Effect.gen(function* () {
          const run = yield* deps.authorize(authority)
          if (
            run.role !== "director" ||
            run.purpose === "DIRECTOR_SIDE_WORK" ||
            run.missionId !== value.missionId ||
            value.nextObjective.missionId !== run.missionId ||
            value.nextObjective.originDirectorDecisionId !== value.decisionId
          )
            return yield* reject("Director handoff attribution is invalid")
          const repeated =
            yield* sql`SELECT id FROM records WHERE kind = 'DirectorDecision' AND id = ${value.decisionId} AND runId = ${run.runId}`
          if (repeated.length > 0)
            return yield* put(run, value.decisionId, {
              kind: "DirectorDecision",
              value,
            })
          const current = yield* requireRunning(run)
          if (run.missionRevision !== current.mission.revision)
            return yield* reject(
              "Director run belongs to a stale or unknown mission revision",
            )
          const genesis = yield* getGenesis(run.missionId)
          if (
            !current.genesisComplete &&
            ((genesis?.status !== "READY_FOR_DIRECTION" &&
              genesis?.status !== "DIRECTOR_RUNNING") ||
              genesis.missionRevision !== current.mission.revision)
          )
            return yield* reject(
              "Inaugural Director requires a sufficient Genesis map",
            )
          if (current.validationDue || current.objectiveReady)
            return yield* reject(
              "Director cannot bypass validation or replace a ready objective",
            )
          if (
            current.validationCompletedAwaitingDirectorReview &&
            value.basisValidationReportId !== current.validation?.reportId
          )
            return yield* reject(
              "Director must cite the pending validation report",
            )
          yield* deps.refs(
            [...value.basisRefs, ...value.nextObjective.relevantRefs],
            undefined,
            run.missionId,
          )
          const ref = yield* put(run, value.decisionId, {
            kind: "DirectorDecision",
            value,
          })
          yield* put(run, value.nextObjective.objectiveId, {
            kind: "ResearchObjective",
            value: value.nextObjective,
          })
          yield* sql`INSERT INTO objectives (objectiveId, missionId, decisionId, status) VALUES (${value.nextObjective.objectiveId}, ${run.missionId}, ${value.decisionId}, 'READY')`
          if (!current.genesisComplete && genesis !== null) {
            const completed: GenesisSnapshot = {
              ...genesis,
              status: "COMPLETED",
              completedAt: DateTime.toEpochMillis(yield* DateTime.now),
              inauguralDirectorDecisionId: value.decisionId,
              initialResearchObjectiveId: value.nextObjective.objectiveId,
            }
            yield* sql`UPDATE genesis SET body = ${JSON.stringify(completed)} WHERE missionId = ${run.missionId}`
          }
          if (current.validation?.status === "AWAITING_DIRECTOR") {
            const reviewed: ValidationCycle = {
              ...current.validation,
              status: "REVIEWED",
              decisionId: value.decisionId,
            }
            yield* sql`UPDATE validation_cycles SET body = ${JSON.stringify(reviewed)} WHERE cycleId = ${reviewed.cycleId}`
          }
          return ref
        }),
      )
    },
  )
  const getBlock = Effect.fn("BioLab.getBlock")(function* (id: string) {
    const rows = yield* sql<{
      body: string
    }>`SELECT body FROM research_blocks WHERE blockId = ${id}`
    if (rows.length === 0) return yield* reject("ResearchBlock not found")
    return yield* decode(Schema.fromJsonString(ResearchBlock), rows[0].body)
  })
  const startResearchBlock = Effect.fn("BioLab.startResearchBlock")(function* (
    authority: ActorAuthority,
    objectiveId: string,
    deadline: number,
  ) {
    return yield* atomic(
      Effect.gen(function* () {
        const run = yield* deps.authorize(authority)
        if (run.role !== "researcher" || run.blockId === undefined)
          return yield* reject("Researcher block identity is required")
        const repeated =
          yield* sql`SELECT blockId FROM research_blocks WHERE blockId = ${run.blockId} AND runId = ${run.runId}`
        if (repeated.length > 0) return yield* getBlock(run.blockId)
        const current = yield* requireRunning(run)
        if (
          !current.genesisComplete ||
          !current.objectiveReady ||
          current.objectiveId !== objectiveId
        )
          return yield* reject("ResearchObjective is not legally ready")
        const startedAt = DateTime.toEpochMillis(yield* DateTime.now)
        yield* decode(
          Schema.Finite.check(Schema.isGreaterThan(startedAt)),
          deadline,
        )
        if (deadline <= startedAt)
          return yield* reject("ResearchBlock deadline must be in the future")
        const block: ResearchBlock = {
          blockId: run.blockId,
          runId: run.runId,
          missionId: run.missionId,
          objectiveId,
          startedAt,
          deadline,
          status: "RUNNING",
          classification: "PENDING",
        }
        yield* sql`INSERT INTO research_blocks (blockId, missionId, runId, body) VALUES (${block.blockId}, ${block.missionId}, ${block.runId}, ${JSON.stringify(block)})`
        yield* sql`UPDATE objectives SET status = 'RUNNING' WHERE objectiveId = ${objectiveId}`
        return block
      }),
    )
  })
  const recordDossier = Effect.fn("BioLab.recordDossier")(function* (
    authority: ActorAuthority,
    input: ResearchDossier,
  ) {
    const value = yield* decode(ResearchDossier, input)
    return yield* atomic(
      Effect.gen(function* () {
        const run = yield* deps.authorize(authority)
        if (run.role !== "researcher" || value.blockId !== run.blockId)
          return yield* reject("ResearchDossier belongs to its Researcher")
        const block = yield* getBlock(value.blockId)
        if (
          (block.status !== "RUNNING" &&
            block.status !== "RECOVERY_REQUIRED") ||
          value.objectiveId !== block.objectiveId ||
          block.runId !== run.runId
        )
          return yield* reject("Dossier block is not active")
        if (
          block.dossierId !== undefined &&
          block.dossierId !== value.dossierId
        )
          return yield* reject("Block already has a retained dossier")
        yield* deps.refs(value.scientificResultRefs, "ScientificResult")
        yield* deps.refs(value.resultAssessmentRefs, "ResultAssessment")
        yield* deps.refs(value.interpretationRefs, "Interpretation")
        yield* deps.refs(
          value.semanticMeasurementRefs,
          "SemanticMeasurement",
          run.missionId,
        )
        yield* deps.refs(value.failureRefs, "Failure")
        yield* deps.refs(
          [...value.hypothesisRefs, ...value.capabilityRefs],
          undefined,
          run.missionId,
        )
        const ref = yield* put(run, value.dossierId, {
          kind: "ResearchDossier",
          value,
        })
        yield* sql`UPDATE research_blocks SET body = ${JSON.stringify({ ...block, dossierId: value.dossierId })} WHERE blockId = ${block.blockId}`
        return ref
      }),
    )
  })
  const finishResearchBlock = Effect.fn("BioLab.finishResearchBlock")(
    function* (input: FinishBlock) {
      const value = yield* decode(FinishBlock, input)
      return yield* atomic(
        Effect.gen(function* () {
          const block = yield* getBlock(value.blockId)
          if (block.classification !== "PENDING") {
            if (block.status !== value.status)
              return yield* reject("Terminal block cannot change outcome")
            return block
          }
          if (
            (value.status === "COMPLETED" ||
              value.status === "COMPLETED_NO_RESULTS") &&
            block.dossierId === undefined
          )
            return yield* reject("Completed blocks require an honest dossier")
          const obtained =
            yield* sql`SELECT id FROM records WHERE runId = ${block.runId} AND kind = 'ScientificResult'`
          if (
            (value.status === "COMPLETED" && obtained.length === 0) ||
            (value.status === "COMPLETED_NO_RESULTS" && obtained.length > 0)
          )
            return yield* reject(
              "Completion status disagrees with retained results",
            )
          const finished: ResearchBlock = {
            ...block,
            ...value,
            finishedAt: DateTime.toEpochMillis(yield* DateTime.now),
            classification:
              value.status === "CANCELLED" || block.dossierId === undefined
                ? "ORPHAN"
                : "COUNTABLE",
          }
          yield* sql`UPDATE research_blocks SET body = ${JSON.stringify(finished)} WHERE blockId = ${block.blockId}`
          yield* sql`UPDATE objectives SET status = 'CONSUMED' WHERE objectiveId = ${block.objectiveId}`
          const run = yield* deps.getRun(block.runId)
          yield* sql`UPDATE agent_runs SET body = ${JSON.stringify({ ...run, status: "SETTLED" })} WHERE runId = ${run.runId}`
          const current = yield* state(block.missionId, undefined)
          if (
            current.countableBlocks === 10 &&
            current.validation === undefined
          ) {
            const history = yield* cycles(block.missionId)
            const reviewed = new Set(
              history
                .filter((cycle) => cycle.status === "REVIEWED")
                .flatMap((cycle) => cycle.blockIds),
            )
            const exact = (yield* getResearchBlocks(block.missionId)).filter(
              (b) =>
                b.classification === "COUNTABLE" && !reviewed.has(b.blockId),
            )
            const cycle: ValidationCycle = {
              cycleId: crypto.randomUUID(),
              missionId: block.missionId,
              blockIds: exact.map((b) => b.blockId),
              status: "DUE",
              createdAt: DateTime.toEpochMillis(yield* DateTime.now),
            }
            yield* sql`INSERT INTO validation_cycles (cycleId, missionId, body) VALUES (${cycle.cycleId}, ${cycle.missionId}, ${JSON.stringify(cycle)})`
          }
          return finished
        }),
      )
    },
  )
  const startValidation = Effect.fn("BioLab.startValidation")(function* (
    authority: ActorAuthority,
  ) {
    return yield* atomic(
      Effect.gen(function* () {
        const run = yield* deps.authorize(authority)
        const current = yield* requireRunning(run)
        if (
          run.role !== "validator" ||
          run.blockId === undefined ||
          current.validation?.status !== "DUE"
        )
          return yield* reject("Validation is not legally due")
        const started: ValidationCycle = {
          ...current.validation,
          status: "RUNNING",
          validationBlockId: run.blockId,
          runId: run.runId,
        }
        yield* sql`INSERT INTO validation_blocks (blockId, cycleId, runId, status, startedAt) VALUES (${run.blockId}, ${started.cycleId}, ${run.runId}, 'RUNNING', ${DateTime.toEpochMillis(yield* DateTime.now)})`
        yield* sql`UPDATE validation_cycles SET body = ${JSON.stringify(started)} WHERE cycleId = ${started.cycleId}`
        return started
      }),
    )
  })
  const recordValidationReport = Effect.fn("BioLab.recordValidationReport")(
    function* (authority: ActorAuthority, input: ValidationReport) {
      const value = yield* decode(ValidationReport, input)
      return yield* atomic(
        Effect.gen(function* () {
          const run = yield* deps.authorize(authority)
          const cycle = (yield* cycles(run.missionId)).find(
            (c) => c.cycleId === value.cycleId,
          )
          if (
            run.role !== "validator" ||
            cycle === undefined ||
            cycle.runId !== run.runId ||
            (cycle.status !== "RUNNING" && cycle.reportId !== value.reportId)
          )
            return yield* reject(
              "ValidationReport belongs to the active Validator",
            )
          if (
            JSON.stringify(
              value.blockRefs.map((ref) =>
                ref.kind === "ResearchBlock" ? ref.id : "",
              ),
            ) !== JSON.stringify(cycle.blockIds)
          )
            return yield* reject(
              "Validator must report on the exact ten-block trajectory",
            )
          yield* deps.refs(value.importantRefs, undefined, run.missionId)
          const ref = yield* put(run, value.reportId, {
            kind: "ValidationReport",
            value,
          })
          const pending: ValidationCycle = {
            ...cycle,
            status: "AWAITING_DIRECTOR",
            reportId: value.reportId,
          }
          yield* sql`UPDATE validation_cycles SET body = ${JSON.stringify(pending)} WHERE cycleId = ${cycle.cycleId}`
          return ref
        }),
      )
    },
  )
  const finishValidation = Effect.fn("BioLab.finishValidation")(function* (
    authority: ActorAuthority,
    reason: string,
  ) {
    return yield* atomic(
      Effect.gen(function* () {
        const run = yield* deps.authorize(authority)
        const cycle = (yield* cycles(run.missionId)).find(
          (c) => c.runId === run.runId,
        )
        if (run.role !== "validator" || cycle === undefined)
          return yield* reject("Validation attempt not found")
        if (cycle.reportId === undefined)
          yield* sql`UPDATE validation_cycles SET body = ${JSON.stringify({ ...cycle, status: "DUE" })} WHERE cycleId = ${cycle.cycleId}`
        yield* sql`UPDATE validation_blocks SET status = ${cycle.reportId === undefined ? "FAILED" : "COMPLETED"}, finishedAt = ${DateTime.toEpochMillis(yield* DateTime.now)}, reason = ${reason} WHERE blockId = ${run.blockId}`
        yield* sql`UPDATE agent_runs SET body = ${JSON.stringify({ ...run, status: "SETTLED" })} WHERE runId = ${run.runId}`
      }),
    )
  })
  const markRecoveryRequired = Effect.fn("BioLab.markRecoveryRequired")(
    function* (blockId: string, reason: string) {
      return yield* atomic(
        Effect.gen(function* () {
          const block = yield* getBlock(blockId)
          if (block.classification !== "PENDING") return
          yield* sql`UPDATE research_blocks SET body = ${JSON.stringify({ ...block, status: "RECOVERY_REQUIRED", reason })} WHERE blockId = ${blockId}`
        }),
      )
    },
  )
  return {
    refreshDiscovery: (input: GenesisDiscovery) =>
      recordGenesisDiscovery(input, true).pipe(Effect.asVoid),
    getDiscoveryMeasurement,
    getDiscoveryCandidate,
    searchDiscovery,
    getGenesis,
    recordAgentDiscovery,
    recordGenesisDiscovery: (input: GenesisDiscovery, phase?: "DISCOVERING") =>
      recordGenesisDiscovery(input, false, phase),
    getLifecycle,
    getValidationCycles: (missionId: string) =>
      cycles(missionId).pipe(
        Effect.catchTag(
          "SqlError",
          (cause) =>
            new BioLabError({
              code: "STORAGE",
              operation: "getValidationCycles",
              message: "Validation history could not be read",
              cause,
            }),
        ),
      ),
    getRuns,
    setMissionStatus,
    recordDirectorDecision,
    startResearchBlock,
    recordDossier,
    finishResearchBlock,
    getResearchBlocks,
    startValidation,
    recordValidationReport,
    finishValidation,
    markRecoveryRequired,
  }
}
