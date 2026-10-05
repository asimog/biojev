# Pi cognition integration interface

Pi owns conversations, model turns, durable tools, agent configuration,
working-directory configuration, compaction, resume, usage, abort, and
ExecutionEnv ownership, isolation, and cleanup. BioJev specifies role authority, institutional lifecycle,
validation cadence, required isolation constraints, and canonical recording.
Effect manages Pi Harness lifetime; ExecutionEnv is never an Effect-owned peer.

Ownership here describes the target architecture, not a claim that upstream
Pi provides host isolation automatically. The Linux adapter and cleanup are now
qualified inside the Pi integration and bound to the role programs. Production
composition connects those programs to the owned scheduler and HTTP interfaces.

The seam exposes role configuration and handoffs without propagating Pi types
into domain modules. Acquire Harness as a scoped infrastructure resource.
Do not wrap it in a speculative second agent runtime or duplicate its durability.

## Installed integration

`apps/biojev/platform/pi/harness.ts` acquires Pi's SQLite storage and Harness
inside an Effect Scope. The caller supplies the Pi database path and model
catalog; provider credentials and role configuration are not selected implicitly.
Acquisition failures use PiResourceError. Storage is released if Harness opening
fails, and Scope release closes Harness with a non-expired cleanup context.
Release failures remain visible as defects rather than being silently ignored.

Import upstream APIs directly inside apps/biojev/platform/pi:

| Need | Upstream import |
| --- | --- |
| Harness, registry, conversations, durable tools/tasks | @earendil-works/pi-durable |
| Pi runtime SQLite | @earendil-works/pi-durable/storage/sqlite/node |
| Read/write/edit/bash tools | @earendil-works/pi-durable/tools |
| ExecutionEnv contract | @earendil-works/pi-durable/env |
| Models and providers | @earendil-works/pi-ai/models and provider entrypoints |
| Runtime cancellation contexts | @earendil-works/chord/context |

These packages are installed as backend npm dependencies with the root lockfile.
npm manages their files in node_modules. The platform folder owns integration,
not a copied implementation. Pi is not vendored under repos/pi. Additional Pi
CLI/UI/server packages are not prerequisites for this Durable integration.

Use only Pi Durable, Pi AI, and Chord. Durable already provides the coding tools
and durable model/tool loop. The platform integration imports these APIs rather
than implementing another agent loop or script VM.

The integration creates the built-in registry and registers CodingTools only
when trusted composition inside platform/pi supplies `HarnessOptions.env`. Without
that factory it offers no coding tools. The factory receives conversationId,
cwd, and a document reader, and is evaluated at each use. Supplying a factory
does not prove isolation; production enablement requires the ExecutionEnv
qualification in the implementation plan. No host Node environment, providers,
subagent extensions, or canonical recording tools are installed automatically.

Platform tests prove SQLite conversation identity survives close/reopen, new
conversation identities differ, released handles reject use, and coding tools
are absent without an environment. Deterministic Pi AI provider tests also prove
input → registered tool → answer, committed activity, usage, reopened request
identity, cancelled waiting versus explicit abort, and recovery without unsafe
tool replay. They use no paid provider or credentials. Trusted composition can
install explicit extensions and runtime settings alongside bundled coding tools.
The backend now acquires this resource after exclusive store ownership. The
[Linux ExecutionEnv](EXECUTION_ENV.md#qualified-linux-mechanism) has been qualified
with bundled tools, real programs, retained artifacts, cancellation, detached
descendant teardown, and host HTTP isolation. Role programs explicitly select
their own authorized extension, submit upstream input and terminate via the
upstream handoff tool control. Timeout and interruption bridge to explicit
abort, idle and environment cleanup before canonical settlement. Mission-loop
tests cover commands and the ten-block gate, including failed review attempts.
A committed live projection is connected to HTTP/SSE and the Next.js UI.
Production checks cover real model-turn recovery, retained Researcher results,
and active SIGTERM settlement before BioLab closes. No upstream cognition
or task machinery is copied.

## Production model routing

Director, Researcher, and Validator use the imported Pi AI OpenRouter provider.
`OPENROUTER_MODEL` selects the model (default `deepseek/deepseek-v4.1-flash`),
and `OPENROUTER_FALLBACK_MODEL` selects the ordered fallback (default
`openrouter/free`). The default identifiers were checked against the public
OpenRouter catalog and the pinned Pi catalog. See
[DeepSeek](https://openrouter.ai/deepseek/deepseek-v4.1-flash),
[model fallbacks](https://openrouter.ai/docs/guides/routing/model-fallbacks),
and the [free router](https://openrouter.ai/openrouter/free).

`platform/pi/models.ts` adds the ordered `models` array through the upstream
provider's payload hook for both stream entrypoints. OpenRouter performs routing
within that request; BioJev does not resubmit a conversation or replay tools to
implement fallback. Imported Pi retains tools, streaming, cancellation,
compaction, and cognition. Role acquisition uses this configured catalog and
model unless a test supplies an explicit catalog/model pair.

Effect Config supplies the model choices and backend-only `OPENROUTER_API_KEY`. Auth resolution
receives only that configured credential and no host-file lookup. Harness
acquisition for the status backend can run without a key; production role
acquisition requires it. Credentials never enter role context or ExecutionEnv.
The free router still requires OpenRouter authentication. Routing depends on
available models and their tool/context support; fallback cannot guarantee
that every request succeeds or fits the selected free model.

Pi preserves the requested model and the actual routed `responseModel`.
Observation must retain that distinction. Its usage cost is calculated from
the requested catalog model and is an estimate, not verified billing after
routing. Tests qualify the outgoing routing payload, retained tool definitions,
actual response identity, and cancellation through the imported adapter. Live
authenticated provider verification remains separate.

Jev calls the [TypeSafe API](JEVENGINE.md#typesafe-provider) directly through its
own SDK and credential. Pi's classifier endpoints are not the Jev integration.

On reopening, integration inspects public Pi state and admits abort marks for
all interrupted tasks before enabling scheduling. It then aborts/awaits each
affected conversation and settles the original institutional identity honestly.
Pending tools are never run to guess whether they completed. Missing runtime
state retains BioLab history and follows the same failed/orphan recovery policy.
This is institutional reconciliation using imported Pi cancellation, not a
replacement task scheduler. Process-crash qualification remains required.

## Dependency decision from installed source

| Package | Include? | Reason |
| --- | --- | --- |
| @earendil-works/pi-durable | Required | Harness, generation/tool/compaction tasks, storage, and bundled CodingTools |
| @earendil-works/pi-ai | Direct dependency for current integration | BioJev imports createModels and configures providers; Durable also depends on it |
| @earendil-works/chord | Direct dependency for current integration | BioJev imports cancellation contexts; Durable also depends on it |

Installing only pi-durable pulls Pi AI and Chord transitively. That is sufficient
for Durable's own implementation, but packages that BioJev imports directly
should be declared directly rather than depend on accidental npm hoisting.

Source evidence in the installed distribution:

- pi-durable/package.json declares Pi AI and Chord, with no separate agent-core dependency.
- pi-durable/dist/harness/registry.js installs GenerationTask, ToolTask, and CompactionTask.
- pi-durable/dist/harness/generation.js requests models and creates durable tool tasks.
- pi-durable/dist/harness/tool.js validates arguments, runs hooks, records intent, and invokes tools with the environment.
- pi-durable/dist/tools/index.js bundles read/write/edit/bash; bash.js calls env.exec.

These paths are under node_modules/@earendil-works. Recheck them after upgrades.
Durable's coding tools already let a model write programs and execute them
through its owned ExecutionEnv. An extra tool-composition VM is unnecessary for
this architecture and is not installed. Broad computation uses the same Pi
execution boundary, without another permanent runtime.

Do not add pi-agent-core or pi-coding-agent for these facilities: Durable already
owns the cognition/task implementation, and the coding-agent package is a CLI
with its own application/session setup. MCP, remote client/server/protocol, TUI,
telemetry, and eval packages are separate features, not prerequisites for this
platform integration.

## Agent Core versus Durable

The linked [packages/agent](https://github.com/earendil-works/pi/tree/main/packages/agent)
publishes pi-agent-core. Its [Agent source](https://github.com/earendil-works/pi/blob/main/packages/agent/src/agent.ts)
keeps message state and steering/follow-up queues in the Agent instance. It
provides model/tool execution, hooks, events, abort, and idle settlement.
It is a viable choice for an in-process agent, but does not supply Durable's
stored conversations and resumable tool-task mechanism.

[Durable](https://github.com/earendil-works/pi/blob/main/packages/durable/README.md)
commits conversation/runtime state to storage and supports resume. Its installed
registry includes generation, tool, and compaction tasks; its package manifest
depends on Pi AI and Chord, not pi-agent-core. These are alternative cognition
implementations, not a requirement to instantiate Agent inside Harness.

BioJev currently requires Pi-owned runtime persistence/recovery and already
imports Durable's storage and environment seam. Retain Durable for that reason,
not because Agent Core cannot run the three roles. Switching to Agent Core would
require revisiting runtime persistence/recovery rather than quietly rebuilding
those facilities in Effect. Adding both would require an explicit justification
for a second runtime. Upstream labels Durable experimental, so the plan starts
with qualification of the exactly pinned installed APIs. Upstream main is
reference evidence, not the installed API contract.

## Lifetime and persistence

Director retains a mission-persistent conversation when runtime state is available. A new ResearchBlock starts
with a fresh Researcher; a resumed unfinished block retains its identity.
Validator is fresh for each ValidationCycle. Exactly three cognitive roles exist.

One process owns a Pi store at a time; upstream provides no cross-process
ownership lock. Application startup must establish ownership before opening it.
Runtime and institutional stores remain separate. Their paths are defined in
apps/biojev/config/config.ts. Domain code does not inspect Pi internal tables;
Pi tools do not expose raw canonical writes. Losing Pi state reduces exact
resumability but does not erase completed institutional records.

## Verified cancellation semantics

The installed README and harness/scheduler source confirm:
- cancelling submission.wait cancels the wait, not durable work;
- conversation.abort withdraws queued inputs, aborts current owned work, and resolves at idle;
- conversation.waitForIdle explicitly waits for idle;
- detached background tasks survive normal abort; an explicit background option includes them.

Harness.close suspends the scheduler and leaves interrupted durable work pending
for recovery. Closing a Scope does not fulfill ResearchBlock abort obligations.
Use a non-expired cleanup context. BioJev does not introduce detached autonomous
work or subagents. Check semantics against installed source before implementation
or upgrade. Manifests and the lockfile define installed versions.

[Workflows](../workflows/README.md) owns timeout and recovery sequencing.
The [repository guide](../guides/REPOSITORY.md) owns Pi import locations.

Genesis invokes this existing persistent Director after BioLab retains a
sufficient map. It creates no Pi role, conversation implementation, environment
owner, or extra package. The initialization completeness report enters the
Director context, and search_discovery exposes retained possibilities.
