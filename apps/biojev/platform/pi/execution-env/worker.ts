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
let input = ""
for await (const chunk of process.stdin) {
  input += chunk.toString()
  if (input.length > 32 * 1024 * 1024)
    throw new Error("Environment request too large")
}
const request = Schema.decodeSync(Schema.fromJsonString(Request))(input)
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
      onOutput: (text: string) => emit({ kind: "output", text }),
    }
  }
  let result = await Reflect.apply(env[request.method], env, [
    ...args,
    BACKGROUND_CONTEXT,
  ])
  if (result.ok && request.method === "openTextLineReader") {
    const lines = []
    const reader = result.value
    let bytes = 0
    try {
      while (true) {
        const line = await reader.readLine(BACKGROUND_CONTEXT)
        if (!line.ok) {
          result = line
          break
        }
        if (line.value === undefined) {
          result = { ok: true, value: lines }
          break
        }
        bytes += line.value.text.length
        if (bytes > 16 * 1024 * 1024)
          throw new Error("Line reader snapshot too large")
        lines.push(line.value)
      }
    } finally {
      await reader.close(BACKGROUND_CONTEXT)
    }
  }
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
} finally {
  await env.cleanup(BACKGROUND_CONTEXT)
}
