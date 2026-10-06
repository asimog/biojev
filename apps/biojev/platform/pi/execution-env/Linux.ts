import type { Context as ChordContext } from "@earendil-works/chord"
import {
  type BinaryReader,
  type DirReader,
  type ExecutionEnv,
  ExecutionError,
  err,
  FileError,
  type FileWatcher,
  ok,
  type Result,
  type ShellExecOptions,
  type TextLineReader,
  type WatchChange,
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
  Queue,
  Schema,
  Semaphore,
  Stream,
} from "effect"
import { make } from "effect/process/ChildProcess"
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner"
import { Message, type Request, WireError } from "./protocol.ts"

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
      session?: {
        requests: Queue.Queue<Uint8Array>
        receive: (message: typeof Message.Type) => void
      },
    ) {
      const startedAt = DateTime.toEpochMillis(yield* DateTime.now)
      let output = ""
      let sessionResult:
        | { ok: true; value: unknown }
        | { ok: false; error: typeof WireError.Type } = {
        ok: true,
        value: null,
      }
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
              "--bind",
              path.join(directory, ".tmp"),
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
                    yield* Effect.sync(() =>
                      onOutput?.(message.text, chord, {
                        stream: message.stream,
                      }),
                    )
                  } else if (session !== undefined && "kind" in message) {
                    yield* Effect.sync(() => {
                      if (message.kind === "result")
                        sessionResult = message.result
                      session.receive(message)
                    })
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
                if (session !== undefined) {
                  yield* Stream.fromQueue(session.requests).pipe(
                    Stream.run(child.stdin),
                    Effect.forkScoped,
                  )
                  yield* child.exitCode
                  return sessionResult
                }
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
              args:
                request.method === "writeFile" ||
                request.method === "appendFile"
                  ? [
                      request.args[0],
                      {
                        bytes: Array.isArray(request.args[1])
                          ? request.args[1].length
                          : String(request.args[1]).length,
                      },
                    ]
                  : request.args,
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
                  ? request.method === "readBinaryFile"
                    ? { ok: exit.value.ok, transferred: true }
                    : exit.value
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
    const openSession = async (
      method:
        | "openBinaryReader"
        | "openDirReader"
        | "openTextLineReader"
        | "watch",
      args: unknown[],
      chord: ChordContext,
      onChange?: (change: WatchChange) => void,
    ) => {
      if (closed || chord.abortSignal?.aborted)
        return err<never, FileError>(new FileError("aborted", "Open aborted"))
      const requests = await run(Queue.make<Uint8Array>())
      const responses = await run(Queue.make<unknown>())
      const controller = new AbortController()
      const task = run(
        operation(
          { method, args, cwd, session: true },
          undefined,
          chord,
          crypto.randomUUID(),
          {
            requests,
            receive: (message) => {
              if ("kind" in message && message.kind === "watch") {
                const change = Schema.decodeUnknownSync(
                  Schema.Union([
                    Schema.Struct({
                      paths: Schema.mutable(Schema.Array(Schema.String)),
                    }),
                    Schema.Struct({ overflow: Schema.Literal(true) }),
                    Schema.Struct({ error: WireError }),
                  ]),
                )(message.change)
                onChange?.(
                  "error" in change
                    ? {
                        error: fileError(
                          change.error.code,
                          change.error.message,
                        ),
                      }
                    : change,
                )
              } else if ("kind" in message && message.kind === "result") {
                void run(Queue.offer(responses, message.result))
              }
            },
          },
        ),
        { signal: controller.signal },
      )
      active.set(controller, task)
      let ended = false
      const lock = await run(Semaphore.make(1))
      const receive = <A>(schema: Schema.Codec<A>, context: ChordContext) =>
        run(
          Effect.raceFirst(
            Queue.take(responses).pipe(
              Effect.flatMap((raw) =>
                Schema.decodeUnknownEffect(
                  Schema.Union([
                    Schema.Struct({ ok: Schema.Literal(true), value: schema }),
                    Schema.Struct({
                      ok: Schema.Literal(false),
                      error: WireError,
                    }),
                  ]),
                )(raw),
              ),
              Effect.map((result) =>
                result.ok
                  ? ok<A, FileError>(result.value)
                  : err<A, FileError>(
                      fileError(result.error.code, result.error.message),
                    ),
              ),
            ),
            Effect.promise(() => task).pipe(
              Effect.andThen(
                Effect.fail(
                  new EnvironmentError({ message: "Reader worker exited" }),
                ),
              ),
            ),
          ),
          { signal: context.abortSignal },
        )
      await run(
        Queue.offer(
          requests,
          new TextEncoder().encode(
            `${JSON.stringify({ method, args, cwd, session: true })}\n`,
          ),
        ),
      )
      const opened = await receive(Schema.Unknown, chord)
      const close = async () => {
        if (ended) return
        ended = true
        await run(
          Queue.offer(
            requests,
            new TextEncoder().encode(
              `${JSON.stringify({ action: "close", args: [] })}\n`,
            ),
          ),
        )
        try {
          await run(
            Effect.promise(() => task).pipe(Effect.timeout("5 seconds")),
          )
        } catch {
          controller.abort()
          await task.catch(() => undefined)
        }
        active.delete(controller)
      }
      if (!opened.ok) {
        await close()
        return opened
      }
      const session = {
        value: opened.value,
        invoke: <A>(
          action: string,
          args: unknown[],
          schema: Schema.Codec<A>,
          context: ChordContext,
        ): Promise<Result<A, FileError>> => {
          if (ended || closed)
            return Promise.resolve(
              err(new FileError("invalid", "Reader closed")),
            )
          if (context.abortSignal?.aborted)
            return Promise.resolve(
              err(new FileError("aborted", "Read aborted")),
            )
          return run(
            lock.withPermit(
              Effect.tryPromise({
                try: async () => {
                  await run(
                    Queue.offer(
                      requests,
                      new TextEncoder().encode(
                        `${JSON.stringify({ action, args })}\n`,
                      ),
                    ),
                  )
                  return await receive(schema, context)
                },
                catch: (cause) =>
                  new EnvironmentError({
                    message: "Reader request failed",
                    cause,
                  }),
              }),
            ),
          ).catch(async () => {
            // A cancelled wait must not leave an unread response for the next request.
            await close()
            return err(
              new FileError(
                context.abortSignal?.aborted ? "aborted" : "unknown",
                "Reader operation did not settle",
              ),
            )
          })
        },
        close,
      }
      return ok<typeof session, FileError>(session)
    }
    const recordRead = async (
      method: "readBinaryFile" | "readTextFile",
      filename: string,
      startedAt: number,
      result: Result<unknown, FileError>,
    ) => {
      const receipt: OperationReceipt = {
        receiptId: crypto.randomUUID(),
        environmentId: id,
        method,
        args: [filename],
        startedAt,
        endedAt: Date.now(),
        outcome: result.ok ? "SUCCEEDED" : "FAILED",
        output: "",
        result: result.ok
          ? {
              bytes:
                result.value instanceof Uint8Array
                  ? result.value.length
                  : typeof result.value === "string"
                    ? new TextEncoder().encode(result.value).length
                    : 0,
            }
          : {
              error: { code: result.error.code, message: result.error.message },
            },
      }
      receipts.push(receipt)
      if (options.onReceipt !== undefined) await run(options.onReceipt(receipt))
    }
    const maxAssetBytes = 100_000_000
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
      readTextFile: async (value, c) => {
        const startedAt = Date.now()
        const read = await env.readBinaryFile(value, c)
        const result = read.ok
          ? ok<string, FileError>(
              new TextDecoder("utf-8", { ignoreBOM: true }).decode(read.value),
            )
          : read
        await recordRead("readTextFile", value, startedAt, result)
        return result
      },
      readTextLines: (value, opts, c) =>
        file(
          "readTextLines",
          [value, opts],
          Schema.mutable(Schema.Array(Schema.String)),
          c,
        ),
      readBinaryFile: async (value, c) => {
        const startedAt = Date.now()
        const result = await (async () => {
          const opened = await env.openBinaryReader(value, undefined, c)
          if (!opened.ok) return opened
          try {
            const info = await opened.value.info(c)
            if (!info.ok) return info
            if (info.value.size > maxAssetBytes)
              return err<Uint8Array, FileError>(
                new FileError("invalid", "Asset exceeds 100 MB"),
              )
            return await opened.value.read(0, info.value.size, c)
          } finally {
            await opened.value.close(c)
          }
        })()
        await recordRead("readBinaryFile", value, startedAt, result)
        return result
      },
      writeFile: async (value, content, c) => {
        const bytes =
          typeof content === "string"
            ? new TextEncoder().encode(content)
            : content
        if (bytes.length > maxAssetBytes)
          return err(new FileError("invalid", "Asset exceeds 100 MB"))
        const initial = await file("writeFile", [value, []], Schema.Null, c)
        if (!initial.ok) return initial
        for (let offset = 0; offset < bytes.length; offset += 1024 * 1024) {
          const result = await env.appendFile(
            value,
            bytes.subarray(offset, offset + 1024 * 1024),
            c,
          )
          if (!result.ok) return result
        }
        return ok(undefined)
      },
      appendFile: async (value, content, c) => {
        const bytes =
          typeof content === "string"
            ? new TextEncoder().encode(content)
            : content
        const info = await env.fileInfo(value, c)
        if (!info.ok && info.error.code !== "not_found") return info
        if ((info.ok ? info.value.size : 0) + bytes.length > maxAssetBytes)
          return err(new FileError("invalid", "Asset exceeds 100 MB"))
        for (let offset = 0; offset < bytes.length; offset += 1024 * 1024) {
          const result = await file(
            "appendFile",
            [value, Array.from(bytes.subarray(offset, offset + 1024 * 1024))],
            Schema.Null,
            c,
          )
          if (!result.ok) return result
        }
        return ok(undefined)
      },
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
        const opened = await openSession("openTextLineReader", [value], c)
        if (!opened.ok) return opened
        const reader: TextLineReader = {
          readLine: async (context) => {
            const result = await opened.value.invoke(
              "readLine",
              [],
              Schema.NullOr(TextLine),
              context,
            )
            return result.ok ? ok(result.value ?? undefined) : result
          },
          close: opened.value.close,
        }
        return ok(reader)
      },
      openBinaryReader: async (value, opts, context) => {
        const opened = await openSession(
          "openBinaryReader",
          [value, opts],
          context,
        )
        if (!opened.ok) return opened
        const reader: BinaryReader = {
          info: (c) => opened.value.invoke("info", [], FileInfo, c),
          read: async (offset, length, c) => {
            if (length > 1024 * 1024) {
              const chunks: Uint8Array[] = []
              let total = 0
              if (length > maxAssetBytes)
                return err(new FileError("invalid", "Read exceeds 100 MB"))
              while (total < length) {
                const part = await reader.read(
                  offset + total,
                  Math.min(1024 * 1024, length - total),
                  c,
                )
                if (!part.ok) return part
                chunks.push(part.value)
                total += part.value.length
                if (part.value.length === 0) break
              }
              const bytes = new Uint8Array(total)
              let at = 0
              for (const part of chunks) {
                bytes.set(part, at)
                at += part.length
              }
              return ok(bytes)
            }
            const result = await opened.value.invoke(
              "read",
              [offset, length],
              Schema.Array(Schema.Int),
              c,
            )
            return result.ok ? ok(Uint8Array.from(result.value)) : result
          },
          scanLines: (opts, c) =>
            opened.value.invoke(
              "scanLines",
              [opts],
              Schema.Struct({
                newlines: Schema.Int,
                start: Schema.Int,
                end: Schema.Int,
                firstLineEnd: Schema.Int,
                lastLineStart: Schema.Int,
                selectedBytes: Schema.Int,
                firstLineBytes: Schema.Int,
              }),
              c,
            ),
          close: opened.value.close,
        }
        return ok(reader)
      },
      openDirReader: async (value, c) => {
        const opened = await openSession("openDirReader", [value], c)
        if (!opened.ok) return opened
        const reader: DirReader = {
          next: (maxEntries, c) =>
            opened.value.invoke(
              "next",
              [maxEntries],
              Schema.Struct({
                entries: Schema.mutable(Schema.Array(FileInfo)),
                done: Schema.Boolean,
              }),
              c,
            ),
          close: opened.value.close,
        }
        return ok(reader)
      },
      watch: async (targets, onChange, c) => {
        const opened = await openSession("watch", [targets], c, onChange)
        if (!opened.ok) return opened
        const value = Schema.decodeUnknownSync(
          Schema.Struct({ mode: Schema.Literals(["native", "polling"]) }),
        )(opened.value.value)
        const watcher: FileWatcher = {
          mode: value.mode,
          close: opened.value.close,
        }
        return ok(watcher)
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
      const before = receipts.length
      const result = yield* Effect.promise(() =>
        env.readBinaryFile(filename, chord),
      )
      const receiptId = receipts
        .slice(before)
        .find((receipt) => receipt.method === "readBinaryFile")?.receiptId
      if (receiptId === undefined)
        return yield* new EnvironmentError({
          message: "Artifact read receipt is absent",
        })
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
