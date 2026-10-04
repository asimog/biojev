# BioJev agent instructions

Verify repository truth first: HEAD, code, config, tests, and installed versions.

## Architecture

- `core` controls what is legally allowed to run next.
- `agents` decide what and how.
- BioLab is the sole canonical institutional memory and capability authority.
- JevEngine measures semantic questions.
- AgentRuntime runs cognition through Pi Durable.
- ExecutionEnv provides broad computation inside a controlled environment.
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

## Effect

For unfamiliar Effect work:
1. read installed `node_modules/effect/AGENTS.md` if present;
2. read `repos/effect/LLMS.md` if vendored;
3. inspect relevant Effect source/tests;
4. do not guess v3 APIs from memory.

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

Only `apps/biojev/agent-runtime/**` may import Pi/Chord packages.

Do not rebuild Pi conversation/task durability in Effect.

ResearchBlock timeout must explicitly abort Pi-owned work before the block becomes TIMED_OUT.

## ExecutionEnv

ExecutionEnv is broad by design. It may support:
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
