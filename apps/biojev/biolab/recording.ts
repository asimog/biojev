import { DateTime, Effect, Schema } from "effect"
import type { SqlClient } from "effect/sql"
import { BioLabError } from "./BioLab.ts"
import type { CanonicalRef } from "./model/Domain.ts"
import { DiscoveredCandidate, GenesisSnapshot } from "./model/Genesis.ts"
import { LearningRecord } from "./model/Learning.ts"
import type { Mission } from "./model/Mission.ts"
import {
  type ActorAuthority,
  AgentRun,
  Artifact,
  BeginRun,
  type ExecutionAuthority,
  Operation,
  RetainedRecord,
  ScienceRecord,
  type SemanticAuthority,
} from "./model/Recording.ts"

const failure = (
  code: BioLabError["code"],
  operation: string,
  message: string,
) => new BioLabError({ code, operation, message })

const decode = <A, I>(schema: Schema.Codec<A, I>, input: unknown) =>
  Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError(
      (cause) =>
        new BioLabError({
          code: "INVALID_INPUT",
          operation: "record",
          message: "Invalid institutional record",
          cause,
        }),
    ),
  )

export const makeRecording = (
  sql: SqlClient.SqlClient,
  getMission: (id: string) => Effect.Effect<Mission, BioLabError>,
) => {
  const authorities = new WeakMap<
    object,
    { runId: string; kind: "actor" | "execution" | "semantic" }
  >()
  const transaction = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    sql.withTransaction(effect).pipe(
      Effect.catchTag(
        "SqlError",
        (cause) =>
          new BioLabError({
            code: "STORAGE",
            operation: "record",
            message: "Institutional recording failed",
            cause,
          }),
      ),
    )
  const getRun = Effect.fn("BioLab.getRun")(
    function* (runId: string) {
      const rows = yield* sql<{
        body: string
      }>`SELECT body FROM agent_runs WHERE runId = ${runId}`
      if (rows.length === 0)
        return yield* failure("NOT_FOUND", "getRun", "Agent run not found")
      return yield* decode(Schema.fromJsonString(AgentRun), rows[0].body)
    },
    Effect.catchTag(
      "SqlError",
      (cause) =>
        new BioLabError({
          code: "STORAGE",
          operation: "getRun",
          message: "Run read failed",
          cause,
        }),
    ),
  )

  const authorize = Effect.fn("BioLab.authorize")(function* (
    authority: ActorAuthority | ExecutionAuthority | SemanticAuthority,
    kind: "actor" | "execution" | "semantic",
  ) {
    const trusted = authorities.get(authority)
    if (
      trusted === undefined ||
      trusted.kind !== kind ||
      trusted.runId !== authority.runId
    ) {
      return yield* failure(
        "UNAUTHORIZED",
        "authorize",
        "Invalid recording authority",
      )
    }
    const run = yield* getRun(trusted.runId)
    if (run.status !== "ACTIVE")
      return yield* failure("UNAUTHORIZED", "authorize", "Agent run is settled")
    return run
  })

  const reopenRun = Effect.fn("BioLab.reopenRun")(function* (runId: string) {
    const run = yield* getRun(runId)
    if (run.status !== "ACTIVE")
      return yield* failure(
        "CONFLICT",
        "reopenRun",
        "Settled runs cannot recover write authority",
      )
    const actor: ActorAuthority = Object.freeze({ runId, kind: "actor" })
    const execution: ExecutionAuthority = Object.freeze({
      runId,
      kind: "execution",
    })
    authorities.set(actor, actor)
    authorities.set(execution, execution)
    const semantic: SemanticAuthority = Object.freeze({
      runId,
      kind: "semantic",
    })
    authorities.set(semantic, semantic)
    return { actor, execution, semantic }
  })
  const beginRun = Effect.fn("BioLab.beginRun")(function* (
    input: BeginRun,
    expectedMissionRevision?: number,
  ) {
    const value = yield* decode(BeginRun, input)
    if (expectedMissionRevision !== undefined)
      yield* decode(
        Schema.Int.check(Schema.isGreaterThan(0)),
        expectedMissionRevision,
      )
    return yield* transaction(
      Effect.gen(function* () {
        const mission = yield* getMission(value.missionId)
        if (
          expectedMissionRevision !== undefined &&
          expectedMissionRevision !== mission.revision
        )
          return yield* failure(
            "CONFLICT",
            "beginRun",
            "Mission changed before role admission",
          )
        if (mission.status !== "RUNNING")
          return yield* failure(
            "CONFLICT",
            "beginRun",
            "Mission is not running",
          )
        if (value.purpose === "DIRECTOR_SIDE_WORK") {
          const liveRows = yield* sql<{
            body: string
          }>`SELECT body FROM agent_runs WHERE missionId = ${value.missionId} AND json_extract(body, '$.status') = 'ACTIVE'`
          const live = yield* Effect.forEach(liveRows, (row) =>
            decode(Schema.fromJsonString(AgentRun), row.body),
          )
          if (
            value.role !== "director" ||
            !live.some((run) => run.role === "researcher") ||
            live.some((run) => run.role === "director")
          )
            return yield* failure(
              "CONFLICT",
              "beginRun",
              "Director side work requires one active Researcher and no active Director",
            )
        }
        const rows = yield* sql<{
          body: string
        }>`SELECT body FROM agent_runs WHERE runId = ${value.runId}`
        if (rows.length === 0) {
          const run: AgentRun = {
            ...value,
            missionRevision: mission.revision,
            status: "ACTIVE",
            createdAt: DateTime.toEpochMillis(yield* DateTime.now),
          }
          yield* sql`INSERT INTO agent_runs (runId, missionId, body) VALUES (${value.runId}, ${value.missionId}, ${JSON.stringify(run)})`
          if (run.role === "director") {
            const rows = yield* sql<{
              body: string
            }>`SELECT body FROM genesis WHERE missionId = ${run.missionId}`
            if (rows.length === 0) {
              const initial: GenesisSnapshot = {
                genesisId: `${run.missionId}:genesis`,
                missionId: run.missionId,
                missionRevision: mission.revision,
                programId: "director-discovery",
                programVersion: "1",
                configuredInputIds: [],
                outcomes: [],
                sourceIds: [],
                capabilityIds: [],
                semanticMeasurementIds: [],
                normalizerVersions: [],
                sourceRecordsImported: 0,
                capabilityCandidatesImported: 0,
                startedAt: run.createdAt,
                completedAt: null,
                status: "DISCOVERING",
                inauguralDirectorDecisionId: null,
                initialResearchObjectiveId: null,
              }
              yield* sql`INSERT INTO genesis (missionId, body) VALUES (${run.missionId}, ${JSON.stringify(initial)})`
            }
            if (rows.length > 0) {
              const genesis = yield* decode(
                Schema.fromJsonString(GenesisSnapshot),
                rows[0].body,
              )
              if (
                genesis.status === "READY_FOR_DIRECTION" &&
                genesis.missionRevision === run.missionRevision
              )
                yield* sql`UPDATE genesis SET body = ${JSON.stringify({ ...genesis, status: "DIRECTOR_RUNNING" })} WHERE missionId = ${run.missionId}`
            }
          }
        } else {
          const existing = yield* getRun(value.runId)
          const {
            status,
            createdAt: _createdAt,
            missionRevision: _revision,
            ...identity
          } = existing
          if (
            status !== "ACTIVE" ||
            JSON.stringify(identity) !== JSON.stringify(value)
          ) {
            return yield* failure(
              "CONFLICT",
              "beginRun",
              "Run identity changed or already settled",
            )
          }
        }
        return yield* reopenRun(value.runId)
      }),
    )
  })
  const getOperations = Effect.fn("BioLab.getOperations")(
    function* (runId: string) {
      yield* getRun(runId)
      const rows = yield* sql<{
        body: string
      }>`SELECT body FROM operations WHERE runId = ${runId} ORDER BY rowid`
      return yield* Effect.forEach(rows, (row) =>
        decode(Schema.fromJsonString(Operation), row.body),
      )
    },
    Effect.catchTag(
      "SqlError",
      (cause) =>
        new BioLabError({
          code: "STORAGE",
          operation: "getOperations",
          message: "Operation history could not be read",
          cause,
        }),
    ),
  )
  const settleRun = Effect.fn("BioLab.settleRun")(function* (runId: string) {
    return yield* transaction(
      Effect.gen(function* () {
        const run = yield* getRun(runId)
        yield* sql`UPDATE agent_runs SET body = ${JSON.stringify({ ...run, status: "SETTLED" })} WHERE runId = ${runId}`
        if (run.role === "director") {
          const rows = yield* sql<{
            body: string
          }>`SELECT body FROM genesis WHERE missionId = ${run.missionId}`
          if (rows.length > 0) {
            const genesis = yield* decode(
              Schema.fromJsonString(GenesisSnapshot),
              rows[0].body,
            )
            if (genesis.status === "DISCOVERING")
              yield* sql`UPDATE genesis SET body = ${JSON.stringify({ ...genesis, status: "FAILED" })} WHERE missionId = ${run.missionId}`
            if (genesis.status === "DIRECTOR_RUNNING")
              yield* sql`UPDATE genesis SET body = ${JSON.stringify({ ...genesis, status: "READY_FOR_DIRECTION" })} WHERE missionId = ${run.missionId}`
          }
        }
      }),
    )
  })
  const receipt = Effect.fn("BioLab.receipt")(function* (
    id: string,
    runId: string,
  ) {
    const rows = yield* sql<{
      body: string
    }>`SELECT body FROM operations WHERE receiptId = ${id} AND runId = ${runId}`
    if (rows.length === 0)
      return yield* failure(
        "UNAUTHORIZED",
        "receipt",
        "Operation does not belong to this run",
      )
    return yield* decode(Schema.fromJsonString(Operation), rows[0].body)
  })
  const recordOperation = Effect.fn("BioLab.recordOperation")(function* (
    authority: ExecutionAuthority,
    input: Operation,
  ) {
    const value = yield* decode(Operation, input)
    return yield* transaction(
      Effect.gen(function* () {
        const run = yield* authorize(authority, "execution")
        if (
          value.environmentId !== run.environmentId ||
          value.endedAt < value.startedAt
        ) {
          return yield* failure(
            "UNAUTHORIZED",
            "recordOperation",
            "Operation environment or chronology is invalid",
          )
        }
        const body = JSON.stringify(value)
        const existing = yield* sql<{
          body: string
          runId: string
        }>`SELECT body, runId FROM operations WHERE receiptId = ${value.receiptId}`
        if (existing.length > 0) {
          if (existing[0].body !== body || existing[0].runId !== run.runId)
            return yield* failure(
              "CONFLICT",
              "recordOperation",
              "Receipt is immutable",
            )
        } else {
          yield* sql`INSERT INTO operations (receiptId, runId, body) VALUES (${value.receiptId}, ${run.runId}, ${body})`
        }
        return { kind: "OperationReceipt", id: value.receiptId }
      }),
    )
  })
  const recordArtifact = Effect.fn("BioLab.recordArtifact")(function* (
    authority: ExecutionAuthority,
    input: Artifact,
  ) {
    const value = yield* decode(Artifact, input)
    return yield* transaction(
      Effect.gen(function* () {
        const run = yield* authorize(authority, "execution")
        const source = yield* receipt(value.receiptId, run.runId)
        if (
          source.method !== "readBinaryFile" ||
          source.outcome !== "SUCCEEDED"
        )
          return yield* failure(
            "UNAUTHORIZED",
            "recordArtifact",
            "Artifact needs an actual successful read",
          )
        const existing = yield* sql<{
          bytes: number
        }>`SELECT bytes FROM artifacts WHERE artifactId = ${value.artifactId}`
        if (existing.length > 0 && existing[0].bytes !== value.bytes)
          return yield* failure(
            "CONFLICT",
            "recordArtifact",
            "Artifact metadata is immutable",
          )
        yield* sql`INSERT OR IGNORE INTO artifacts (artifactId, bytes) VALUES (${value.artifactId}, ${value.bytes})`
        yield* sql`INSERT OR IGNORE INTO artifact_origins (artifactId, receiptId, runId) VALUES (${value.artifactId}, ${value.receiptId}, ${run.runId})`
        return { kind: "Artifact", id: value.artifactId }
      }),
    )
  })
  const getRecord = Effect.fn("BioLab.getRecord")(
    function* (ref: CanonicalRef) {
      const rows = yield* sql<{
        body: string
      }>`SELECT body FROM records WHERE kind = ${ref.kind} AND id = ${ref.id}`
      if (rows.length === 0)
        return yield* failure(
          "NOT_FOUND",
          "getRecord",
          "Canonical record not found",
        )
      return yield* decode(Schema.fromJsonString(RetainedRecord), rows[0].body)
    },
    Effect.catchTag(
      "SqlError",
      (cause) =>
        new BioLabError({
          code: "STORAGE",
          operation: "getRecord",
          message: "Record read failed",
          cause,
        }),
    ),
  )
  const getArtifact = Effect.fn("BioLab.getArtifact")(function* (
    authority: ActorAuthority,
    artifactId: string,
  ) {
    return yield* transaction(
      Effect.gen(function* () {
        const run = yield* authorize(authority, "actor")
        const rows = yield* sql<{
          artifactId: string
          bytes: number
        }>`SELECT DISTINCT a.artifactId, a.bytes FROM artifacts a JOIN artifact_origins o ON o.artifactId = a.artifactId JOIN agent_runs r ON r.runId = o.runId WHERE a.artifactId = ${artifactId} AND r.missionId = ${run.missionId}`
        if (rows.length === 0)
          return yield* failure(
            "UNAUTHORIZED",
            "getArtifact",
            "Artifact is not retained for this mission",
          )
        return rows[0]
      }),
    )
  })
  const references = Effect.fn("BioLab.references")(function* (
    refs: ReadonlyArray<CanonicalRef>,
    expectedKind?: string,
    missionId?: string,
  ) {
    if (expectedKind !== undefined)
      yield* decode(
        Schema.Array(
          Schema.Struct({
            kind: Schema.Literal(expectedKind),
            id: Schema.String,
          }),
        ),
        refs,
      )
    for (const ref of refs) {
      if (
        ref.kind === "DiscoveredSource" ||
        ref.kind === "DiscoveredCapability"
      ) {
        if (missionId === undefined)
          return yield* failure(
            "INVALID_INPUT",
            "references",
            "Discovery references require mission attribution",
          )
        const rows = yield* sql<{
          body: string
        }>`SELECT body FROM discovered_candidates WHERE missionId = ${missionId} AND id = ${ref.id}`
        if (rows.length === 0)
          return yield* failure(
            "NOT_FOUND",
            "references",
            "Discovery candidate not found",
          )
        const candidate = yield* decode(
          Schema.fromJsonString(DiscoveredCandidate),
          rows[0].body,
        )
        if (
          ref.kind !==
          (candidate.kind === "source"
            ? "DiscoveredSource"
            : "DiscoveredCapability")
        )
          return yield* failure(
            "INVALID_INPUT",
            "references",
            "Discovery reference kind mismatch",
          )
      } else if (
        ref.kind === "SemanticMeasurement" &&
        missionId !== undefined &&
        (yield* sql`SELECT id FROM genesis_measurements WHERE missionId = ${missionId} AND id = ${ref.id}`)
          .length > 0
      ) {
      } else if (ref.kind === "Artifact") {
        const rows =
          yield* sql`SELECT artifactId FROM artifacts WHERE artifactId = ${ref.id}`
        if (rows.length === 0)
          return yield* failure("NOT_FOUND", "references", "Artifact not found")
      } else yield* getRecord(ref)
    }
  })
  const idOf = (record: ScienceRecord) => {
    switch (record.kind) {
      case "ScientificResult":
        return record.value.resultId
      case "Interpretation":
        return record.value.interpretationId
      case "HypothesisRevision":
        return record.value.revisionId
      case "ResultAssessment":
        return record.value.assessmentId
      case "Failure":
        return record.value.failureId
      case "Uncertainty":
        return record.value.uncertaintyId
    }
  }
  const retain = Effect.fn("BioLab.retainScience")(function* (
    authority: ActorAuthority,
    input: ScienceRecord,
  ) {
    const record = yield* decode(ScienceRecord, input)
    return yield* transaction(
      Effect.gen(function* () {
        const run = yield* authorize(authority, "actor")
        const value = record.value
        if (
          value.originRunId !== run.runId ||
          ("actorRole" in value && value.actorRole !== run.role)
        )
          return yield* failure(
            "UNAUTHORIZED",
            "retainScience",
            "Record attribution is forged",
          )
        if (record.kind === "HypothesisRevision" && run.role === "validator")
          return yield* failure(
            "UNAUTHORIZED",
            "retainScience",
            "Validator cannot revise hypotheses",
          )
        const id = idOf(record)
        yield* decode(Schema.NonEmptyString, id)
        const body = JSON.stringify(record)
        const existing = yield* sql<{
          record: string
        }>`SELECT json_extract(body, '$.record') AS record FROM records WHERE kind = ${record.kind} AND id = ${id}`
        if (existing.length > 0) {
          if (existing[0].record !== body)
            return yield* failure(
              "CONFLICT",
              "retainScience",
              "Canonical history is immutable",
            )
          return { kind: record.kind, id }
        }
        if (record.kind === "ScientificResult") {
          if (record.value.capabilityVersionId !== undefined)
            yield* references([
              {
                kind: "CapabilityVersion",
                id: record.value.capabilityVersionId,
              },
            ])
          const obtained = yield* receipt(
            record.value.executionReceiptId,
            run.runId,
          )
          const executed = Schema.is(
            Schema.Struct({
              ok: Schema.Literal(true),
              value: Schema.Struct({ exitCode: Schema.Int }),
            }),
          )(obtained.result)
          if (
            obtained.method !== "exec" ||
            !executed ||
            obtained.outcome === "INTERRUPTED" ||
            record.value.originBlockId !== run.blockId
          )
            return yield* failure(
              "UNAUTHORIZED",
              "retainScience",
              "Result needs attributable settled execution",
            )
          yield* references(record.value.inputRefs, undefined, run.missionId)
          for (const ref of record.value.outputRefs) {
            const outputs =
              yield* sql`SELECT artifactId FROM artifact_origins WHERE artifactId = ${ref.id} AND runId = ${run.runId}`
            if (ref.kind !== "Artifact" || outputs.length === 0)
              return yield* failure(
                "UNAUTHORIZED",
                "retainScience",
                "Output artifact is unrelated to this run",
              )
          }
        } else {
          if (record.kind === "ResultAssessment") {
            yield* references([record.value.resultRef], "ScientificResult")
            yield* references(
              record.value.relatedRefs,
              undefined,
              run.missionId,
            )
          } else
            yield* references(record.value.basisRefs, undefined, run.missionId)
          if (record.kind === "HypothesisRevision") {
            const previous = yield* sql<{
              id: string
            }>`SELECT id FROM records WHERE kind = 'HypothesisRevision' AND missionId = ${run.missionId} AND json_extract(body, '$.record.value.hypothesisId') = ${record.value.hypothesisId} ORDER BY rowid DESC LIMIT 1`
            if (
              previous.length > 0 &&
              !record.value.basisRefs.some(
                (ref) =>
                  ref.kind === "HypothesisRevision" &&
                  ref.id === previous[0].id,
              )
            )
              return yield* failure(
                "CONFLICT",
                "retainScience",
                `Hypothesis revision must cite the latest revision in basisRefs: ${JSON.stringify({ kind: "HypothesisRevision", id: previous[0].id })}`,
              )
          }
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
      }),
    )
  })
  const searchMemory = Effect.fn("BioLab.searchMemory")(
    function* (missionId: string, text: string) {
      yield* getMission(missionId)
      const terms = [
        ...new Set(text.toLowerCase().match(/[\p{L}\p{N}_:-]+/gu) ?? []),
      ].slice(0, 32)
      const score =
        terms.length === 0
          ? sql.literal("0")
          : sql.join(" + ")(
              terms.map((term) => sql`(instr(lower(body), ${term}) > 0)`),
            )
      const rows = yield* sql<{
        body: string
      }>`SELECT body, ${score} AS relevance FROM records WHERE missionId = ${missionId} AND ${terms.length === 0 ? sql.literal("1 = 1") : sql.or(terms.map((term) => sql`instr(lower(body), ${term}) > 0`))} ORDER BY relevance DESC, rowid DESC LIMIT 100`
      return yield* Effect.forEach(rows, (row) =>
        decode(Schema.fromJsonString(RetainedRecord), row.body),
      )
    },
    Effect.catchTag(
      "SqlError",
      (cause) =>
        new BioLabError({
          code: "STORAGE",
          operation: "searchMemory",
          message: "Memory search failed",
          cause,
        }),
    ),
  )
  const getRunCompletion = Effect.fn("BioLab.getRunCompletion")(
    function* (runId: string) {
      const run = yield* getRun(runId)
      const expected =
        run.role === "director"
          ? "DirectorDecision"
          : run.role === "researcher"
            ? "ResearchDossier"
            : "ValidationReport"
      const rows = yield* sql<{
        kind: string
      }>`SELECT DISTINCT kind FROM records WHERE runId = ${runId} AND kind IN ('ScientificResult', ${expected})`
      return {
        handoffRetained: rows.some((row) => row.kind === expected),
        hasScientificResults: rows.some(
          (row) => row.kind === "ScientificResult",
        ),
      }
    },
    Effect.catchTag(
      "SqlError",
      (cause) =>
        new BioLabError({
          code: "STORAGE",
          operation: "getRunCompletion",
          message: "Run completion facts could not be read",
          cause,
        }),
    ),
  )
  const getHistory = Effect.fn("BioLab.getHistory")(
    function* (missionId: string, after = 0, limit = 100) {
      yield* getMission(missionId)
      yield* decode(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)), after)
      yield* decode(
        Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 })),
        limit,
      )
      const rows = yield* sql<{
        rowid: number
        body: string
      }>`SELECT rowid, body FROM records WHERE missionId = ${missionId} AND rowid > ${after} ORDER BY rowid LIMIT ${limit + 1}`
      return {
        records: yield* Effect.forEach(rows.slice(0, limit), (row) =>
          decode(Schema.fromJsonString(RetainedRecord), row.body),
        ),
        next: rows.length > limit ? rows[limit - 1].rowid : null,
        cursor: rows[Math.min(rows.length, limit) - 1]?.rowid ?? after,
      }
    },
    (effect) => transaction(effect),
  )
  const retainLearning = Effect.fn("BioLab.retainLearning")(function* (
    authority: ActorAuthority | SemanticAuthority,
    input: LearningRecord,
  ) {
    const record = yield* decode(LearningRecord, input)
    return yield* transaction(
      Effect.gen(function* () {
        const run = yield* authorize(
          authority,
          record.kind === "SemanticMeasurement" ? "semantic" : "actor",
        )
        if (record.value.originRunId !== run.runId)
          return yield* failure(
            "UNAUTHORIZED",
            "retainLearning",
            "Learning attribution is forged",
          )
        const id =
          record.kind === "SemanticMeasurement"
            ? record.value.measurementId
            : record.kind === "CapabilityVersion"
              ? record.value.versionId
              : record.kind === "CapabilityAssessment"
                ? record.value.assessmentId
                : record.value.selectionId
        const existing = yield* sql<{
          body: string
        }>`SELECT body FROM records WHERE kind = ${record.kind} AND id = ${id}`
        if (existing.length > 0) {
          const retained = yield* decode(
            Schema.fromJsonString(RetainedRecord),
            existing[0].body,
          )
          if (JSON.stringify(retained.record) !== JSON.stringify(record))
            return yield* failure(
              "CONFLICT",
              "retainLearning",
              "Learning history is immutable",
            )
          return { kind: record.kind, id }
        }
        if (record.kind === "SemanticMeasurement")
          yield* references(record.value.subjectRefs, undefined, run.missionId)
        else if (record.kind === "CapabilityVersion") {
          if (run.role !== "researcher")
            return yield* failure(
              "UNAUTHORIZED",
              "retainLearning",
              "Only Researcher discovers capability versions",
            )
          if (authority.kind !== "actor")
            return yield* failure(
              "UNAUTHORIZED",
              "retainLearning",
              "Capability recording requires actor authority",
            )
          for (const ref of record.value.artifactRefs) {
            yield* references([ref], "Artifact")
            yield* getArtifact(authority, ref.id)
          }
          if (
            record.value.status === "QUALIFIED" &&
            record.value.qualificationResultRefs.length === 0
          )
            return yield* failure(
              "INVALID_INPUT",
              "retainLearning",
              "Qualification requires obtained results",
            )
          yield* references(
            record.value.qualificationResultRefs,
            "ScientificResult",
          )
          for (const ref of record.value.qualificationResultRefs) {
            const retained = yield* getRecord(ref)
            if (
              retained.originRunId !== run.runId ||
              retained.record.kind !== "ScientificResult"
            )
              return yield* failure(
                "UNAUTHORIZED",
                "retainLearning",
                "Qualification must be attributable to this run",
              )
            const obtained = yield* receipt(
              retained.record.value.executionReceiptId,
              run.runId,
            )
            if (
              !Schema.is(
                Schema.Struct({
                  ok: Schema.Literal(true),
                  value: Schema.Struct({ exitCode: Schema.Literal(0) }),
                }),
              )(obtained.result) ||
              obtained.outcome !== "SUCCEEDED"
            )
              return yield* failure(
                "INVALID_INPUT",
                "retainLearning",
                "Qualification requires successful computation",
              )
          }
        } else if (record.kind === "CapabilityAssessment") {
          if (record.value.actorRole !== run.role)
            return yield* failure(
              "UNAUTHORIZED",
              "retainLearning",
              "Assessment role is forged",
            )
          yield* references([record.value.versionRef], "CapabilityVersion")
          yield* references(record.value.basisRefs, undefined, run.missionId)
        } else {
          if (run.role !== "director")
            return yield* failure(
              "UNAUTHORIZED",
              "retainLearning",
              "Only Director selects capability defaults",
            )
          if (record.value.versionRef !== null) {
            yield* references([record.value.versionRef], "CapabilityVersion")
            const version = yield* getRecord(record.value.versionRef)
            if (
              version.missionId !== run.missionId ||
              version.record.kind !== "CapabilityVersion" ||
              version.record.value.capabilityId !== record.value.capabilityId ||
              version.record.value.status !== "QUALIFIED"
            )
              return yield* failure(
                "INVALID_INPUT",
                "retainLearning",
                "Default must select a qualified version for this capability",
              )
          }
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
      }),
    )
  })
  const getCapabilityDefaults = Effect.fn("BioLab.getCapabilityDefaults")(
    function* (missionId: string) {
      yield* getMission(missionId)
      const rows = yield* sql<{
        body: string
      }>`SELECT body FROM records WHERE missionId = ${missionId} AND kind = 'CapabilitySelection' ORDER BY rowid DESC`
      const seen = new Set<string>()
      const selected = []
      for (const row of rows) {
        const retained = yield* decode(
          Schema.fromJsonString(RetainedRecord),
          row.body,
        )
        if (
          retained.record.kind === "CapabilitySelection" &&
          !seen.has(retained.record.value.capabilityId)
        ) {
          seen.add(retained.record.value.capabilityId)
          selected.push(retained.record.value)
        }
      }
      return selected
    },
    (effect) => transaction(effect),
  )
  return {
    beginRun,
    reopenRun,
    getRun,
    getOperations,
    settleRun,
    recordOperation,
    recordArtifact,
    getRecord,
    getArtifact,
    authorizeActor: (authority: ActorAuthority) =>
      authorize(authority, "actor"),
    checkReferences: references,
    searchMemory,
    getRunCompletion,
    getHistory,
    getCapabilityDefaults,
    recordSemanticMeasurement: (
      authority: SemanticAuthority,
      value: Extract<LearningRecord, { kind: "SemanticMeasurement" }>["value"],
    ) => retainLearning(authority, { kind: "SemanticMeasurement", value }),
    recordCapabilityVersion: (
      authority: ActorAuthority,
      value: Extract<LearningRecord, { kind: "CapabilityVersion" }>["value"],
    ) => retainLearning(authority, { kind: "CapabilityVersion", value }),
    recordCapabilityAssessment: (
      authority: ActorAuthority,
      value: Extract<LearningRecord, { kind: "CapabilityAssessment" }>["value"],
    ) => retainLearning(authority, { kind: "CapabilityAssessment", value }),
    recordCapabilitySelection: (
      authority: ActorAuthority,
      value: Extract<LearningRecord, { kind: "CapabilitySelection" }>["value"],
    ) => retainLearning(authority, { kind: "CapabilitySelection", value }),
    recordScientificResult: (
      a: ActorAuthority,
      value: Extract<ScienceRecord, { kind: "ScientificResult" }>["value"],
    ) => retain(a, { kind: "ScientificResult", value }),
    recordInterpretation: (
      a: ActorAuthority,
      value: Extract<ScienceRecord, { kind: "Interpretation" }>["value"],
    ) => retain(a, { kind: "Interpretation", value }),
    recordHypothesisRevision: (
      a: ActorAuthority,
      value: Extract<ScienceRecord, { kind: "HypothesisRevision" }>["value"],
    ) => retain(a, { kind: "HypothesisRevision", value }),
    recordResultAssessment: (
      a: ActorAuthority,
      value: Extract<ScienceRecord, { kind: "ResultAssessment" }>["value"],
    ) => retain(a, { kind: "ResultAssessment", value }),
    recordFailure: (
      a: ActorAuthority,
      value: Extract<ScienceRecord, { kind: "Failure" }>["value"],
    ) => retain(a, { kind: "Failure", value }),
    recordUncertainty: (
      a: ActorAuthority,
      value: Extract<ScienceRecord, { kind: "Uncertainty" }>["value"],
    ) => retain(a, { kind: "Uncertainty", value }),
  }
}
