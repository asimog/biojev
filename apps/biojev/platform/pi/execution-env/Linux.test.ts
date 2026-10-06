import { BACKGROUND_CONTEXT, withCancel } from "@earendil-works/chord/context"
import { createModels } from "@earendil-works/pi-ai/models"
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from "@earendil-works/pi-ai/providers/faux"
import { NodeHttpServer, NodeServices } from "@effect/platform-node"
import { assert, it } from "@effect/vitest"
import { Effect, Exit, FileSystem, Layer, Path } from "effect"
import { HttpClient, HttpRouter, HttpServer } from "effect/http"
import { LinuxNetworkConfig } from "../../../config/config.ts"
import { StatusRoute } from "../../../http/status.ts"
import { acquireHarness } from "../harness.ts"
import { acquireLinuxEnvironment } from "./Linux.ts"

const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const retained = yield* fs.makeTempDirectoryScoped()
  const network = yield* LinuxNetworkConfig
  const options = {
    nodeModules: path.resolve("node_modules"),
    workerDirectory: path.resolve("apps/biojev/platform/pi/execution-env"),
    nodeBinary: process.execPath,
    artifactDirectory: retained,
    ...network,
  }
  return { fs, path, options }
})

it.live(
  "uses imported Pi files and shell inside isolation; retains artifacts outside it",
  () =>
    Effect.gen(function* () {
      const { fs, path, options } = yield* fixture
      const host = yield* fs.makeTempDirectoryScoped()
      const secret = path.join(host, "biojev.sqlite")
      yield* fs.writeFileString(secret, "canonical-secret")
      const artifact = yield* Effect.scoped(
        Effect.gen(function* () {
          const resource = yield* acquireLinuxEnvironment(options)
          const env = resource.env
          const c = BACKGROUND_CONTEXT
          const written = yield* Effect.promise(() =>
            env.writeFile("source.json", '{"value":0,"missing":null}', c),
          )
          assert.isTrue(written.ok, JSON.stringify(resource.receipts()))
          let output = ""
          const computation = yield* Effect.promise(() =>
            env.exec(
              `python3 -c 'import json; x=json.load(open("source.json")); print(x["value"]); json.dump(x,open("result.json","w"))'`,
              {
                onOutput: (text) => {
                  output += text
                },
              },
              c,
            ),
          )
          assert.deepEqual(
            computation,
            { ok: true, value: { exitCode: 0 } },
            JSON.stringify(resource.receipts()),
          )
          assert.equal(output.trim(), "0")
          assert.deepEqual(yield* Effect.promise(() => env.exists(secret, c)), {
            ok: true,
            value: false,
          })
          const denied = yield* Effect.promise(() =>
            env.readTextFile(secret, c),
          )
          assert.isFalse(denied.ok)
          const symlink = yield* Effect.promise(() =>
            env.exec(`ln -s '${secret}' leaked`, undefined, c),
          )
          assert.isTrue(symlink.ok)
          assert.isFalse(
            (yield* Effect.promise(() => env.readTextFile("leaked", c))).ok,
          )
          const protocol = yield* Effect.promise(() =>
            env.exec(
              "test ! -e /proc/1/fd/1 && ! unshare -Ur true",
              undefined,
              c,
            ),
          )
          assert.deepEqual(protocol, { ok: true, value: { exitCode: 0 } })
          const reader = yield* Effect.promise(() =>
            env.openTextLineReader("result.json", c),
          )
          assert.isTrue(reader.ok)
          if (reader.ok) {
            assert.isTrue(
              (yield* Effect.promise(() => reader.value.readLine(c))).ok,
            )
            yield* Effect.promise(() => reader.value.close(c))
          }
          const artifact = yield* resource.retainArtifact("result.json", c)
          assert.equal(
            resource
              .receipts()
              .filter((r) => r.method === "exec" && r.outcome === "SUCCEEDED")
              .length,
            3,
          )
          assert.isTrue(
            resource
              .receipts()
              .some(
                (r) => r.method === "readTextFile" && r.outcome === "FAILED",
              ),
          )
          return artifact
        }),
      )
      assert.deepEqual(JSON.parse(yield* fs.readFileString(artifact.path)), {
        value: 0,
        missing: null,
      })
      const fresh = yield* acquireLinuxEnvironment(options)
      assert.deepEqual(
        yield* Effect.promise(() =>
          fresh.env.exists("result.json", BACKGROUND_CONTEXT),
        ),
        { ok: true, value: false },
      )
      assert.isFalse(
        (yield* Effect.promise(() =>
          fresh.env.readTextFile(artifact.path, BACKGROUND_CONTEXT),
        )).ok,
      )
      yield* fresh.restoreArtifact(
        artifact.artifactId,
        "prior.json",
        BACKGROUND_CONTEXT,
      )
      const restored = yield* Effect.promise(() =>
        fresh.env.readTextFile("prior.json", BACKGROUND_CONTEXT),
      )
      assert.isTrue(restored.ok)
      if (restored.ok)
        assert.deepEqual(JSON.parse(restored.value), {
          value: 0,
          missing: null,
        })
      yield* fs.writeFileString(artifact.path, "corrupt")
      assert.isTrue(
        Exit.isFailure(
          yield* Effect.exit(
            fresh.restoreArtifact(
              artifact.artifactId,
              "corrupt.json",
              BACKGROUND_CONTEXT,
            ),
          ),
        ),
      )
      assert.deepEqual(
        yield* Effect.promise(() =>
          fresh.env.exists("corrupt.json", BACKGROUND_CONTEXT),
        ),
        { ok: true, value: false },
      )
    }).pipe(Effect.provide(NodeServices.layer)),
  { timeout: 30000 },
)

const TestServer = HttpRouter.serve(StatusRoute, {
  disableListenLog: true,
}).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

it.live(
  "networked computation cannot reach the host's real status HTTP service",
  () =>
    Effect.gen(function* () {
      const { options } = yield* fixture
      const client = yield* HttpClient.HttpClient
      assert.equal((yield* client.get("/api/status")).status, 200)
      const server = yield* HttpServer.HttpServer
      if (!("port" in server.address)) throw new Error("Expected a TCP server")
      const port = server.address.port
      const resource = yield* acquireLinuxEnvironment(options)
      const result = yield* Effect.promise(() =>
        resource.env.exec(
          `python3 -c 'import urllib.request; print(urllib.request.urlopen("http://10.0.2.2:${port}/api/status",timeout=2).read())'`,
          undefined,
          BACKGROUND_CONTEXT,
        ),
      )
      assert.isTrue(result.ok)
      if (result.ok) assert.notEqual(result.value.exitCode, 0)
    }).pipe(Effect.provide(Layer.merge(TestServer, NodeServices.layer))),
  { timeout: 30000 },
)

it.live(
  "abort settles parallel processes and cleanup permanently closes the environment",
  () =>
    Effect.gen(function* () {
      const { fs, options } = yield* fixture
      const resource = yield* acquireLinuxEnvironment(options)
      const { context, cancel } = withCancel(BACKGROUND_CONTEXT)
      let started = () => {}
      const ready = new Promise<void>((resolve) => {
        started = resolve
      })
      const work = resource.env.exec(
        'python3 -c \'import subprocess,time; subprocess.Popen(["sleep","60"],start_new_session=True); print("started",flush=True); time.sleep(60)\'',
        {
          onOutput: (text) => {
            if (text.includes("started")) started()
          },
        },
        context,
      )
      yield* Effect.promise(() =>
        Promise.race([
          ready,
          work.then(() => {
            throw new Error(JSON.stringify(resource.receipts()))
          }),
        ]),
      )
      const namespace = resource.namespacePids().at(-1)
      assert.isDefined(namespace)
      const identity = yield* fs.readLink(`/proc/${namespace}/ns/pid`)
      assert.deepEqual(
        yield* Effect.promise(() =>
          resource.env.exec("printf parallel", undefined, BACKGROUND_CONTEXT),
        ),
        {
          ok: true,
          value: { exitCode: 0 },
        },
      )
      const owned = yield* fs.readDirectory("/proc").pipe(
        Effect.flatMap((names) =>
          Effect.forEach(
            names.filter((name) => /^\d+$/.test(name)),
            (name) =>
              fs.readLink(`/proc/${name}/ns/pid`).pipe(
                Effect.map((value) => (value === identity ? name : undefined)),
                Effect.catch(() => Effect.void),
              ),
            { concurrency: 16 },
          ),
        ),
      )
      assert.isAtLeast(owned.filter((pid) => pid !== undefined).length, 3)
      cancel()
      const result = yield* Effect.promise(() => work)
      assert.isFalse(result.ok)
      if (!result.ok) assert.equal(result.error.code, "aborted")
      yield* Effect.promise(() => resource.env.cleanup(BACKGROUND_CONTEXT))
      for (const pid of owned)
        if (pid !== undefined) {
          assert.isFalse(
            yield* fs.exists(`/proc/${pid}`),
            `Leaked namespace process ${pid}`,
          )
        }
      assert.isFalse(
        (yield* Effect.promise(() =>
          resource.env.exec("true", undefined, BACKGROUND_CONTEXT),
        )).ok,
      )
      assert.equal(resource.receipts().at(-1)?.outcome, "INTERRUPTED")
    }).pipe(Effect.provide(NodeServices.layer)),
  { timeout: 30000 },
)

it.live(
  "Pi bundled tools use the controlled factory and retain actual committed output",
  () =>
    Effect.gen(function* () {
      const { path, options } = yield* fixture
      const resource = yield* acquireLinuxEnvironment(options)
      const faux = fauxProvider()
      const models = createModels()
      models.setProvider(faux.provider)
      faux.setResponses([
        fauxAssistantMessage(
          fauxToolCall("write", {
            path: "analysis.py",
            content: "print(42)\n",
          }),
          { stopReason: "toolUse" },
        ),
        fauxAssistantMessage(
          fauxToolCall("bash", { command: "python3 analysis.py" }),
          { stopReason: "toolUse" },
        ),
        (context) => {
          assert.include(JSON.stringify(context.messages), "42")
          return fauxAssistantMessage("The real program returned 42.")
        },
      ])
      const harness = yield* acquireHarness(
        path.join(options.artifactDirectory, "pi.sqlite"),
        {
          models,
          env: async () => resource.env,
        },
      )
      const messages = yield* Effect.promise(async () => {
        const conversation = await harness.createConversation(
          {
            ownership: { kind: "ownerless" },
            agent: {
              model: { provider: "faux", modelId: "faux-1" },
              instructions: "Use coding tools.",
              cwd: "/work",
            },
          },
          BACKGROUND_CONTEXT,
        )
        const submission = await conversation.submit(
          { type: "input", content: "Run a computation", requestId: "coding" },
          BACKGROUND_CONTEXT,
        )
        await submission.wait(BACKGROUND_CONTEXT)
        await conversation.waitForIdle(BACKGROUND_CONTEXT)
        return (await conversation.context(BACKGROUND_CONTEXT)).messages
      })
      assert.include(JSON.stringify(messages), "The real program returned 42")
      assert.isTrue(
        resource
          .receipts()
          .some(
            (receipt) =>
              receipt.method === "exec" && receipt.output.trim() === "42",
          ),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
  { timeout: 30000 },
)

it.live(
  "reads and retains a 100 MB asset with bounded transport; reader survives rename and separates shell streams",
  () =>
    Effect.gen(function* () {
      const { fs, options } = yield* fixture
      const resource = yield* acquireLinuxEnvironment(options)
      const env = resource.env
      const c = BACKGROUND_CONTEXT
      const generated = yield* Effect.promise(() =>
        env.exec(
          [
            "python3",
            "-c",
            "with open('large.bin','wb') as f: f.truncate(100000000)\nprint('ok')",
          ],
          undefined,
          c,
        ),
      )
      assert.isTrue(generated.ok)
      const opened = yield* Effect.promise(() =>
        env.openBinaryReader("large.bin", undefined, c),
      )
      assert.isTrue(opened.ok)
      if (!opened.ok) return
      yield* Effect.promise(() => env.renameFile("large.bin", "renamed.bin", c))
      const last = yield* Effect.promise(() =>
        opened.value.read(99999999, 1, c),
      )
      assert.deepEqual(last, { ok: true, value: Uint8Array.of(0) })
      yield* Effect.promise(() => opened.value.close(c))
      const artifact = yield* resource.retainArtifact("renamed.bin", c)
      assert.equal(artifact.bytes, 100000000)
      assert.equal(Number((yield* fs.stat(artifact.path)).size), 100000000)
      let stdout = ""
      let stderr = ""
      yield* Effect.promise(() =>
        env.exec(
          ["sh", "-c", "printf out; printf err >&2"],
          {
            onOutput: (text, _context, info) => {
              if (info.stream === "stdout") stdout += text
              else stderr += text
            },
          },
          c,
        ),
      )
      assert.equal(stdout, "out")
      assert.equal(stderr, "err")
      yield* Effect.promise(() =>
        env.exec(
          [
            "python3",
            "-c",
            "with open('oversized.bin','wb') as f: f.truncate(100000001)",
          ],
          undefined,
          c,
        ),
      )
      const refused = yield* Effect.promise(() =>
        env.readBinaryFile("oversized.bin", c),
      )
      assert.isFalse(refused.ok)
    }).pipe(Effect.provide(NodeServices.layer)),
  { timeout: 120000 },
)

it.live(
  "cancelling a reader wait closes its channel before another request can consume stale data",
  () =>
    Effect.gen(function* () {
      const { options } = yield* fixture
      const resource = yield* acquireLinuxEnvironment(options)
      const c = BACKGROUND_CONTEXT
      yield* Effect.promise(() =>
        resource.env.writeFile("cancel.txt", "retained bytes", c),
      )
      const opened = yield* Effect.promise(() =>
        resource.env.openBinaryReader("cancel.txt", undefined, c),
      )
      assert.isTrue(opened.ok)
      if (!opened.ok) return
      const cancellation = withCancel(c)
      const pending = opened.value.read(0, 12, cancellation.context)
      cancellation.cancel()
      const result = yield* Effect.promise(() => pending)
      assert.isFalse(result.ok)
      if (!result.ok) assert.equal(result.error.code, "aborted")
      const subsequent = yield* Effect.promise(() => opened.value.info(c))
      assert.isFalse(subsequent.ok)
      if (!subsequent.ok) assert.equal(subsequent.error.code, "invalid")
    }).pipe(Effect.provide(NodeServices.layer)),
  { timeout: 15000 },
)
