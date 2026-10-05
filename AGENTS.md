# BioJev agent instructions

Verify repository truth first: HEAD, code, config, tests, and installed versions.

Before changing authority, agent roles, persistence, or computation boundaries, read `specs/architecture/CONSTITUTION.md`. It is the authoritative design specification.

## Architecture

- `core` controls what is legally allowed to run next.
- `agents` decide what and how.
- BioLab is the sole canonical institutional memory and capability authority.
- JevEngine measures semantic questions.
- Pi Durable runs Director, Researcher, and Validator and alone owns cognition, durable tool tasks, cancellation, and ExecutionEnv.
- Pi-owned ExecutionEnv provides broad controlled computation; it is not an application peer.
- Next.js observes and sends explicit human commands.

Execution is provided by ExecutionEnv; no separate execution subsystem exists.

## Constitution

1. Director decides what to investigate.
2. Researcher decides how to investigate it.
3. Validator critiques; Director decides what follows.
4. Jev measures semantics; agents decide consequences.
5. BioLab is the sole institutional memory authority.
6. Pi owns runtime cognition, not scientific history.
7. ExecutionEnv provides computation, not research authority.
8. Valid schema shape does not confer creation authority.
9. ScientificResult is distinct from Interpretation.
10. Missing is not zero.
11. Negative and contradictory results remain history.
12. No fixed scientific choreography.
13. No domain-specific pipeline in Core.
14. No subagents.
15. Every new ResearchBlock gets a fresh Researcher.
16. Every ValidationCycle gets a fresh Validator.
17. Validation occurs after ten countable ResearchBlocks.
18. Effect manages application mechanics; Pi manages agents.
19. UI state and SSE events are not canonical scientific state.
20. Strong institutional boundaries; weak scientific choreography.

Validator is required in v0. Only an explicit human stop ends a mission. Pause saves active research as an orphan block; resume continues the mission with new legal work. Cancelled/orphan blocks do not count toward validation. After ten countable research blocks, Validator gets its own block, then Director reviews before the next ten research blocks.

## Effect

### Learning more about Effect

This repository uses the Effect TypeScript library.

Before writing any Effect code, first read `node_modules/effect/AGENTS.md`
**completely**, and follow the links in the file when required.

For APIs and concepts the guide does not cover, inspect
`node_modules/effect/src` and relevant installed documentation/tests.
Use `repos/effect/LLMS.md` for additional reference. Installed source defines the
API contract; do not guess v3 APIs from memory.

Use:
- programs for behavior;
- Effect Services for genuine capabilities;
- Layers for concrete implementations;
- Schema for boundary/canonical validation;
- typed errors;
- Scope for resource lifetimes;
- Config for process configuration;
- portable Effect platform services before raw Node I/O.

Normal application code must not use raw `node:fs`, `node:path`, `node:child_process`, or raw backend `fetch`.

## Pi

Only `apps/biojev/platform/pi/**` may import Pi/Chord packages, including integration tests.

Use scoped Pi Harness resources and role programs. BioLab and JevEngine are the initial application Services. Pi alone owns ExecutionEnv, including environment selection, isolation, process lifetime, and cleanup. Effect manages Pi Harness resources and requests work/abort through Pi. No separate AgentRuntime Service, Effect ExecutionEnv Service, or execution subsystem is introduced.

Import only Pi Durable, Pi AI, and Chord from platform/pi. Read
the dependency decision in specs/architecture/PI_COMPATIBILITY.md before adding
other Pi packages. Package files live in npm-managed node_modules; platform/pi
contains only BioJev integration and its tests. Keep one root lockfile. Do not
vendor or clone Pi into repos/pi or copy upstream code into platform/pi.

Effect may acquire/release imported Pi resources. It must not reimplement Pi
conversations, model turns, task scheduling, resume, compaction, tools, or runtime
durability. Read the installed package README/types/source before
changing its integration.

Pi tool callbacks use Pi-owned ExecutionEnv for computation and authorized
BioLab operations for canonical writes. Tool availability does not confer
recording authority or establish host isolation.

ResearchBlock timeout must explicitly abort Pi-owned work before the block becomes TIMED_OUT.

## ExecutionEnv

ExecutionEnv is owned only by Pi and remains broad by design. It may support:
- read/write/edit files
- shell/process execution
- network requests
- Python
- R
- Rust
- CLI tools
- git
- temporary dependencies

Freedom exists inside the environment. Isolation exists outside it.

ExecutionEnv must not expose:
- BioLab SQLite directly
- Pi SQLite directly
- host secrets
- unrestricted host filesystem
- permanent institutional authority

## Research

Do not encode a fixed scientific workflow into deterministic code.

Director owns global strategy and cross-block learning.
Researcher owns local method.
Validator independently critiques.
Jev measures; agents decide.

## Feedback loop

Run `npm run check:fast` after small changes.
Run `npm run check` before completion.

Repeated agent mistakes should become, in order:
1. a better abstraction;
2. a type-level constraint;
3. a lint/boundary rule;
4. an invariant test;
5. only then a larger instruction.

Keep changes small. New requirement = new task.

## Genesis

Before changing initialization, discovery, or catalog refresh, read
`specs/architecture/GENESIS.md`. Supply a replaceable discovery program through
application composition. BioLab retains broad candidates; Jev annotates without
pruning; the existing Director chooses the initial objective. Genesis must
complete before ResearchBlock #1 and never counts toward validation. Source
identifiers and capabilities are data, never Core policy. Refresh preserves
completed Genesis.
