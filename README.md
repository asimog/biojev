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

The scaffold provides a real Effect backend `GET /api/status` returning IDLE,
a Next.js page reading that response, pure lifecycle policy, and domain
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
They are not yet composed into the status backend. The selected OpenRouter
routing is configured through imported Pi; TypeSafe semantic transport is
implemented and qualified against local HTTP fixtures. Production role/HTTP
wiring, canonical Jev recording/tools, capability learning, live history/UI and full process-crash
qualification remain unfinished. Validator is required for v0.

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
configuration and verification status. The status-only backend needs no model keys.
Tracked Effect and TypeSafe reference subtrees live under repos/; production
code never imports them. Pi is imported only from installed npm packages; its
former source subtree has been removed.

Genesis now gates the first investigation through a replaceable discovery
program, broad BioLab candidates, Jev measurement, and the existing inaugural
Director. Refresh preserves completed initialization. See
[Genesis](specs/architecture/GENESIS.md) and the
[v0 implementation plan](specs/IMPLEMENTATION_PLAN.md) for scope and qualification.
External catalog ingestion and production mission command/UI composition remain
pending; the backend still serves its real status path.
