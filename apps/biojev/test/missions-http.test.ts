import { NodeHttpServer, NodeServices } from "@effect/platform-node"
import { assert, it } from "@effect/vitest"
import { Effect, FileSystem, Layer, Path, Schema, Stream } from "effect"
import { HttpClient, HttpClientRequest, HttpRouter } from "effect/http"
import { BioLab } from "../biolab/BioLab.ts"
import { BioLabLive } from "../biolab/SqliteLive.ts"
import { acquireMissionLoop } from "../core/mission-loop.ts"
import { makeMissionRoutes } from "../http/missions.ts"
import { MissionSnapshotView } from "../http/views.ts"

it.effect(
  "validates real mission HTTP commands, protects browser writes, paginates history and streams canonical snapshots",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const database = path.join(
        yield* fs.makeTempDirectoryScoped(),
        "lab.sqlite",
      )
      yield* Effect.gen(function* () {
        const lab = yield* BioLab
        // Transport qualification only; actual imported-Pi cognition is tested at its seam.
        const waiting = () => Effect.never
        const commands = yield* acquireMissionLoop({
          genesis: waiting,
          director: waiting,
          researcher: waiting,
          validator: waiting,
        })
        const routes = makeMissionRoutes(lab, commands, () =>
          Effect.succeed([]),
        )
        const server = HttpRouter.serve(routes, {
          disableListenLog: true,
        }).pipe(Layer.provideMerge(NodeHttpServer.layerTest))
        yield* Effect.gen(function* () {
          const client = yield* HttpClient.HttpClient
          const post = (url: string, value: unknown) =>
            client.execute(
              HttpClientRequest.post(url).pipe(
                HttpClientRequest.bodyText(
                  JSON.stringify(value),
                  "application/json",
                ),
              ),
            )
          const invalid = yield* post("/api/missions", {
            missionId: "",
            statement: "",
          })
          assert.equal(invalid.status, 400)
          for (const missionId of [
            ".",
            "..",
            "hidden/mission",
            "hidden%2Fmission",
          ]) {
            assert.equal(
              (yield* post("/api/missions", {
                missionId,
                statement: "A route must reach its mission",
              })).status,
              400,
            )
          }
          assert.lengthOf(yield* lab.listMissions, 0)
          const crossOrigin = yield* client.execute(
            HttpClientRequest.post("/api/missions").pipe(
              HttpClientRequest.bodyText(
                JSON.stringify({ missionId: "bad", statement: "bad" }),
                "application/json",
              ),
              HttpClientRequest.setHeader(
                "origin",
                "https://untrusted.example",
              ),
            ),
          )
          assert.equal(crossOrigin.status, 403)
          assert.equal(
            (yield* post("/api/missions", {
              missionId: "mission",
              statement: "An open computational mission",
            })).status,
            201,
          )
          assert.equal(
            (yield* post("/api/missions/mission/commands", {
              action: "write_sql",
            })).status,
            400,
          )
          assert.equal((yield* client.get("/api/missions/missing")).status, 404)
          assert.equal(
            (yield* client.get("/api/missions/mission/history?limit=101"))
              .status,
            400,
          )
          const history = yield* client.get(
            "/api/missions/mission/history?after=0&limit=1",
          )
          assert.deepStrictEqual(yield* history.json, {
            records: [],
            next: null,
            cursor: 0,
          })
          const events = yield* client.get("/api/missions/mission/events")
          assert.equal(events.headers["content-type"], "text/event-stream")
          const frames = yield* events.stream.pipe(
            Stream.take(1),
            Stream.runCollect,
          )
          assert.match(
            new TextDecoder().decode(frames[0]),
            /event: snapshot\ndata: /,
          )
          const frame = new TextDecoder().decode(frames[0])
          const projection = yield* Schema.decodeUnknownEffect(
            MissionSnapshotView,
          )(JSON.parse(frame.split("data: ")[1]))
          assert.equal(projection.lifecycle.mission.missionId, "mission")
          assert.equal(projection.lifecycle.genesisComplete, false)
          assert.equal((yield* lab.getMission("mission")).status, "RUNNING")
          assert.equal(
            (yield* post("/api/missions/mission/commands", { action: "pause" }))
              .status,
            200,
          )
          assert.equal((yield* lab.getMission("mission")).status, "PAUSED")
          assert.equal(
            (yield* post("/api/missions/mission/commands", {
              action: "revise",
              expectedRevision: 1,
              statement: "Revised mission",
            })).status,
            200,
          )
          assert.equal(
            (yield* post("/api/missions/mission/commands", {
              action: "revise",
              expectedRevision: 1,
              statement: "Conflicting revision",
            })).status,
            409,
          )
          assert.equal(
            (yield* post("/api/missions/mission/commands", {
              action: "resume",
            })).status,
            200,
          )
          assert.equal(
            (yield* post("/api/missions/mission/commands", { action: "stop" }))
              .status,
            200,
          )
          assert.equal((yield* lab.getMission("mission")).status, "STOPPED")
          assert.equal(
            (yield* post("/api/missions/mission/commands", {
              action: "resume",
            })).status,
            409,
          )
        }).pipe(Effect.provide(server))
      }).pipe(Effect.provide(BioLabLive(database)))
    }).pipe(Effect.provide(NodeServices.layer)),
)
