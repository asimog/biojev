import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context"
import type { Context as ModelContext } from "@earendil-works/pi-ai"
import { createModels } from "@earendil-works/pi-ai/models"
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from "@earendil-works/pi-ai/providers/faux"
import { createRegistry } from "@earendil-works/pi-durable"
import { CodingTools } from "@earendil-works/pi-durable/tools"
import { NodeServices } from "@effect/platform-node"
import { assert, it } from "@effect/vitest"
import { Effect, FileSystem, Path, Schema } from "effect"
import { BioLab } from "../../biolab/BioLab.ts"
import { CanonicalRef } from "../../biolab/model/Domain.ts"
import type { ExecutionAuthority } from "../../biolab/model/Recording.ts"
import { Operation } from "../../biolab/model/Recording.ts"
import { BioLabLive } from "../../biolab/SqliteLive.ts"
import { LinuxNetworkConfig } from "../../config/config.ts"
import { acquireLinuxEnvironment } from "./execution-env/Linux.ts"
import { acquireHarness } from "./harness.ts"
import { makeBioLabTools, persistOperation } from "./tools.ts"

const toolOutput = (context: ModelContext, name: string) => {
  const result = context.messages
    .filter(
      (message) => message.role === "toolResult" && message.toolName === name,
    )
    .at(-1)
  if (result?.role !== "toolResult")
    throw new Error(`Missing result of ${name}`)
  assert.isFalse(result.isError, JSON.stringify(result))
  return result.content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
}

it.live.each(["researcher", "validator"] as const)(
  "records real Pi computation through authorized BioLab tools, reopens it, and reuses a capability in a fresh %s",
  (role) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fs.makeTempDirectoryScoped()
      const database = path.join(directory, "biojev.sqlite")
      const network = yield* LinuxNetworkConfig
      const options = {
        nodeModules: path.resolve("node_modules"),
        workerDirectory: path.resolve("apps/biojev/platform/pi/execution-env"),
        nodeBinary: process.execPath,
        artifactDirectory: path.join(directory, "artifacts"),
        ...network,
      }
      const retained = yield* Effect.scoped(
        Effect.gen(function* () {
          const lab = yield* BioLab
          yield* lab.createMission({
            missionId: "mission",
            statement: "Compare freely chosen representations",
          })
          let authority: ExecutionAuthority | undefined
          const resource = yield* acquireLinuxEnvironment({
            ...options,
            onReceipt: (receipt) =>
              authority === undefined
                ? Effect.die("Missing trusted execution authority")
                : persistOperation(lab, authority)(receipt),
          })
          const faux = fauxProvider()
          const models = createModels()
          models.setProvider(faux.provider)
          const registry = createRegistry()
          const harness = yield* acquireHarness(
            path.join(directory, "pi.sqlite"),
            {
              models,
              registry,
              env: async () => resource.env,
            },
          )
          const conversation = yield* Effect.promise(() =>
            harness.createConversation(
              { ownership: { kind: "ownerless" } },
              BACKGROUND_CONTEXT,
            ),
          )
          const trusted = yield* lab.beginRun({
            runId: "block-run",
            missionId: "mission",
            role: "researcher",
            blockId: "block-1",
            conversationId: String(conversation.id),
            environmentId: resource.env.id,
          })
          authority = trusted.execution
          const tools = yield* makeBioLabTools({
            ...trusted,
            environment: resource,
          })
          registry.install(tools)
          yield* Effect.promise(() =>
            conversation.configure(
              {
                model: { provider: "faux", modelId: "faux-1" },
                instructions: "Research with coding and institutional tools.",
                cwd: "/work",
                extensions: [CodingTools, tools],
              },
              BACKGROUND_CONTEXT,
            ),
          )
          let artifact: CanonicalRef | undefined
          let resultRef: CanonicalRef | undefined
          let implementation: CanonicalRef | undefined
          const versions: CanonicalRef[] = []
          faux.setResponses([
            fauxAssistantMessage(
              fauxToolCall("write", {
                path: "analysis.py",
                content:
                  'import json\njson.dump({"zero":0,"missing":None},open("output.json","w"))\nprint("Obtained a zero; another field is unmeasured")\n',
              }),
              { stopReason: "toolUse" },
            ),
            fauxAssistantMessage(
              fauxToolCall("bash", { command: "python3 analysis.py" }),
              { stopReason: "toolUse" },
            ),
            fauxAssistantMessage(fauxToolCall("operation_receipts", {}), {
              stopReason: "toolUse",
            }),
            fauxAssistantMessage(
              fauxToolCall("retain_artifact", { path: "output.json" }),
              { stopReason: "toolUse" },
            ),
            (context) => {
              artifact = Schema.decodeSync(Schema.fromJsonString(CanonicalRef))(
                toolOutput(context, "retain_artifact"),
              )
              const receipts = Schema.decodeSync(
                Schema.fromJsonString(Schema.Array(Operation)),
              )(toolOutput(context, "operation_receipts"))
              const operation = receipts.find(
                (receipt) => receipt.method === "exec",
              )
              assert.isDefined(operation)
              return fauxAssistantMessage(
                fauxToolCall("record_learning", {
                  kind: "ScientificResult",
                  value: {
                    executionReceiptId: operation?.receiptId,
                    inputRefs: [],
                    outputRefs: [artifact],
                    summary:
                      "Real computation returned zero with explicit missingness",
                    missingness: ["not_measured"],
                    value: { zero: 0, missing: null },
                  },
                }),
                { stopReason: "toolUse" },
              )
            },
            (context) => {
              resultRef = Schema.decodeSync(
                Schema.fromJsonString(CanonicalRef),
              )(toolOutput(context, "record_learning"))
              return fauxAssistantMessage(
                fauxToolCall("record_learning", {
                  kind: "Interpretation",
                  value: {
                    statement:
                      "The zero does not resolve the unmeasured question",
                    basisRefs: [resultRef],
                  },
                }),
                { stopReason: "toolUse" },
              )
            },
            (context) => {
              toolOutput(context, "record_learning")
              return fauxAssistantMessage(
                fauxToolCall("retain_artifact", { path: "analysis.py" }),
                { stopReason: "toolUse" },
              )
            },
            (context) => {
              implementation = Schema.decodeSync(
                Schema.fromJsonString(CanonicalRef),
              )(toolOutput(context, "retain_artifact"))
              if (resultRef === undefined)
                throw new Error("Missing qualification result")
              return fauxAssistantMessage(
                fauxToolCall("retain_capability", {
                  capabilityId: "missingness-check",
                  name: "Missingness check",
                  description: "Reusable obtained zero and missingness example",
                  executionDescriptor: { command: "python3 analysis.py" },
                  artifactRefs: [implementation],
                  qualificationResultRefs: [resultRef],
                  status: "QUALIFIED",
                }),
                { stopReason: "toolUse" },
              )
            },
            (context) => {
              versions.push(
                Schema.decodeSync(Schema.fromJsonString(CanonicalRef))(
                  toolOutput(context, "retain_capability"),
                ),
              )
              if (implementation === undefined || resultRef === undefined)
                throw new Error("Missing qualified implementation")
              return fauxAssistantMessage(
                fauxToolCall("retain_capability", {
                  capabilityId: "missingness-check",
                  name: "Missingness check",
                  description:
                    "Second immutable metadata version of the same obtained implementation",
                  executionDescriptor: { command: "python3 analysis.py" },
                  artifactRefs: [implementation],
                  qualificationResultRefs: [resultRef],
                  status: "QUALIFIED",
                }),
                { stopReason: "toolUse" },
              )
            },
            (context) => {
              versions.push(
                Schema.decodeSync(Schema.fromJsonString(CanonicalRef))(
                  toolOutput(context, "retain_capability"),
                ),
              )
              return fauxAssistantMessage(
                "The result and interpretation are retained separately.",
              )
            },
          ])
          yield* Effect.promise(async () => {
            const submission = await conversation.submit(
              { type: "input", content: "Investigate", requestId: "one-block" },
              BACKGROUND_CONTEXT,
            )
            await submission.wait(BACKGROUND_CONTEXT)
            await conversation.waitForIdle(BACKGROUND_CONTEXT)
          })
          assert.isDefined(artifact)
          assert.isDefined(resultRef)
          if (artifact === undefined || resultRef === undefined)
            return yield* Effect.die("Model did not retain expected records")
          assert.lengthOf(yield* lab.searchMemory("mission", ""), 4)
          assert.lengthOf(versions, 2)
          if (implementation === undefined)
            return yield* Effect.die("Missing implementation")
          yield* Effect.promise(() => resource.env.cleanup(BACKGROUND_CONTEXT))
          yield* lab.settleRun(trusted.actor.runId)
          return { artifact, resultRef, implementation, versions }
        }).pipe(Effect.provide(BioLabLive(database))),
      )
      yield* Effect.scoped(
        Effect.gen(function* () {
          const lab = yield* BioLab
          const record = yield* lab.getRecord(retained.resultRef)
          assert.equal(record.originRunId, "block-run")
          assert.equal(record.record.kind, "ScientificResult")
          const resource = yield* acquireLinuxEnvironment(options)
          const fresh = yield* lab.beginRun({
            runId: "validation-run",
            missionId: "mission",
            role,
            conversationId: "fresh-validator",
            environmentId: resource.env.id,
          })
          yield* lab.getArtifact(fresh.actor, retained.artifact.id)
          yield* resource.restoreArtifact(
            retained.artifact.id,
            "prior.json",
            BACKGROUND_CONTEXT,
          )
          let output = ""
          const computation = yield* Effect.promise(() =>
            resource.env.exec(
              'python3 -c \'import json; x=json.load(open("prior.json")); assert x["zero"] == 0 and x["missing"] is None; print("independent check")\'',
              {
                onOutput: (text) => {
                  output += text
                },
              },
              BACKGROUND_CONTEXT,
            ),
          )
          assert.isTrue(computation.ok)
          if (computation.ok) assert.equal(computation.value.exitCode, 0)
          assert.equal(output.trim(), "independent check")
          yield* lab.getArtifact(fresh.actor, retained.implementation.id)
          yield* resource.restoreArtifact(
            retained.implementation.id,
            "analysis.py",
            BACKGROUND_CONTEXT,
          )
          const reused = yield* Effect.promise(() =>
            resource.env.exec("python3 analysis.py", {}, BACKGROUND_CONTEXT),
          )
          assert.isTrue(reused.ok)
          if (reused.ok) assert.equal(reused.value.exitCode, 0)
          const assessment = yield* lab.recordCapabilityAssessment(
            fresh.actor,
            {
              assessmentId: "independent-assessment",
              versionRef: retained.versions[1],
              summary:
                "Retained implementation executes in a fresh independent environment",
              strengths: ["Explicit missingness"],
              concerns: [],
              basisRefs: [retained.resultRef],
              actorRole: role,
              originRunId: "validation-run",
            },
          )
          assert.equal(assessment.kind, "CapabilityAssessment")
          const denied = yield* lab
            .recordCapabilitySelection(fresh.actor, {
              selectionId: "forbidden-selection",
              capabilityId: "missingness-check",
              versionRef: retained.versions[0],
              reason: "Validator cannot activate",
              originRunId: "validation-run",
            })
            .pipe(Effect.flip)
          assert.equal(denied.code, "UNAUTHORIZED")
          const director = yield* lab.beginRun({
            runId: "director-run",
            missionId: "mission",
            role: "director",
            conversationId: "director",
            environmentId: "director-env",
          })
          for (const [index, versionRef] of [
            retained.versions[1],
            retained.versions[0],
            null,
          ].entries()) {
            yield* lab.recordCapabilitySelection(director.actor, {
              selectionId: `selection-${index}`,
              capabilityId: "missingness-check",
              versionRef,
              reason:
                index === 0
                  ? "Select qualified version"
                  : index === 1
                    ? "Roll back default"
                    : "Clear default",
              originRunId: "director-run",
            })
            const defaults = yield* lab.getCapabilityDefaults("mission")
            assert.deepStrictEqual(defaults[0].versionRef, versionRef)
          }
          assert.equal(
            (yield* lab.getRecord(retained.versions[0])).record.kind,
            "CapabilityVersion",
          )
          assert.equal(
            (yield* lab.getRecord(retained.versions[1])).record.kind,
            "CapabilityVersion",
          )
        }).pipe(Effect.provide(BioLabLive(database))),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
  { timeout: 30000 },
)
