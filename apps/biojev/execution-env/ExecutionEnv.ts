import { Context, type Effect, Schema } from "effect"

export class ExecutionEnvError extends Schema.TaggedError<ExecutionEnvError>()(
  "ExecutionEnvError",
  {
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
) {}

export interface ExecutionArtifactRef {
  readonly sha256: string
  readonly pathHint?: string
  readonly mediaType?: string
  readonly byteLength?: number
}

export interface CommandRequest {
  readonly program: string
  readonly args: ReadonlyArray<string>
  readonly cwd?: string
  readonly env?: Readonly<Record<string, string>>
  readonly timeoutMs?: number
  readonly network?: "disabled" | "restricted" | "enabled"
}

export interface CommandReceipt {
  readonly receiptId: string
  readonly program: string
  readonly args: ReadonlyArray<string>
  readonly cwd: string
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
  readonly artifacts: ReadonlyArray<ExecutionArtifactRef>
}

export interface HttpRequest {
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD"
  readonly url: string
  readonly headers?: Readonly<Record<string, string>>
  readonly body?: Uint8Array
  readonly timeoutMs?: number
}

export interface HttpReceipt {
  readonly receiptId: string
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  readonly body: Uint8Array
}

/**
 * Broad execution capability for agents.
 *
 * ExecutionEnv owns the controlled working environment:
 * - filesystem boundary
 * - process execution
 * - environment variables
 * - network policy
 * - process lifetime
 * - resource limits
 * - isolation from host secrets and canonical databases
 *
 * It does not decide what research should be done and does not create
 * ScientificResult by itself.
 *
 * Concrete implementations should prefer Effect portable platform services:
 * FileSystem, Path, HttpClient, ChildProcess/ChildProcessSpawner, Scope, Stream.
 */
export class ExecutionEnv extends Context.Service<
  ExecutionEnv,
  {
    readonly readText: (
      path: string,
    ) => Effect.Effect<string, ExecutionEnvError>

    readonly writeText: (
      path: string,
      content: string,
    ) => Effect.Effect<void, ExecutionEnvError>

    readonly editText: (
      path: string,
      search: string,
      replacement: string,
    ) => Effect.Effect<void, ExecutionEnvError>

    readonly run: (
      request: CommandRequest,
    ) => Effect.Effect<CommandReceipt, ExecutionEnvError>

    readonly request: (
      request: HttpRequest,
    ) => Effect.Effect<HttpReceipt, ExecutionEnvError>
  }
>()("BioJev/ExecutionEnv") {}
