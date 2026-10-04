# Bootstrap verification — 2026-10-05

## Repository truth

The supplied directory had no `.git` metadata. Initial git status/log failed for
that reason. The requested GitHub repository https://github.com/asimog/biojev
returned no refs. This directory now uses Git branch `main` and that repository
as origin. At initial bootstrap there was no baseline commit. The follow-up request
authorized subtree installation: local baseline 0393e9f and three squashed
subtree imports now exist. Nothing has been pushed. Existing architecture was retained.

Node: **24.21.0**. npm: **11.19.0**. npm registry metadata verified current
versions, engine compatibility, and Effect/Vitest peers before installation.
There is one root `package-lock.json`; all direct dependency versions are exact.

## Installed dependencies

| Location | Package | Version |
| --- | --- | --- |
| . | @biomejs/biome | 2.5.15 |
| . | @effect/tsgo | 0.48.0 |
| . | @effect/vitest | 4.0.0 |
| . | @types/node | 24.19.1 |
| . | typescript | 7.0.2 |
| . | vitest | 5.0.3 |
| apps/biojev | @earendil-works/chord | 1.0.2 |
| apps/biojev | @earendil-works/pi-ai | 1.0.2 |
| apps/biojev | @earendil-works/pi-durable | 1.0.2 |
| apps/biojev | @effect/platform-node | 4.0.0 |
| apps/biojev | @effect/sql-sqlite-node | 4.0.0 |
| apps/biojev | @typesafe-ai/sdk | 0.6.0 |
| apps/biojev | effect | 4.0.0 |
| apps/web | next | 16.3.8 |
| apps/web | react | 19.2.8 |
| apps/web | react-dom | 19.2.8 |
| apps/web | @tailwindcss/postcss | 4.3.3 |
| apps/web | @types/react | 19.3.0 |
| apps/web | @types/react-dom | 19.3.0 |
| apps/web | tailwindcss | 4.3.3 |

## Tooling and checks

- @effect/tsgo supported setup completed. `prepare` patches TypeScript 7.
- VS Code workspace configuration uses the TypeScript 7 workspace SDK. The
  editor extension must be present for IDE diagnostics; CLI diagnostics work.
- Every backend TypeScript file is included, including files without `src/`.
- Requested correctness diagnostics remain errors. No standalone tsgo installed.
- `npm run check:effect`: 28/28 files, zero errors/warnings/messages.
- `npm run check:boundaries`: passed. Process barrel imports are now checked;
  raw backend fetch is allowed only at the documented platform edge.
- `npm run lint`: passed. Next-generated next-env.d.ts and .next are excluded
  from Biome; application code is checked.
- `npm test`: 2 files, 4 tests passed, including real socket HTTP status and 404.
  vitest.config.ts excludes vendored repos/** from application test discovery.
- `npm run typecheck`: both workspaces passed.
- `npm run build`: backend typecheck and Next.js production build passed.
- `npm run check`: the complete combined command passed.

## Backend and UI

The running backend returned HTTP 200 and `{"status":"IDLE"}` from
`GET /api/status`. Both development and production Next.js server responses
contained the BioJev heading and `Status: IDLE` obtained from the real backend.
The page is dynamic, uses no-store, and fails when retrieval or validation fails;
there is no fallback IDLE or simulated activity. Backend listening defaults to
127.0.0.1:3001; the UI defaults to port 3000.

NodeRuntime.runMain owns the outer Layer.launch. Node createServer is isolated
in platform/HttpLive.ts as required by the Effect Node server constructor.
Effect owns HTTP handling and scoped cleanup. No separate execution subsystem,
agent behavior, SQL schema, isolation, Jev transport, or mission loop was added.

## Compatibility and unstable surfaces

Installed portable services and Node providers were inspected for FileSystem,
Path, HttpClient, ChildProcess, ChildProcessSpawner, NodeServices, and SQLite.
NodeServices includes process/filesystem/path support; HttpClient needs its own
provider. ExecutionEnv remains the broad controlled computation boundary, with
its production implementation deferred.

The only unstable Effect exports allowed are:
- effect/http/HttpRouter#add: http/status.ts.
- effect/http/HttpServerResponse#json: http/status.ts.
- effect/http/HttpRouter#serve: main.ts and test/status.test.ts.
- effect/http/HttpClient#HttpClient: test/status.test.ts.

Allowlisting is scoped to exact files and exports. The installed source and
specs/guides/EFFECT.md document these surfaces. Other unstable/experimental
uses remain errors. Compatibility edits changed Config.string/port to
Config.String/Port and multi-value Schema.Literal to Schema.Literals arrays.

Pi Durable 1.0.2 README and harness/scheduler source confirm: cancelling a wait
leaves durable work running; conversation.abort resolves at idle;
waitForIdle is explicit; detached background work survives normal abort.
The contract is recorded in specs/architecture/PI_COMPATIBILITY.md. Pi imports
remain restricted to agent-runtime, and Pi/BioLab databases remain separate.
No adapter, tools, subagents, or timeout implementation was introduced.

## Reference source and skill

Source subtrees were installed after explicit follow-up authorization:
`repos/effect` at 073bb475d, `repos/pi` at 2e63fcdfbf, and `repos/typesafe` at
66880ccded, all from upstream main using `git subtree add --squash`.
Update commands are in repos/README.md. No nested clones or production imports
from repos were created.

Only effect-ts was installed locally for Codex at
.agents/skills/effect-ts/SKILL.md, using the skills CLI's scoped install options.
Global and unrelated skills were left unchanged. Its generic prerelease advice
was not used to replace the user's verified stable dependency requirement.

## Smallest next task

Implement the first BioLab lifecycle slice: a SQLite migration and authorized
Mission creation/read operation, with restart persistence verified. Keep Pi
runtime storage separate. Follow Task 2 of specs/IMPLEMENTATION_PLAN.md.

## Final tree

Generated build output, node_modules, Git internals, Windows Zone.Identifier
metadata, and vendored internals are excluded below. All 54 Windows
Zone.Identifier files were removed; new metadata files remain ignored.

```text
.agents/skills/effect-ts/SKILL.md
.gitignore
.npmrc
.vscode/settings.json
AGENTS.md
CODEX_INSTALL_PROMPT.md
MANUAL_SETUP.md
README.md
apps/biojev/agent-runtime/AgentRuntime.ts
apps/biojev/agent-runtime/PiAgentRuntime.ts
apps/biojev/agents/contracts.ts
apps/biojev/agents/director.ts
apps/biojev/agents/researcher.ts
apps/biojev/agents/tools/director-tools.ts
apps/biojev/agents/tools/researcher-tools.ts
apps/biojev/agents/tools/validator-tools.ts
apps/biojev/agents/validator.ts
apps/biojev/biolab/BioLab.ts
apps/biojev/biolab/README.md
apps/biojev/biolab/SqliteLive.ts
apps/biojev/biolab/model/Domain.ts
apps/biojev/config/config.ts
apps/biojev/core/mission.ts
apps/biojev/core/next-action.ts
apps/biojev/core/recovery.ts
apps/biojev/core/research-block.ts
apps/biojev/core/validation-cycle.ts
apps/biojev/execution-env/ExecutionEnv.ts
apps/biojev/execution-env/Live.ts
apps/biojev/http/README.md
apps/biojev/http/status.ts
apps/biojev/jevengine/JevEngine.ts
apps/biojev/jevengine/TypeSafeLive.ts
apps/biojev/main.ts
apps/biojev/package.json
apps/biojev/platform/HttpLive.ts
apps/biojev/platform/NodeLive.ts
apps/biojev/test/next-action.test.ts
apps/biojev/test/status.test.ts
apps/biojev/tsconfig.json
apps/web/.gitignore
apps/web/README.md
apps/web/app/favicon.ico
apps/web/app/globals.css
apps/web/app/layout.tsx
apps/web/app/page.tsx
apps/web/next-env.d.ts
apps/web/next.config.ts
apps/web/package.json
apps/web/postcss.config.mjs
apps/web/tsconfig.json
biome.json
data/.gitkeep
data/artifacts/.gitkeep
data/work/.gitkeep
package-lock.json
package.json
repos/README.md
repos/effect/ (squashed subtree; internals omitted)
repos/pi/ (squashed subtree; internals omitted)
repos/typesafe/ (squashed subtree; internals omitted)
skills-lock.json
specs/BOOTSTRAP_REPORT.md
specs/IMPLEMENTATION_PLAN.md
specs/architecture/AGENT_ROLES.md
specs/architecture/AUTHORITY.md
specs/architecture/BIOLAB.md
specs/architecture/EXECUTION_ENV.md
specs/architecture/JEVENGINE.md
specs/architecture/PI_COMPATIBILITY.md
specs/architecture/README.md
specs/guides/EFFECT.md
specs/guides/FEEDBACK_LOOP.md
specs/guides/REPOSITORY.md
tooling/check-boundaries.mjs
tsconfig.base.json
vitest.config.ts
```
