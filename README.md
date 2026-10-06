# BioJev

BioJev is an autonomous computational biology research institution. Director
chooses investigations, Researcher chooses methods, and Validator independently
critiques every ten countable blocks. Jev measures semantics; BioLab retains
canonical institutional history. No subagents.

The [constitution](specs/architecture/CONSTITUTION.md) defines authority and
invariants. [Architecture](specs/architecture/README.md),
[glossary](GLOSSARY.md), and [implementation plan](specs/IMPLEMENTATION_PLAN.md)
provide the design vocabulary and next implementation slices.

Effect manages application mechanics. Pi Durable runs Director, Researcher, and
Validator and alone owns ExecutionEnv, cognition, and tool-task durability.
Pi tools use that environment for controlled broad computation.
BioLab and Pi use separate SQLite databases. The UI observes real runtime
activity and institutional history and sends explicit human commands.

## Current implementation

The application provides a real Effect backend `GET /api/status`,
mission command/history/SSE endpoints, a Next.js mission UI, pure lifecycle policy, and domain
contracts, migrated BioLab mission/revision storage, and scoped imported Pi
SQLite/Harness resources. Startup locks both stores before opening them.
Deterministic runtime tests cover model/tool execution, abort versus cancelled
wait, input deduplication, and interrupted unsafe-tool recovery. All Pi integration
lives in platform/pi;
Pi package files are npm-managed dependencies, not copied source.
The Pi-owned Linux environment now runs imported bundled tools and real programs
with filesystem/network isolation, operation receipts, selected retained artifacts,
and cancellation/descendant cleanup tests.
Authorized BioLab tools now retain real receipts, results, interpretations,
hypothesis revisions, assessments, failures, uncertainties, and artifacts. Tests
verify authority rejection, reopening, and artifact reuse by a fresh role.
Role programs now run a persistent Director, fresh Researcher and fresh Validator
through imported Pi, with canonical handoffs, timeout/pause cleanup and the exact
ten-block review barrier. The command-driven mission loop and conservative
restart reconciliation are tested with real stores and deterministic models.
Production composition now connects those role programs and the scheduler to HTTP.
The selected OpenRouter
routing is configured through imported Pi; TypeSafe semantic transport is
implemented and qualified against local HTTP fixtures. Production role/HTTP
wiring is implemented. Canonical Jev/capability tools and activity projections are
present. Imported-Pi tests qualify capability reuse in fresh Researcher/Validator
environments and Director selection/rollback. Production checks qualify cognitive
crash recovery, interrupted Researcher recovery with unchanged results, and active
SIGTERM settlement before SQLite release. Populated desktop/mobile observation,
reload, outage and restart checks pass. Local Linux v0 is qualified with a
deterministic complete trajectory and configured-provider checks. A real-provider
ten-block window, fresh Validator and Director review have also completed; the
[live report](specs/LIVE_RUN_REPORT.md) records timings and research-quality
limitations. Validator is required for v0.

Speculative runtime/execution Services, role/tool factories, and comment-only
implementation files were removed. Implementation directories are created when
needed. Pi integration is confined to platform/pi/**; its controlled
computation remains internal to Pi under platform/pi/execution-env/**; it is
not an independently owned application subsystem.

## Run and verify

Run `npm ci` from the root. In separate terminals run `npm run dev:backend` and
`npm run dev:web`, then open http://localhost:3000. The backend defaults to
http://127.0.0.1:3001. Backend listening uses BIOJEV_HOST/BIOJEV_PORT;
BIOJEV_BACKEND_URL selects the UI's backend origin.

Use `npm run check:fast` during edits and `npm run check` before completion.
Installed dependencies and editor requirements live in manifests, lockfile, and
.vscode configuration.
Backend provider credentials and model choices belong in ignored root `.env.local`; `.env.example` lists
the names. [Pi routing](specs/architecture/PI_COMPATIBILITY.md#production-model-routing)
and [Jev transport](specs/architecture/JEVENGINE.md#typesafe-provider) own provider
configuration and verification status. Observation works without model keys;
start/resume/revision execution requires both configured providers. The deployment
is local and single-operator: both servers bind loopback. The browser sends commands
through a same-origin, bounded JSON proxy; backend credentials stay server-side.
Tracked Effect and TypeSafe reference subtrees live under repos/; production
code never imports them. Pi is imported only from installed npm packages; its
former source subtree has been removed.

Genesis is the existing Director’s open-ended initialization turn (block 0,
outside validation countability). Director chooses sources, retrieves snapshots,
updates BioLab, measures semantics and chooses the inaugural objective. No
catalog file or source-specific discovery loop is required. Refresh preserves
completed initialization. During each Researcher block, Director side work uses
its own Pi environment to reassess results, generate hypotheses and discover or
verify tools; it cannot replace the active objective or bypass Validator review.

Pi Durable, Pi AI and Chord are pinned to 1.0.4. The isolated adapter supports
bounded transfers up to 100 MB per asset or repository archive. Extracted
repository aggregate size remains outside that per-asset limit. Optional
[TypeSafe cookbook patterns](specs/guides/JEV_COOKBOOKS.md) are available through
general semantic tools, native batches and deterministic semantic feature columns.
See [Genesis](specs/architecture/GENESIS.md) and the
[v0 implementation plan](specs/IMPLEMENTATION_PLAN.md) for qualification evidence.
