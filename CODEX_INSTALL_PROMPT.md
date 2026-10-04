# Codex dependency + bootstrap prompt

Bootstrap this existing BioJev scaffold. Do not redesign the architecture.

First verify repository truth:
- `git status`
- `git log --oneline -5`
- current files
- root/workspace package manifests
- `node --version`
- `npm --version`

Read:
- `AGENTS.md`
- `specs/architecture/README.md`
- `specs/architecture/AUTHORITY.md`
- `specs/architecture/BIOLAB.md`
- `specs/architecture/EXECUTION_ENV.md`
- `specs/architecture/PI_COMPATIBILITY.md`
- `specs/architecture/AGENT_ROLES.md`
- `specs/architecture/JEVENGINE.md`
- `specs/guides/EFFECT.md`
- `specs/guides/FEEDBACK_LOOP.md`
- `specs/IMPLEMENTATION_PLAN.md`

This task is only repository bootstrap, dependency installation, Effect tooling, and the smallest real backend/UI status path.

Do not implement:
- autonomous Director behavior
- Researcher behavior
- Validator behavior
- BioLab database schema
- real ExecutionEnv isolation
- Jev integration
- continuous mission loop

Execution is provided by ExecutionEnv. Do not create a second execution subsystem.

## Architecture baseline

```text
core
    controls what is legally allowed to run next

agents
    decide what and how

BioLab
    canonical memory + capability history

JevEngine
    semantic measurement

AgentRuntime
    Pi Durable cognition

ExecutionEnv
    controlled broad computation
```

No subagents.

BioLab and Pi use separate SQLite databases.

## 1. Verify exact compatible versions

Query npm:

```bash
npm view effect version
npm view @effect/platform-node version
npm view @effect/sql-sqlite-node version
npm view @effect/vitest version
npm view @effect/tsgo version
npm view typescript version
npm view vitest version
npm view @biomejs/biome version
npm view @types/node version

npm view @earendil-works/pi-durable version
npm view @earendil-works/pi-ai version
npm view @earendil-works/chord version

npm view @typesafe-ai/sdk version
```

Inspect compatibility:

```bash
npm view @effect/vitest peerDependencies
npm view @effect/tsgo peerDependencies
npm view @earendil-works/pi-durable engines dependencies
npm view @earendil-works/pi-ai engines
npm view @earendil-works/chord engines
```

Reference versions when this scaffold was written:
- Effect family: 4.0.0
- @effect/tsgo: 0.48.0
- TypeScript 7.0.2
- Pi durable/pi-ai/chord: 1.0.2
- @typesafe-ai/sdk: 0.6.0

Use the current mutually compatible stable set you verify.

Use exact versions. `.npmrc` already has `save-exact=true`.

## 2. Install root development dependencies

Install exact versions of:
- typescript
- @types/node compatible with active Node
- @effect/tsgo
- @effect/vitest
- vitest
- @biomejs/biome

## 3. Install backend runtime dependencies

Install into workspace `@biojev/backend`:
- effect
- @effect/platform-node
- @effect/sql-sqlite-node
- @earendil-works/pi-durable
- @earendil-works/pi-ai
- @earendil-works/chord
- @typesafe-ai/sdk

Do not install:
- Zod
- Kysely
- LangGraph
- Deep Agents
- Pydantic AI
- Effect AI for agent orchestration
- Express
- Fastify
- Hono
- a workflow engine
- an event-sourcing framework

## 4. Configure @effect/tsgo

Run:

```bash
npx @effect/tsgo setup --help
```

Then use the installed version's supported setup flow.

Use @effect/tsgo as the Effect-aware TypeScript language service.
Do not configure standalone tsgo in parallel.

This repo has no `src/` directories. Ensure diagnostics cover:

```text
apps/biojev/**/*.ts
```

Keep strong correctness diagnostics for:
- floatingEffect
- missingEffectContext
- missingEffectError
- missingLayerContext
- missingEffectServiceDependency
- genericEffectServices
- unsafeEffectTypeAssertion
- duplicatePackage
- tryCatchInEffectGen
- missingStarInYieldEffectGen
- runEffectInsideEffect

Use installed option names if they differ.

## 5. Verify Effect APIs from installed source

Read `node_modules/effect/AGENTS.md` if present.

Confirm current v4 conventions before editing scaffold code:
- Context.Service
- Schema.TaggedError
- NodeRuntime.runMain
- FileSystem
- Path
- HttpClient
- ChildProcess
- ChildProcessSpawner
- NodeServices
- Effect SQL SQLite

Make only small compatibility edits.

Do not replace Effect portable services with raw Node I/O.

## 6. Next.js

Inspect:

```bash
npx create-next-app@latest --help
```

Generate `apps/web` with:
- TypeScript
- App Router
- Tailwind
- npm
- Biome if supported
- NO src directory
- alias `@/*`

Do not create a second lockfile.

If create-next-app creates `apps/web/package-lock.json`, remove it and run root `npm install`.

## 7. Minimal real status path

Implement only enough backend HTTP for:

```text
GET /api/status
```

Response:

```json
{ "status": "IDLE" }
```

Use current Effect v4 HTTP facilities after inspecting installed docs/source.

Run the outer program with `NodeRuntime.runMain`.

If the needed HTTP API is unstable:
- use the smallest exact unstable surface;
- allowlist only that exact usage if necessary;
- document it in `specs/guides/EFFECT.md`;
- do not globally disable unstable diagnostics.

Make Next.js render:

```text
BioJev
Status: IDLE
```

from the real backend.

No fake activity.

## 8. ExecutionEnv compatibility check

Do not implement the real isolation layer yet.

Verify that the installed Effect packages provide the current equivalents of:
- FileSystem
- Path
- HttpClient
- ChildProcess
- ChildProcessSpawner

Keep `ExecutionEnv` as the broad controlled computation boundary.

Do not introduce:
- a second execution subsystem
- PythonEngine
- RustEngine
- bespoke service per scientific program

Future runtime freedom lives inside ExecutionEnv.

## 9. Pi compatibility check

Read the installed Pi Durable README/source.

Preserve:
- Pi imports only under `agent-runtime/**`
- Director may be persistent
- Researcher fresh per new ResearchBlock
- Validator fresh per validation cycle
- no subagents
- Pi owns runtime cognition, not BioLab state

Confirm the installed semantics for abort/wait before implementing ResearchBlock timeout later.

Do not make Pi tools write raw canonical SQL.

Pi execution tools should call ExecutionEnv and then authorized BioLab recording operations.

## 10. Reference source

If git is clean and a baseline commit exists, add squashed subtrees:

```bash
git subtree add --prefix=repos/effect https://github.com/Effect-TS/effect.git main --squash
git subtree add --prefix=repos/pi https://github.com/earendil-works/pi.git main --squash
git subtree add --prefix=repos/typesafe https://github.com/typesafe-ai/typesafe-sdk-js.git main --squash
```

If this would require an unsolicited commit or the tree is dirty:
- do not create nested clones;
- leave `repos/README.md`;
- report the commands for later.

Production code never imports from `repos/**`.

## 11. Effect skill

Inspect:

```bash
npx skills add Effect-TS/skills --help
```

If safe, install only the relevant `effect-ts` skill for Codex.

Do not alter unrelated global skill setup.

## 12. Feedback loop

Run:

```bash
npm run check:boundaries
npm run check:effect
npm run lint
npm test
npm run typecheck
npm run build
```

Fix compatibility issues rather than suppressing diagnostics.

Do not weaken:
- BioLab authority
- ExecutionEnv boundary
- Pi boundary
- Jev boundary
- no-subagent rule

## Final report

Report:
1. Node/npm versions
2. exact installed dependency versions
3. final tree excluding node_modules and vendored internals
4. tsgo status
5. boundary-check status
6. lint status
7. test status
8. build status
9. backend/UI status verification
10. source subtrees added or deferred
11. unstable Effect APIs used
12. smallest next task

Do not begin Task 2 automatically.
