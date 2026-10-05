import type { Context as ChordContext } from "@earendil-works/chord"
import {
  type ExecutionEnv,
  ExecutionError,
  err,
  FileError,
  ok,
  type Result,
  type ShellExecOptions,
  type TextLineReader,
} from "@earendil-works/pi-durable/env"
import {
  Cause,
  type Context,
  DateTime,
  Deferred,
  Effect,
  Fiber,
  FileSystem,
  Option,
  Path,
  Schema,
  Semaphore,
  Stream,
} from "effect"
import { make } from "effect/process/ChildProcess"
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner"
import { Message, type Request } from "./protocol.ts"

export class EnvironmentError extends Schema.TaggedError<EnvironmentError>()(
  "EnvironmentError",
  { message: Schema.String, cause: Schema.optional(Schema.Defect()) },
) {}

export interface OperationReceipt {
  readonly receiptId: string
  readonly environmentId: string
  readonly method: Request["method"]
  readonly args: ReadonlyArray<unknown>
  readonly startedAt: number
  readonly endedAt: number
  readonly outcome: "SUCCEEDED" | "FAILED" | "INTERRUPTED"
  readonly result: unknown
  readonly output: string
}

export interface LinuxOptions {
  readonly nodeModules: string
  readonly workerDirectory: string
  readonly nodeBinary: string
  readonly artifactDirectory: string
  readonly slirpBinary: string
  readonly slirpLibraryDirectory?: string
  readonly workspaceRoot?: string
  readonly environmentId?: string
  readonly onReceipt?: (
    receipt: OperationReceipt,
  ) => Effect.Effect<void, unknown>
}

const FileInfo = Schema.Struct({
  name: Schema.String,
  path: Schema.String,
  kind: Schema.Literals(["file", "directory", "symlink"]),
  size: Schema.Finite,
  mtimeMs: Schema.Finite,
})
const TextLine = Schema.Struct({
  text: Schema.String,
  terminated: Schema.Boolean,
})
const ShellResult = Schema.Struct({
  exitCode: Schema.Int,
  spillPath: Schema.optionalKey(Schema.String),
})
const FileCode = Schema.Literals([
  "aborted",
  "not_found",
  "permission_denied",
  "not_directory",
  "is_directory",
  "invalid",
  "not_supported",
  "unknown",
])
const ExecutionCode = Schema.Literals([
  "aborted",
  "timeout",
  "shell_unavailable",
  "spawn_error",
  "callback_error",
  "unknown",
])
type Platform = FileSystem.FileSystem | Path.Path | ChildProcessSpawner

// This runner is invoked only by foreign Pi callbacks, outside Effect programs.
const bridge = (context: Context.Context<Platform>) =>
  Effect.runPromiseWith(context)

export const acquireLinuxEnvironment = Effect.fn("acquireLinuxEnvironment")(
  function* (options: LinuxOptions) {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const spawner = yield* ChildProcessSpawner
    const run = bridge(yield* Effect.context<Platform>())
    const permits = yield* Semaphore.make(8)
    const id = yield* Schema.decodeEffect(Schema.String.check(Schema.isUUID()))(
      options.environmentId ?? crypto.randomUUID(),
    ).pipe(
      Effect.mapError(
        (cause) =>
          new EnvironmentError({
            message: "Invalid environment identity",
            cause,
          }),
      ),
    )
    const directory = yield* Effect.acquireRelease(
      options.workspaceRoot === undefined
        ? fs.makeTempDirectory({ prefix: "biojev-env-" })
        : fs
            .makeDirectory(path.join(options.workspaceRoot, id), {
              recursive: true,
            })
            .pipe(Effect.as(path.join(options.workspaceRoot, id))),
      (directory) =>
        fs
          .remove(directory, { recursive: true, force: true })
          .pipe(Effect.orDie),
    )
    yield* fs.makeDirectory(path.join(directory, ".tmp"), { recursive: true })
    yield* fs.makeDirectory(path.join(directory, ".home"), { recursive: true })
    const receipts: OperationReceipt[] = []
    const namespacePids: number[] = []
    const active = new Map<AbortController, Promise<unknown>>()
    let cleanupFailure: unknown
    let closed = false
    let cwd = "/work"

    const operation = Effect.fn("Pi.ExecutionEnv.operation")(function* (
      request: Request,
      onOutput: ShellExecOptions["onOutput"],
      chord: ChordContext,
      receiptId: string,
    ) {
      const startedAt = DateTime.toEpochMillis(yield* DateTime.now)
      let output = ""
      let namespace: { pid: number; identity: string } | undefined
      const program = Effect.scoped(
        Effect.uninterruptibleMask((restore) =>
          Effect.gen(function* () {
            const result = yield* Deferred.make<typeof Message.Type>()
            const args = [
              "--unshare-all",
              "--unshare-user",
              "--die-with-parent",
              "--new-session",
              "--cap-drop",
              "ALL",
              "--disable-userns",
              "--clearenv",
              "--info-fd",
              "3",
              "--ro-bind",
              "/usr",
              "/usr",
              "--ro-bind",
              "/lib",
              "/lib",
              "--ro-bind-try",
              "/lib64",
              "/lib64",
              "--symlink",
              "usr/bin",
              "/bin",
              "--symlink",
              "usr/sbin",
              "/sbin",
              "--dev",
              "/dev",
              // No procfs: untrusted programs cannot address the relay's descriptors.
              "--dir",
              "/proc",
              "--tmpfs",
              "/tmp",
              "--dir",
              "/etc",
              "--ro-bind-try",
              "/etc/ssl/certs",
              "/etc/ssl/certs",
              "--ro-bind-try",
              "/etc/ld.so.cache",
              "/etc/ld.so.cache",
              "--ro-bind",
              path.join(directory, ".tmp", "resolv.conf"),
              "/etc/resolv.conf",
              "--ro-bind",
              options.nodeModules,
              "/opt/node_modules",
              "--ro-bind",
              options.workerDirectory,
              "/opt/pi",
              "--ro-bind",
              options.nodeBinary,
              "/opt/node",
              "--bind",
              directory,
              "/work",
              "--chdir",
              "/work",
              "--setenv",
              "HOME",
              "/work/.home",
              "--setenv",
              "TMPDIR",
              "/work/.tmp",
              "--setenv",
              "PATH",
              "/usr/bin:/bin",
              "/opt/node",
              "/opt/pi/worker.ts",
            ]
            const child = yield* spawner.spawn(
              make(
                "prlimit",
                [
                  "--as=8589934592",
                  "--nproc=1024",
                  "--nofile=256",
                  "--fsize=268435456",
                  "--",
                  "bwrap",
                  ...args,
                ],
                {
                  env: { PATH: "/usr/bin:/bin" },
                  extendEnv: false,
                  stdin: "pipe",
                  killSignal: "SIGKILL",
                  additionalFds: { fd3: { type: "output" } },
                },
              ),
            )
            let diagnostic = ""
            yield* child.stderr.pipe(
              Stream.decodeText(),
              Stream.runForEach((text) =>
                Effect.sync(() => {
                  diagnostic = (diagnostic + text).slice(-4096)
                }),
              ),
              Effect.interruptible,
              Effect.forkScoped,
            )
            const reader = yield* child.stdout.pipe(
              Stream.decodeText(),
              Stream.splitLines,
              Stream.runForEach((line) =>
                Effect.gen(function* () {
                  const message = yield* Schema.decodeEffect(
                    Schema.fromJsonString(Message),
                  )(line)
                  if ("kind" in message && message.kind === "output") {
                    output = (output + message.text).slice(-32768)
                    yield* Effect.sync(() => onOutput?.(message.text, chord))
                  } else if ("kind" in message && message.kind === "result") {
                    yield* Deferred.succeed(result, message)
                  }
                }),
              ),
              Effect.interruptible,
              Effect.forkScoped,
            )
            const info = yield* child.getOutputFd(3).pipe(
              Stream.decodeText(),
              Stream.runFold(
                () => "",
                (acc, value) => acc + value,
              ),
            )
            if (info.length === 0) {
              yield* child.exitCode
              return yield* new EnvironmentError({
                message: "Sandbox failed before readiness",
                cause: diagnostic,
              })
            }
            const ready = yield* Schema.decodeEffect(
              Schema.fromJsonString(Schema.Struct({ "child-pid": Schema.Int })),
            )(info)
            namespacePids.push(ready["child-pid"])
            namespace = {
              pid: ready["child-pid"],
              identity: yield* fs.readLink(
                `/proc/${ready["child-pid"]}/ns/pid`,
              ),
            }
            if (request.method === "exec") {
              const network = yield* spawner.spawn(
                make(
                  "/usr/bin/python3",
                  [
                    path.join(options.workerDirectory, "network.py"),
                    options.slirpBinary,
                    String(ready["child-pid"]),
                  ],
                  {
                    env: {
                      PATH: "/usr/bin:/bin",
                      ...(options.slirpLibraryDirectory === undefined
                        ? {}
                        : { LD_LIBRARY_PATH: options.slirpLibraryDirectory }),
                    },
                    extendEnv: false,
                    killSignal: "SIGKILL",
                    stderr: "pipe",
                  },
                ),
              )
              yield* network.stderr.pipe(
                Stream.decodeText(),
                Stream.runForEach((text) =>
                  Effect.sync(() => {
                    diagnostic = (diagnostic + text).slice(-4096)
                  }),
                ),
                Effect.interruptible,
                Effect.forkScoped,
              )
              const connected = yield* network.stdout.pipe(
                Stream.decodeText(),
                Stream.runHead,
                Effect.timeout("5 seconds"),
              )
              if (Option.isNone(connected) || connected.value !== "1") {
                return yield* new EnvironmentError({
                  message: "Network isolation failed",
                  cause: diagnostic,
                })
              }
            }
            return yield* restore(
              Effect.gen(function* () {
                yield* Stream.make(
                  new TextEncoder().encode(JSON.stringify(request)),
                ).pipe(Stream.run(child.stdin))
                const message = yield* Effect.raceFirst(
                  Deferred.await(result),
                  Fiber.join(reader).pipe(
                    Effect.andThen(
                      Effect.fail(
                        new EnvironmentError({
                          message: "Sandbox exited without a result",
                          cause: diagnostic,
                        }),
                      ),
                    ),
                  ),
                )
                // The kernel's PID namespace teardown also kills daemonized descendants.
                yield* child.exitCode
                if (!("kind" in message) || message.kind !== "result") {
                  return yield* new EnvironmentError({
                    message: "Missing sandbox result",
                  })
                }
                return message.result
              }),
            )
          }),
        ),
      )
      return yield* program.pipe(
        Effect.ensuring(
          Effect.gen(function* () {
            if (namespace === undefined) return
            const owned = namespace
            const present = fs.readLink(`/proc/${owned.pid}/ns/pid`).pipe(
              Effect.map((value) => value === owned.identity),
              Effect.catchTag("PlatformError", (error) =>
                error.reason._tag === "NotFound"
                  ? Effect.succeed(false)
                  : Effect.fail(error),
              ),
            )
            while (yield* present) yield* Effect.sleep("10 millis")
          }).pipe(
            Effect.timeout("5 seconds"),
            Effect.tapError((cause) =>
              Effect.sync(() => {
                cleanupFailure = cause
              }),
            ),
            Effect.orDie,
          ),
        ),
        Effect.onExit((exit) =>
          Effect.gen(function* () {
            const endedAt = DateTime.toEpochMillis(yield* DateTime.now)
            const receipt: OperationReceipt = {
              receiptId,
              environmentId: id,
              method: request.method,
              args: request.args,
              startedAt,
              endedAt,
              output,
              outcome:
                exit._tag === "Failure"
                  ? Cause.hasInterrupts(exit.cause)
                    ? "INTERRUPTED"
                    : "FAILED"
                  : exit.value.ok &&
                      !(
                        request.method === "exec" &&
                        Schema.is(ShellResult)(exit.value.value) &&
                        exit.value.value.exitCode !== 0
                      )
                    ? "SUCCEEDED"
                    : "FAILED",
              result:
                exit._tag === "Success"
                  ? exit.value
                  : { error: Cause.pretty(exit.cause) },
            }
            receipts.push(receipt)
            if (options.onReceipt !== undefined)
              yield* options.onReceipt(receipt).pipe(Effect.orDie)
          }),
        ),
      )
    })

    yield* fs.writeFileString(
      path.join(directory, ".tmp", "resolv.conf"),
      "nameserver 10.0.2.3\n",
    )

    const call = async <A, E extends FileError | ExecutionError>(
      method: Request["method"],
      args: unknown[],
      schema: Schema.Codec<A>,
      chord: ChordContext,
      error: (code: string, message: string, spillPath?: string) => E,
      onOutput?: ShellExecOptions["onOutput"],
      receiptId = crypto.randomUUID(),
    ): Promise<Result<A, E>> => {
      if (closed)
        return err(error("aborted", "Execution environment is closed"))
      const controller = new AbortController()
      const abort = () => controller.abort()
      chord.abortSignal?.addEventListener("abort", abort, { once: true })
      if (chord.abortSignal?.aborted) controller.abort()
      const task = run(
        operation({ method, args, cwd }, onOutput, chord, receiptId).pipe(
          permits.withPermit,
          Effect.flatMap((result) =>
            result.ok
              ? Schema.decodeUnknownEffect(schema)(result.value).pipe(
                  Effect.map(ok<A, E>),
                )
              : Effect.succeed(
                  err<A, E>(
                    error(
                      result.error.code,
                      result.error.message,
                      result.error.spillPath,
                    ),
                  ),
                ),
          ),
        ),
        { signal: controller.signal },
      )
      active.set(controller, task)
      try {
        return await task
      } catch {
        return err(
          error(
            controller.signal.aborted ? "aborted" : "unknown",
            "Execution environment operation did not settle",
          ),
        )
      } finally {
        active.delete(controller)
        chord.abortSignal?.removeEventListener("abort", abort)
      }
    }
    const fileError = (code: string, message: string) =>
      new FileError(Schema.decodeUnknownSync(FileCode)(code), message)
    const executionError = (
      code: string,
      message: string,
      spillPath?: string,
    ) => {
      const error = new ExecutionError(
        Schema.decodeUnknownSync(ExecutionCode)(code),
        message,
      )
      if (spillPath !== undefined) error.spillPath = spillPath
      return error
    }
    const file = <A>(
      method: Request["method"],
      args: unknown[],
      schema: Schema.Codec<A>,
      chord: ChordContext,
    ) => call(method, args, schema, chord, fileError)
    const cleanup = async () => {
      closed = true
      for (const controller of active.keys()) controller.abort()
      await Promise.allSettled(active.values())
      if (cleanupFailure !== undefined)
        throw new EnvironmentError({
          message: "Pi environment cleanup failed",
          cause: cleanupFailure,
        })
      await run(fs.remove(directory, { recursive: true, force: true }))
    }
    yield* Effect.addFinalizer(() => Effect.promise(cleanup))
    const env: ExecutionEnv = {
      id,
      get cwd() {
        return cwd
      },
      set cwd(value) {
        cwd = value
      },
      absolutePath: (value, c) =>
        file("absolutePath", [value], Schema.String, c),
      joinPath: (value, c) => file("joinPath", [value], Schema.String, c),
      readTextFile: (value, c) =>
        file("readTextFile", [value], Schema.String, c),
      readTextLines: (value, opts, c) =>
        file(
          "readTextLines",
          [value, opts],
          Schema.mutable(Schema.Array(Schema.String)),
          c,
        ),
      readBinaryFile: async (value, c) => {
        const result = await file(
          "readBinaryFile",
          [value],
          Schema.Array(Schema.Int),
          c,
        )
        return result.ok ? ok(Uint8Array.from(result.value)) : result
      },
      writeFile: (value, content, c) =>
        file(
          "writeFile",
          [value, typeof content === "string" ? content : Array.from(content)],
          Schema.Null,
          c,
        ).then((r) => (r.ok ? ok(undefined) : r)),
      appendFile: (value, content, c) =>
        file(
          "appendFile",
          [value, typeof content === "string" ? content : Array.from(content)],
          Schema.Null,
          c,
        ).then((r) => (r.ok ? ok(undefined) : r)),
      truncateFile: (value, size, c) =>
        file("truncateFile", [value, size], Schema.Unknown, c).then((r) =>
          r.ok ? ok(undefined) : r,
        ),
      flushFile: (value, c) =>
        file("flushFile", [value], Schema.Unknown, c).then((r) =>
          r.ok ? ok(undefined) : r,
        ),
      renameFile: (src, dest, c) =>
        file("renameFile", [src, dest], Schema.Unknown, c).then((r) =>
          r.ok ? ok(undefined) : r,
        ),
      fileInfo: (value, c) => file("fileInfo", [value], FileInfo, c),
      listDir: (value, c) =>
        file("listDir", [value], Schema.mutable(Schema.Array(FileInfo)), c),
      canonicalPath: (value, c) =>
        file("canonicalPath", [value], Schema.String, c),
      exists: (value, c) => file("exists", [value], Schema.Boolean, c),
      createDir: (value, opts, c) =>
        file("createDir", [value, opts], Schema.Unknown, c).then((r) =>
          r.ok ? ok(undefined) : r,
        ),
      remove: (value, opts, c) =>
        file("remove", [value, opts], Schema.Unknown, c).then((r) =>
          r.ok ? ok(undefined) : r,
        ),
      createTempDir: (value, c) =>
        file("createTempDir", [value], Schema.String, c),
      createTempFile: (opts, c) =>
        file("createTempFile", [opts], Schema.String, c),
      openTextLineReader: async (value, c) => {
        const result = await file(
          "openTextLineReader",
          [value],
          Schema.Array(TextLine),
          c,
        )
        if (!result.ok) return result
        let index = 0
        let ended = false
        const reader: TextLineReader = {
          readLine: async (context) =>
            context.abortSignal?.aborted
              ? err(new FileError("aborted", "Read aborted"))
              : ok(ended ? undefined : result.value[index++]),
          close: async () => {
            ended = true
          },
        }
        return ok(reader)
      },
      exec: (command, opts, c) =>
        call(
          "exec",
          [
            command,
            {
              ...opts,
              onOutput: undefined,
            },
          ],
          ShellResult,
          c,
          executionError,
          opts?.onOutput,
        ),
      cleanup,
    }

    const retainArtifact = Effect.fn("Pi.retainArtifact")(function* (
      filename: string,
      chord: ChordContext,
    ) {
      const receiptId = crypto.randomUUID()
      const read = yield* Effect.promise(() =>
        call(
          "readBinaryFile",
          [filename],
          Schema.Array(Schema.Int),
          chord,
          fileError,
          undefined,
          receiptId,
        ),
      )
      const result = read.ok
        ? ok<Uint8Array, FileError>(Uint8Array.from(read.value))
        : read
      if (!result.ok)
        return yield* new EnvironmentError({ message: result.error.message })
      const digest = yield* Effect.promise(() =>
        crypto.subtle.digest("SHA-256", Uint8Array.from(result.value)),
      )
      const hash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("")
      yield* fs.makeDirectory(options.artifactDirectory, {
        recursive: true,
        mode: 0o700,
      })
      const destination = path.join(options.artifactDirectory, hash)
      if (!(yield* fs.exists(destination))) {
        const temporary = yield* fs.makeTempFileScoped({
          directory: options.artifactDirectory,
        })
        yield* fs.writeFile(temporary, result.value, { mode: 0o600 })
        yield* fs.rename(temporary, destination)
      }
      return {
        artifactId: hash,
        receiptId,
        bytes: result.value.byteLength,
        path: destination,
      }
    }, Effect.scoped)
    const restoreArtifact = Effect.fn("Pi.restoreArtifact")(function* (
      artifactId: string,
      filename: string,
      chord: ChordContext,
    ) {
      const valid = yield* Schema.decodeEffect(
        Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
      )(artifactId)
      const content = yield* fs.readFile(
        path.join(options.artifactDirectory, valid),
      )
      const digest = yield* Effect.promise(() =>
        crypto.subtle.digest("SHA-256", Uint8Array.from(content)),
      )
      const hash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("")
      if (hash !== valid)
        return yield* new EnvironmentError({
          message: "Retained artifact failed integrity validation",
        })
      const written = yield* Effect.promise(() =>
        env.writeFile(filename, content, chord),
      )
      if (!written.ok)
        return yield* new EnvironmentError({ message: written.error.message })
    })
    return {
      env,
      receipts: () => receipts.slice(),
      namespacePids: () => namespacePids.slice(),
      retainArtifact,
      restoreArtifact,
    }
  },
  Effect.mapError(
    (cause) =>
      new EnvironmentError({
        message: "Could not acquire controlled Pi environment",
        cause,
      }),
  ),
)
