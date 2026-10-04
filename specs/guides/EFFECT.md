# Effect guide for BioJev

Use the installed Effect version as the contract.

For unfamiliar work:
1. inspect `node_modules/effect/AGENTS.md`;
2. inspect `repos/effect/LLMS.md` if vendored;
3. inspect relevant ai-docs;
4. inspect relevant source/tests.

Do not guess old Effect v3 APIs.

## Use the right abstraction level

```text
pure function
  deterministic transformation

Effect program
  dependencies, failures, async, resources

Effect Service
  genuine reusable capability

Layer
  concrete implementation
```

Do not create an Effect Service for every domain noun.

Likely high-value Services:
- BioLab
- JevEngine
- AgentRuntime
- ExecutionEnv

Core lifecycle and agent invocation logic are programs.

## Preferred Effect mechanisms

Use Effect for:
- typed effects
- Context.Service
- Layers
- Scope/resource lifetime
- Config
- Schema
- Schedule
- Stream/PubSub
- HTTP
- FileSystem/Path
- ChildProcess/ChildProcessSpawner
- SQL
- logging/observability
- Vitest integration

## Do not duplicate owners

Pi Durable owns agent conversation/task durability.

Do not rebuild that with Effect Workflow or a second agent framework.

BioLab typed records are canonical institutional history.

Do not add a universal event ledger just because Effect provides event-oriented facilities.

Pi owns LLM runtime cognition.

Do not add Effect AI as a second agent orchestrator.

## Platform boundary

Application programs and ExecutionEnv depend on portable Effect services.

Concrete Node implementations are supplied at the edge through `@effect/platform-node`.

This is the reason ExecutionEnv can support Python, R, Rust, CLI tools, or future computation without raw Node APIs leaking into the architecture.

## Runners

Keep `NodeRuntime.runMain` at the outer process boundary.

Normal application modules return Effects.

## Errors

Expected failures use typed errors, usually `Schema.TaggedError`.

Do not swallow failures to simplify types.

## Layers

Construct long-lived Layers once at the composition root.

Do not build production Layers inside agent/domain programs.

## Verified bootstrap compatibility (2026-10-05)

Installed Effect, platform-node, sql-sqlite-node, and vitest integration are
exactly 4.0.0. TypeScript 7.0.2 is patched by @effect/tsgo 0.48.0 through
`npm run prepare`; VS Code must use the TypeScript 7 extension and workspace SDK.
Backend diagnostics include every `apps/biojev/**/*.ts` file. The CLI diagnostics
command checks Effect rules; `npm run typecheck` also checks ordinary TS errors.

Verified in installed source:
- `Context.Service` and `Schema.TaggedError` remain the service/error conventions.
- `Config.String` / `Config.Port` and `Schema.Literals([...])` are v4 spellings.
- `NodeRuntime.runMain` runs the outer scoped server program.
- `effect/FileSystem` and `effect/Path` provide portable filesystem/path services.
- `effect/http` provides HttpClient; NodeHttpClient.layer supplies Node transport.
- `effect/process` provides ChildProcess and ChildProcessSpawner.
- NodeServices.layer supplies filesystem, path, process spawning, crypto, stdio,
  and terminal; it does not supply HttpClient.
- SqliteClient.layer in @effect/sql-sqlite-node supplies the SQLite client and
  generic `effect/sql/SqlClient`, with scoped database lifetime. No database
  schema or database initialization is part of bootstrap.

The minimal status HTTP path uses these unstable exports, pinned to Effect 4.0.0:
- `effect/http/HttpRouter#add` in `http/status.ts`;
- `effect/http/HttpServerResponse#json` in `http/status.ts`;
- `effect/http/HttpRouter#serve` in `main.ts` and `test/status.test.ts`;
- `effect/http/HttpClient#HttpClient` in `test/status.test.ts` only.

The tsgo configuration allowlists only these exports in those files. All other
unstable and experimental API diagnostics remain errors. Recheck these APIs
against installed source before upgrading. Node's createServer is isolated in
`platform/HttpLive.ts` as the constructor required by NodeHttpServer.layerConfig;
Effect owns serving and resource cleanup.
