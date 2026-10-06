// Private sandbox transport, not a tool/cognition runtime. All operations use Pi.
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context"
import { NodeExecutionEnv } from "@earendil-works/pi-durable/env/node"
import { Schema } from "effect"
import { Request } from "./protocol.ts"

const emit = (value: unknown) => {
  const encoded = JSON.stringify(value)
  if (encoded.length > 32 * 1024 * 1024)
    throw new Error("Environment response too large")
  process.stdout.write(`${encoded}\n`)
}
async function* requests() {
  let pending = ""
  for await (const chunk of process.stdin) {
    pending += chunk.toString()
    if (pending.length > 32 * 1024 * 1024)
      throw new Error("Environment request too large")
    let end = pending.indexOf("\n")
    while (end >= 0) {
      yield pending.slice(0, end)
      pending = pending.slice(end + 1)
      end = pending.indexOf("\n")
    }
  }
  if (pending.length > 0) yield pending
}
const iterator = requests()[Symbol.asyncIterator]()
const first = await iterator.next()
if (first.done) throw new Error("Missing environment request")
const request = Schema.decodeSync(Schema.fromJsonString(Request))(first.value)
const env = new NodeExecutionEnv({ cwd: request.cwd })
try {
  const args = request.args.slice()
  if (
    (request.method === "writeFile" || request.method === "appendFile") &&
    Array.isArray(args[1])
  ) {
    args[1] = Uint8Array.from(
      Schema.decodeSync(Schema.Array(Schema.Int))(args[1]),
    )
  }
  if (request.method === "exec") {
    args[1] = {
      ...Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(
        args[1] ?? {},
      ),
      onOutput: (
        text: string,
        _context: unknown,
        info: { stream: "stdout" | "stderr" },
      ) => emit({ kind: "output", text, stream: info.stream }),
    }
  }
  if (request.session) {
    const opened =
      request.method === "watch"
        ? await env.watch(
            Schema.decodeUnknownSync(
              Schema.Array(
                Schema.Struct({
                  path: Schema.String,
                  recursive: Schema.optionalKey(Schema.Boolean),
                  exclude: Schema.optionalKey(
                    Schema.Struct({
                      hidden: Schema.optionalKey(Schema.Boolean),
                      names: Schema.optionalKey(Schema.Array(Schema.String)),
                    }),
                  ),
                }),
              ),
            )(args[0]),
            (change) =>
              emit({
                kind: "watch",
                change:
                  "error" in change
                    ? {
                        error: {
                          code: change.error.code,
                          message: change.error.message,
                        },
                      }
                    : change,
              }),
            BACKGROUND_CONTEXT,
          )
        : await Reflect.apply(env[request.method], env, [
            ...args,
            BACKGROUND_CONTEXT,
          ])
    const send = (result: {
      ok: boolean
      value?: unknown
      error?: { code: string; message: string }
    }) =>
      emit({
        kind: "result",
        result: result.ok
          ? {
              ok: true,
              value:
                result.value instanceof Uint8Array
                  ? Array.from(result.value)
                  : (result.value ?? null),
            }
          : {
              ok: false,
              error: {
                code: result.error?.code,
                message: result.error?.message,
              },
            },
      })
    if (!opened.ok) {
      send(opened)
    } else {
      const handle = opened.value
      send({
        ok: true,
        value: request.method === "watch" ? { mode: handle.mode } : null,
      })
      try {
        for await (const line of { [Symbol.asyncIterator]: () => iterator }) {
          const command = Schema.decodeSync(
            Schema.fromJsonString(
              Schema.Struct({
                action: Schema.Literals([
                  "info",
                  "read",
                  "scanLines",
                  "readLine",
                  "next",
                  "close",
                ]),
                args: Schema.Array(Schema.Unknown),
              }),
            ),
          )(line)
          if (command.action === "close") {
            send({ ok: true })
            break
          }
          const result = await Reflect.apply(handle[command.action], handle, [
            ...command.args,
            BACKGROUND_CONTEXT,
          ])
          send(
            Schema.decodeUnknownSync(
              Schema.Union([
                Schema.Struct({
                  ok: Schema.Literal(true),
                  value: Schema.optionalKey(Schema.Unknown),
                }),
                Schema.Struct({
                  ok: Schema.Literal(false),
                  error: Schema.Struct({
                    code: Schema.String,
                    message: Schema.String,
                  }),
                }),
              ]),
            )(result),
          )
        }
      } finally {
        await handle.close(BACKGROUND_CONTEXT)
      }
    }
  } else {
    let result = await Reflect.apply(env[request.method], env, [
      ...args,
      BACKGROUND_CONTEXT,
    ])
    if (result.ok && result.value instanceof Uint8Array) {
      result = { ok: true, value: Array.from(result.value) }
    }
    emit(
      result.ok
        ? { kind: "result", result: { ok: true, value: result.value ?? null } }
        : {
            kind: "result",
            result: {
              ok: false,
              error: {
                code: result.error.code,
                message: result.error.message,
                spillPath: result.error.spillPath,
              },
            },
          },
    )
  }
} finally {
  await env.cleanup(BACKGROUND_CONTEXT)
  process.stdin.destroy()
}
