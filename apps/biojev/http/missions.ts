import { ByteSize, Effect, Layer, Schedule, Schema, Stream } from "effect"
import {
  HttpIncomingMessage,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http"
import { type BioLab, BioLabError } from "../biolab/BioLab.ts"
import {
  CreateMission,
  MissionId,
  MissionStatement,
} from "../biolab/model/Mission.ts"
import type { acquireMissionLoop } from "../core/mission-loop.ts"

const Command = Schema.Union([
  Schema.Struct({ action: Schema.Literals(["pause", "resume", "stop"]) }),
  Schema.Struct({
    action: Schema.Literal("revise"),
    expectedRevision: Schema.Int.check(Schema.isGreaterThan(0)),
    statement: MissionStatement,
  }),
])
const Pagination = Schema.Struct({
  after: Schema.optionalKey(
    Schema.NumberFromString.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(0),
    ),
  ),
  limit: Schema.optionalKey(
    Schema.NumberFromString.check(
      Schema.isInt(),
      Schema.isBetween({ minimum: 1, maximum: 100 }),
    ),
  ),
})

export const makeMissionRoutes = (
  lab: BioLab["Service"],
  commands: Effect.Success<ReturnType<typeof acquireMissionLoop>>,
  activity: (
    missionId: string,
  ) => Effect.Effect<ReadonlyArray<unknown>, unknown>,
) => {
  const path = HttpRouter.schemaPathParams(
    Schema.Struct({ missionId: MissionId }),
  )
  const errorResponse = (error: unknown) => {
    const code = Schema.is(BioLabError)(error) ? error.code : "INVALID_INPUT"
    const status =
      code === "NOT_FOUND"
        ? 404
        : code === "CONFLICT"
          ? 409
          : code === "UNAUTHORIZED"
            ? 403
            : code === "STORAGE"
              ? 500
              : 400
    return HttpServerResponse.json(
      {
        error: {
          code,
          message:
            status === 500
              ? "Institutional operation failed"
              : "Request could not be applied",
        },
      },
      { status },
    )
  }
  const handle = <E, R>(
    program: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
  ) =>
    program.pipe(
      Effect.catch(errorResponse),
      Effect.map((response) =>
        HttpServerResponse.setHeaders(response, {
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        }),
      ),
      Effect.provideService(
        HttpIncomingMessage.MaxBodySize,
        ByteSize.kibibytes(128),
      ),
    )
  const writable = Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    if (
      request.headers.origin !== undefined ||
      request.headers["content-type"]?.split(";")[0] !== "application/json"
    )
      return yield* new BioLabError({
        code: "UNAUTHORIZED",
        operation: "httpCommand",
        message:
          "Use the same-origin UI proxy or an explicit JSON backend client",
      })
  })
  const requireReady = Effect.gen(function* () {
    if (!(yield* commands.state).enabled)
      return yield* new BioLabError({
        code: "CONFLICT",
        operation: "httpCommand",
        message: "Model providers are not configured",
      })
  })
  const snapshot = Effect.fn("HTTP.missionSnapshot")(function* (
    missionId: string,
  ) {
    return {
      lifecycle: yield* lab.getLifecycle(missionId),
      genesis: yield* lab.getGenesis(missionId),
      validationHistory: yield* lab.getValidationCycles(missionId),
      blocks: (yield* lab.getResearchBlocks(missionId)).slice(-50),
      activity: yield* activity(missionId).pipe(
        Effect.mapError(
          () =>
            new BioLabError({
              code: "STORAGE",
              operation: "activity",
              message: "Runtime activity is unavailable",
            }),
        ),
      ),
      scheduler: yield* commands.state,
    }
  })
  return Layer.mergeAll(
    HttpRouter.add(
      "GET",
      "/api/status",
      handle(
        Effect.gen(function* () {
          return yield* HttpServerResponse.json({
            status:
              (yield* commands.state).activeMissionId === null
                ? "IDLE"
                : "RUNNING",
          })
        }),
      ),
    ),
    HttpRouter.add(
      "GET",
      "/api/missions",
      handle(
        Effect.gen(function* () {
          return yield* HttpServerResponse.json({
            missions: yield* lab.listMissions,
            scheduler: yield* commands.state,
          })
        }),
      ),
    ),
    HttpRouter.add(
      "POST",
      "/api/missions",
      handle(
        Effect.gen(function* () {
          yield* writable
          yield* requireReady
          const input = yield* HttpServerRequest.schemaBodyJson(CreateMission)
          return yield* HttpServerResponse.json(yield* commands.start(input), {
            status: 201,
          })
        }),
      ),
    ),
    HttpRouter.add(
      "GET",
      "/api/missions/:missionId",
      handle(
        Effect.gen(function* () {
          const { missionId } = yield* path
          return yield* HttpServerResponse.json(yield* snapshot(missionId))
        }),
      ),
    ),
    HttpRouter.add(
      "POST",
      "/api/missions/:missionId/commands",
      handle(
        Effect.gen(function* () {
          yield* writable
          const { missionId } = yield* path
          const command = yield* HttpServerRequest.schemaBodyJson(Command)
          if (command.action !== "pause" && command.action !== "stop")
            yield* requireReady
          const mission =
            command.action === "revise"
              ? yield* commands.revise({
                  missionId,
                  expectedRevision: command.expectedRevision,
                  statement: command.statement,
                })
              : command.action === "pause"
                ? yield* commands.pause(missionId)
                : command.action === "stop"
                  ? yield* commands.stop(missionId)
                  : yield* commands.resume(missionId)
          return yield* HttpServerResponse.json(mission)
        }),
      ),
    ),
    HttpRouter.add(
      "GET",
      "/api/missions/:missionId/history",
      handle(
        Effect.gen(function* () {
          const { missionId } = yield* path
          yield* lab.getMission(missionId)
          const { after, limit } =
            yield* HttpServerRequest.schemaSearchParams(Pagination)
          return yield* HttpServerResponse.json(
            yield* lab.getHistory(missionId, after, limit),
          )
        }),
      ),
    ),
    HttpRouter.add(
      "GET",
      "/api/missions/:missionId/events",
      handle(
        Effect.gen(function* () {
          const { missionId } = yield* path
          yield* lab.getMission(missionId)
          const encoder = new TextEncoder()
          const body = Stream.fromEffectSchedule(
            snapshot(missionId),
            Schedule.spaced("1 second"),
          ).pipe(
            Stream.map((value) =>
              encoder.encode(
                `event: snapshot\ndata: ${JSON.stringify(value)}\n\n`,
              ),
            ),
          )
          return HttpServerResponse.stream(body, {
            contentType: "text/event-stream",
            headers: { "cache-control": "no-cache", "x-accel-buffering": "no" },
          })
        }),
      ),
    ),
  )
}
