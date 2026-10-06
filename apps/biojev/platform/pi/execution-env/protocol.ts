import { Schema } from "effect"

export const Method = Schema.Literals([
  "absolutePath",
  "joinPath",
  "readTextFile",
  "openTextLineReader",
  "readTextLines",
  "readBinaryFile",
  "writeFile",
  "appendFile",
  "truncateFile",
  "flushFile",
  "renameFile",
  "fileInfo",
  "listDir",
  "canonicalPath",
  "exists",
  "createDir",
  "remove",
  "createTempDir",
  "createTempFile",
  "exec",
  "openBinaryReader",
  "openDirReader",
  "watch",
])

// Scientific payloads stay open; this validates the private transport envelope.
export const Request = Schema.Struct({
  method: Method,
  args: Schema.Array(Schema.Unknown),
  cwd: Schema.String,
  session: Schema.optionalKey(Schema.Boolean),
})

export const WireError = Schema.Struct({
  code: Schema.String,
  message: Schema.String,
  spillPath: Schema.optionalKey(Schema.String),
})

export const Message = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("watch"), change: Schema.Unknown }),
  Schema.Struct({ "child-pid": Schema.Int }),
  Schema.Struct({ "exit-code": Schema.Int }),
  Schema.Struct({
    kind: Schema.Literal("output"),
    text: Schema.String,
    stream: Schema.Literals(["stdout", "stderr"]),
  }),
  Schema.Struct({
    kind: Schema.Literal("result"),
    result: Schema.Union([
      Schema.Struct({ ok: Schema.Literal(true), value: Schema.Unknown }),
      Schema.Struct({ ok: Schema.Literal(false), error: WireError }),
    ]),
  }),
])

export type Request = typeof Request.Type
