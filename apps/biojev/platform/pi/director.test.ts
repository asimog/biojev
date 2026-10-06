import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context"
import { createModels } from "@earendil-works/pi-ai/models"
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from "@earendil-works/pi-ai/providers/faux"
import { NodeServices } from "@effect/platform-node"
import { assert, it } from "@effect/vitest"
import { Effect, FileSystem, Path, Schema } from "effect"
import { BioLab } from "../../biolab/BioLab.ts"
import { BioLabLive } from "../../biolab/SqliteLive.ts"
import { LinuxNetworkConfig } from "../../config/config.ts"
import { decision, dossier } from "../../test/fixtures.ts"
import { acquireRolePrograms } from "./roles.ts"

it.live(
  "Director discovers Genesis through real artifacts and works alongside Researcher without replacing its objective",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fs.makeTempDirectoryScoped()
      const network = yield* LinuxNetworkConfig
      const faux = fauxProvider()
      const models = createModels()
      models.setProvider(faux.provider)
      let genesisStep = 0
      let sideStep = 0
      let researchStep = 0
      let snapshot = ""
      let sideRun = ""
      const tool = (name: string, args: unknown) =>
        fauxAssistantMessage(
          fauxToolCall(
            name,
            JSON.parse(
              JSON.stringify(Schema.decodeUnknownSync(Schema.JsonObject)(args)),
            ),
          ),
          {
            stopReason: "toolUse",
          },
        )
      faux.setResponses(
        Array.from({ length: 30 }, () => (context) => {
          const user = context.messages
            .filter((message) => message.role === "user")
            .at(-1)
          if (user?.role !== "user" || typeof user.content !== "string")
            throw new Error("Missing role context")
          const input = Schema.decodeSync(
            Schema.fromJsonString(
              Schema.Struct({
                role: Schema.String,
                mode: Schema.String,
                runId: Schema.String,
              }),
            ),
          )(user.content)
          if (input.mode === "GENESIS") {
            const step = genesisStep++
            if (step === 0)
              return tool("bash", {
                command:
                  "printf '%s' '{\"description\":\"generic scientific source\"}' > source.json",
              })
            if (step === 1)
              return tool("retain_artifact", { path: "source.json" })
            if (step === 2) {
              const retained = context.messages
                .filter((message) => message.role === "toolResult")
                .at(-1)
              if (retained?.role !== "toolResult")
                throw new Error("Missing artifact")
              const text = retained.content
                .filter((item) => item.type === "text")
                .map((item) => item.text)
                .join("")
              snapshot = Schema.decodeSync(
                Schema.fromJsonString(Schema.Struct({ id: Schema.String })),
              )(text).id
            }
            const discovery = {
              programId: "director-chosen-discovery",
              programVersion: "1",
              configuredInputIds: [],
              outcomes: [
                {
                  inputId: "chosen-source",
                  snapshotRef: snapshot,
                  failure: null,
                },
              ],
              candidates: [
                {
                  id: "candidate",
                  kind: "source",
                  externalId: "source",
                  description: "A computational source",
                  metadata: {},
                  snapshotRef: snapshot,
                  recordHash: snapshot,
                  normalizerVersion: "1",
                  retrievedAt: 1,
                },
              ],
            }
            if (step === 2) return tool("record_discovery", discovery)
            if (step === 4) {
              const result = context.messages
                .filter((message) => message.role === "toolResult")
                .at(-1)
              if (result?.role !== "toolResult")
                throw new Error("Missing semantics")
              const text = result.content
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("")
              const retained = Schema.decodeSync(
                Schema.fromJsonString(
                  Schema.Struct({
                    ref: Schema.Struct({
                      kind: Schema.Literal("SemanticMeasurement"),
                      id: Schema.String,
                    }),
                  }),
                ),
              )(text)
              return tool("record_discovery", {
                ...discovery,
                measurementRefs: [retained.ref],
              })
            }
            if (step === 3)
              return tool("measure_semantics", {
                questionId: "relevance",
                questionVersion: "1",
                subjectRefs: [{ kind: "DiscoveredSource", id: "candidate" }],
                projection: {
                  identity: "landscape",
                  version: "1",
                  value: "candidate",
                },
                question: { type: "noul", instructions: "Is this relevant?" },
              })
            const {
              decisionId: _id,
              missionId: _mission,
              nextObjective,
              ...payload
            } = decision("", "mission")
            const {
              objectiveId: _objective,
              missionId: _m,
              originDirectorDecisionId: _origin,
              ...objective
            } = nextObjective
            return tool("submit_handoff", {
              ...payload,
              nextObjective: objective,
            })
          }
          if (input.mode === "DIRECTOR_SIDE_WORK") {
            sideRun = input.runId
            if (sideStep++ === 0)
              return tool("record_learning", {
                kind: "Interpretation",
                value: {
                  statement:
                    "Director reassessed prior landscape during research",
                  basisRefs: [{ kind: "DiscoveredSource", id: "candidate" }],
                },
              })
            return tool("submit_handoff", {})
          }
          if (researchStep++ === 0)
            return tool("bash", {
              command: "python3 -c 'import time; time.sleep(0.2); print(1)'",
            })
          const {
            dossierId: _dossier,
            blockId: _block,
            objectiveId: _objective,
            ...payload
          } = dossier("", "")
          return tool("submit_handoff", payload)
        }),
      )
      yield* Effect.scoped(
        Effect.gen(function* () {
          const lab = yield* BioLab
          const roles = yield* acquireRolePrograms({
            database: path.join(directory, "pi.sqlite"),
            models,
            model: { provider: "faux", modelId: "faux-1" },
            concurrentDirector: true,
            blockTimeoutMs: 10000,
            jev: {
              measure: (question) =>
                Effect.succeed({
                  ...question,
                  measurementId: "measurement",
                  primitive: "noul",
                  inputHash: "hash",
                  provider: "typesafe",
                  requestedModel: "fixture",
                  model: "fixture",
                  answer: { type: "noul", noul: 0.2 },
                  usage: { input_tokens: 1, output_tokens: 1 },
                  receipt: { requestId: null },
                  createdAt: 1,
                }),
            },
            environment: {
              nodeBinary: process.execPath,
              nodeModules: path.resolve("node_modules"),
              workerDirectory: path.resolve(
                "apps/biojev/platform/pi/execution-env",
              ),
              artifactDirectory: path.join(directory, "artifacts"),
              ...network,
            },
          })
          yield* lab.createMission({
            missionId: "mission",
            statement: "An open-ended computational mission",
          })
          yield* roles.genesis("mission")
          assert.equal(
            (yield* lab.getGenesis("mission"))?.status,
            "COMPLETED",
            JSON.stringify(yield* lab.getHistory("mission")),
          )
          assert.equal((yield* lab.getLifecycle("mission")).countableBlocks, 0)
          yield* roles.researcher("mission")
          const runs = yield* lab.getRuns("mission")
          const researcher = runs.find((run) => run.role === "researcher")
          const side = runs.find((run) => run.runId === sideRun)
          assert.equal(side?.purpose, "DIRECTOR_SIDE_WORK")
          assert.notEqual(side?.environmentId, researcher?.environmentId)
          assert.isTrue(runs.every((run) => run.status === "SETTLED"))
          const history = yield* lab.getHistory("mission")
          assert.lengthOf(
            history.records.filter(
              (row) => row.record.kind === "DirectorDecision",
            ),
            1,
          )
          assert.isTrue(
            history.records.some(
              (row) =>
                row.originRunId === sideRun &&
                row.record.kind === "Interpretation",
            ),
          )
          assert.equal((yield* lab.getLifecycle("mission")).countableBlocks, 1)
          assert.isTrue((yield* lab.getLifecycle("mission")).directorRequired)
          assert.equal(BACKGROUND_CONTEXT.abortSignal, undefined)
        }).pipe(Effect.provide(BioLabLive(path.join(directory, "lab.sqlite")))),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
  { timeout: 30000 },
)
