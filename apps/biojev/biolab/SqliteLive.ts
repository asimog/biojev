import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-node"
import { DateTime, Effect, Layer, Schema } from "effect"
import { SqlClient } from "effect/sql"
import { BioLab, BioLabError } from "./BioLab.ts"
import { makeLifecycle } from "./lifecycle.ts"
import {
  CreateMission,
  Mission,
  MissionRevision,
  ReviseMission,
} from "./model/Mission.ts"
import { makeRecording } from "./recording.ts"

const storageFailure = (operation: string) => (cause: unknown) =>
  new BioLabError({
    code: "STORAGE",
    operation,
    message: "Institutional storage operation failed",
    cause,
  })

export const BioLabLive = (filename: string) =>
  Layer.effect(
    BioLab,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      yield* sql`PRAGMA foreign_keys = ON`.pipe(
        Effect.mapError(storageFailure("enableConstraints")),
      )
      yield* SqliteMigrator.run({
        loader: SqliteMigrator.fromRecord({
          "0001_missions": Effect.gen(function* () {
            const db = yield* SqlClient.SqlClient
            yield* db`CREATE TABLE missions (
            missionId TEXT PRIMARY KEY,
            revision INTEGER NOT NULL CHECK(revision > 0),
            status TEXT NOT NULL CHECK(status IN ('RUNNING', 'PAUSED', 'STOPPED')),
            createdAt REAL NOT NULL,
            updatedAt REAL NOT NULL
          )`
            yield* db`CREATE TABLE mission_revisions (
            missionId TEXT NOT NULL REFERENCES missions(missionId),
            revision INTEGER NOT NULL CHECK(revision > 0),
            statement TEXT NOT NULL,
            createdAt REAL NOT NULL,
            PRIMARY KEY (missionId, revision)
          )`
          }),
          "0002_recording": Effect.gen(function* () {
            const db = yield* SqlClient.SqlClient
            yield* db`CREATE TABLE agent_runs (runId TEXT PRIMARY KEY, missionId TEXT NOT NULL REFERENCES missions(missionId), body TEXT NOT NULL)`
            yield* db`CREATE TABLE operations (receiptId TEXT PRIMARY KEY, runId TEXT NOT NULL REFERENCES agent_runs(runId), body TEXT NOT NULL)`
            yield* db`CREATE TABLE artifacts (artifactId TEXT PRIMARY KEY, bytes INTEGER NOT NULL CHECK(bytes >= 0))`
            yield* db`CREATE TABLE artifact_origins (artifactId TEXT NOT NULL REFERENCES artifacts(artifactId), receiptId TEXT NOT NULL REFERENCES operations(receiptId), runId TEXT NOT NULL REFERENCES agent_runs(runId), PRIMARY KEY(artifactId, receiptId))`
            yield* db`CREATE TABLE records (kind TEXT NOT NULL, id TEXT NOT NULL, missionId TEXT NOT NULL REFERENCES missions(missionId), runId TEXT NOT NULL REFERENCES agent_runs(runId), body TEXT NOT NULL, PRIMARY KEY(kind, id))`
            yield* db`CREATE INDEX records_mission ON records(missionId)`
          }),
          "0004_genesis": Effect.gen(function* () {
            const db = yield* SqlClient.SqlClient
            yield* db`CREATE TABLE genesis (missionId TEXT PRIMARY KEY REFERENCES missions(missionId), body TEXT NOT NULL)`
            yield* db`CREATE TABLE discovered_candidates (missionId TEXT NOT NULL REFERENCES missions(missionId), id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(missionId, id))`
            yield* db`CREATE TABLE genesis_measurements (missionId TEXT NOT NULL REFERENCES missions(missionId), id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(missionId, id))`
            yield* db`CREATE TABLE genesis_attempts (missionId TEXT NOT NULL REFERENCES missions(missionId), body TEXT NOT NULL)`
          }),
          "0003_lifecycle": Effect.gen(function* () {
            const db = yield* SqlClient.SqlClient
            yield* db`CREATE TABLE objectives (objectiveId TEXT PRIMARY KEY, missionId TEXT NOT NULL REFERENCES missions(missionId), decisionId TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('READY','RUNNING','CONSUMED')))`
            yield* db`CREATE UNIQUE INDEX one_ready_objective ON objectives(missionId) WHERE status = 'READY'`
            yield* db`CREATE TABLE research_blocks (blockId TEXT PRIMARY KEY, missionId TEXT NOT NULL REFERENCES missions(missionId), runId TEXT NOT NULL UNIQUE REFERENCES agent_runs(runId), body TEXT NOT NULL)`
            yield* db`CREATE TABLE validation_cycles (cycleId TEXT PRIMARY KEY, missionId TEXT NOT NULL REFERENCES missions(missionId), body TEXT NOT NULL)`
            yield* db`CREATE TABLE validation_blocks (blockId TEXT PRIMARY KEY, cycleId TEXT NOT NULL REFERENCES validation_cycles(cycleId), runId TEXT NOT NULL UNIQUE REFERENCES agent_runs(runId), status TEXT NOT NULL, startedAt REAL NOT NULL, finishedAt REAL, reason TEXT)`
          }),
        }),
      }).pipe(Effect.mapError(storageFailure("migrate")))

      const readMissions = Effect.fn("BioLab.readMissions")(
        function* (missionId: string | undefined) {
          const rows = yield* sql`SELECT m.missionId, m.revision, m.status,
        m.createdAt, m.updatedAt, r.statement
        FROM missions m JOIN mission_revisions r
        ON r.missionId = m.missionId AND r.revision = m.revision
        WHERE ${missionId === undefined ? sql.literal("1 = 1") : sql`m.missionId = ${missionId}`}
        ORDER BY m.createdAt, m.missionId`
          return yield* Schema.decodeUnknownEffect(Schema.Array(Mission))(rows)
        },
        Effect.mapError(storageFailure("readMissions")),
      )

      const getMission = Effect.fn("BioLab.getMission")(function* (
        missionId: string,
      ) {
        const rows = yield* readMissions(missionId)
        if (rows.length === 0)
          return yield* new BioLabError({
            code: "NOT_FOUND",
            operation: "getMission",
            message: "Mission was not found",
          })
        return rows[0]
      })

      const getMissionRevisions = Effect.fn("BioLab.getMissionRevisions")(
        function* (missionId: string) {
          yield* getMission(missionId)
          const rows =
            yield* sql`SELECT missionId, revision, statement, createdAt
        FROM mission_revisions WHERE missionId = ${missionId} ORDER BY revision`.pipe(
              Effect.mapError(storageFailure("getMissionRevisions")),
            )
          return yield* Schema.decodeUnknownEffect(
            Schema.Array(MissionRevision),
          )(rows).pipe(Effect.mapError(storageFailure("getMissionRevisions")))
        },
      )

      const createMission = Effect.fn("BioLab.createMission")(function* (
        input: CreateMission,
      ) {
        const validated = yield* Schema.decodeEffect(CreateMission)(input).pipe(
          Effect.mapError(
            (cause) =>
              new BioLabError({
                code: "INVALID_INPUT",
                operation: "createMission",
                message: "Invalid mission",
                cause,
              }),
          ),
        )
        return yield* sql
          .withTransaction(
            Effect.gen(function* () {
              const existing = yield* readMissions(validated.missionId)
              if (existing.length > 0) {
                const revisions = yield* getMissionRevisions(
                  validated.missionId,
                )
                if (revisions[0].statement !== validated.statement)
                  return yield* new BioLabError({
                    code: "CONFLICT",
                    operation: "createMission",
                    message:
                      "Mission identity already has a different initial statement",
                  })
                return existing[0]
              }
              const now = DateTime.toEpochMillis(yield* DateTime.now)
              yield* sql`INSERT INTO missions (missionId, revision, status, createdAt, updatedAt)
          VALUES (${validated.missionId}, 1, 'RUNNING', ${now}, ${now})`
              yield* sql`INSERT INTO mission_revisions (missionId, revision, statement, createdAt)
          VALUES (${validated.missionId}, 1, ${validated.statement}, ${now})`
              return yield* getMission(validated.missionId)
            }),
          )
          .pipe(
            Effect.catchTag("SqlError", (cause) =>
              storageFailure("createMission")(cause),
            ),
          )
      })

      const reviseMission = Effect.fn("BioLab.reviseMission")(function* (
        input: ReviseMission,
      ) {
        const validated = yield* Schema.decodeEffect(ReviseMission)(input).pipe(
          Effect.mapError(
            (cause) =>
              new BioLabError({
                code: "INVALID_INPUT",
                operation: "reviseMission",
                message: "Invalid mission revision",
                cause,
              }),
          ),
        )
        return yield* sql
          .withTransaction(
            Effect.gen(function* () {
              const mission = yield* getMission(validated.missionId)
              if (
                mission.revision === validated.expectedRevision + 1 &&
                mission.statement === validated.statement
              )
                return mission
              if (
                mission.revision !== validated.expectedRevision ||
                mission.status === "STOPPED"
              )
                return yield* new BioLabError({
                  code: "CONFLICT",
                  operation: "reviseMission",
                  message: "Mission revision is stale or mission has stopped",
                })
              const now = DateTime.toEpochMillis(yield* DateTime.now)
              const next = mission.revision + 1
              yield* sql`INSERT INTO mission_revisions (missionId, revision, statement, createdAt)
          VALUES (${validated.missionId}, ${next}, ${validated.statement}, ${now})`
              yield* sql`UPDATE missions SET revision = ${next}, updatedAt = ${now}
          WHERE missionId = ${validated.missionId}`
              yield* sql`UPDATE objectives SET status = 'CONSUMED' WHERE missionId = ${validated.missionId} AND status = 'READY'`
              return yield* getMission(validated.missionId)
            }),
          )
          .pipe(
            Effect.catchTag("SqlError", (cause) =>
              storageFailure("reviseMission")(cause),
            ),
          )
      })

      const { authorizeActor, checkReferences, ...recording } = makeRecording(
        sql,
        getMission,
      )
      return BioLab.of({
        ...recording,
        ...makeLifecycle(sql, {
          getMission,
          getRun: recording.getRun,
          authorize: authorizeActor,
          refs: checkReferences,
        }),
        createMission,
        reviseMission,
        getMission,
        getMissionRevisions,
        listMissions: readMissions(undefined),
      })
    }),
  ).pipe(Layer.provide(SqliteClient.layer({ filename })))
