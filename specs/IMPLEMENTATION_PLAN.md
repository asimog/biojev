# BioJev implementation plan

This plan implements the simplified architecture:

```text
core
  controls what can legally run next

agents
  Director / Researcher / Validator

BioLab
  canonical memory + capability history

JevEngine
  semantic measurement

AgentRuntime
  Pi Durable cognition

ExecutionEnv
  controlled broad computation
```

Execution is provided by ExecutionEnv; no separate execution subsystem exists.

Each task is a separate implementation slice. Verify repository truth before each task.

## Task 1 — Repository and feedback-loop bootstrap

Install exact compatible versions of:
- Effect v4
- @effect/platform-node
- @effect/sql-sqlite-node
- @effect/vitest
- @effect/tsgo
- TypeScript supported by tsgo
- Vitest
- Biome
- Pi Durable / pi-ai / chord
- TypeSafe SDK

Run `@effect/tsgo setup`.

Generate Next.js under `apps/web` with no `src/` directory.

Implement one real backend status endpoint and UI display.

Add read-only source subtrees after a clean commit:
- Effect
- Pi
- TypeSafe

Acceptance:
- `npm run check:fast`
- architecture boundary checker passes
- backend starts
- UI displays real IDLE state
- no fake agent activity
- no raw Node I/O introduced into application code

## Task 2 — BioLab lifecycle nucleus

Implement Effect Schema models and SQLite-backed BioLab operations for:
- Mission / MissionRevision
- AgentRun
- DirectorDecision
- ResearchObjective
- ResearchBlock
- ValidationCycle
- ConfigurationSnapshot if required

Use Effect SQL and `@effect/sql-sqlite-node`.

BioLab is one high-level Service with domain operations. Internal SQL helpers may exist but must not become agent-visible services.

Acceptance:
- deterministic migrations
- restart preserves canonical state
- agents/core cannot import raw SQL
- no generic `save/update/query` API

## Task 3 — Core lifecycle

Implement pure `nextAction` and Effect `runMission`.

Core only asks:

> What is legally allowed to run next?

Prove:
- human pause -> WAIT
- recovery precedes new work
- validation barrier precedes a new ResearchBlock
- completed ValidationReport forces Director review
- objective ready -> ResearchBlock
- no scientific method/pipeline logic exists in Core

## Task 4 — ExecutionEnv foundation

Implement `ExecutionEnv` using Effect portable services.

Use:
- FileSystem
- Path
- HttpClient
- ChildProcess / ChildProcessSpawner
- Scope
- Stream
- Config
- Node platform Layers

Provide controlled:
- read
- write
- edit
- process execution
- HTTP/network request

Do not build language-specific public APIs.

Acceptance:
- no raw `node:fs`
- no raw `node:path`
- no raw `node:child_process`
- no raw backend `fetch`
- working directory is isolated
- canonical DBs/secrets are not exposed
- process cleanup works on interruption

## Task 5 — ScientificResult attribution path

Implement execution/source receipts and BioLab ScientificResult recording.

Flow:

```text
Pi agent tool
  -> ExecutionEnv
  -> attributable receipt/artifacts
  -> authorized BioLab recording path
  -> ScientificResult
```

ScientificResult must not be creatable merely because JSON matches the schema.

Acceptance:
- result points to real execution/source provenance
- missingness preserved explicitly
- null/negative/contradictory results can be stored
- old ScientificResults remain immutable

## Task 6 — AgentRuntime Pi adapter

Implement `AgentRuntime` with the exact installed Pi Durable API.

Support:
- mission-persistent Director conversation
- fresh Researcher conversation
- fresh Validator conversation
- submit/wait
- abort
- resume/reopen where supported
- usage
- live watch/view

No subagent API.

Pi imports remain only in `agent-runtime/**`.

Acceptance:
- Pi runtime DB separate from BioLab DB
- losing Pi runtime does not erase canonical BioLab history
- adapter exposes no Pi types outside module

## Task 7 — Director

Implement Director as persistent strategic cognition.

Director must execute this learning loop:

```text
Observe
-> Retrieve
-> Assess
-> Learn
-> Decide
```

Director receives a compact typed input, then autonomously searches BioLab.

Director must be able to:
- inspect prior ResearchDossiers;
- inspect ScientificResults;
- record ResultAssessments;
- record Interpretations;
- revise Hypotheses;
- inspect capability history;
- record CapabilityAssessments;
- register/update CapabilityVersions when justified;
- activate qualified CapabilityVersions;
- react to ValidationReports;
- create the next ResearchObjective.

Director may use ExecutionEnv when useful, but it does not become the Researcher for the block.

No hard-coded interestingness formula, frontier algorithm, modality sequence, or Jev threshold.

Acceptance:
- Director decision cites basis refs
- pending ValidationReport is mandatory basis
- Director can widen capability space through BioLab
- next output is one ResearchObjective
- BioLab remains authoritative memory if Director transcript is lost

## Task 8 — ResearchBlock and Researcher

Implement the deep ResearchBlock lifecycle.

One block means:
- one ResearchObjective
- one fresh Researcher conversation
- one controlled ExecutionEnv
- approximate v0 10-minute wall-time limit
- BioLab/Jev/ExecutionEnv tools
- no subagents
- terminal status
- ResearchDossier

Researcher owns local scientific method.

Possible execution can include:
- BioLab memory search
- public sources
- Python
- R
- Rust
- git
- CLI tools
- Jev
- literature
- capability discovery/building

No prescribed sequence.

Timeout must:
1. abort Pi work;
2. wait for Pi terminal/idle state as supported;
3. terminate/clean ExecutionEnv work;
4. finalize TIMED_OUT.

## Task 9 — Institutional learning records

Implement BioLab paths for:
- ScientificResult
- Interpretation
- Hypothesis
- HypothesisRevision
- ResultAssessment
- Failure
- Uncertainty
- ResearchDossier

Prove:
- interpretation can change without mutating old ScientificResult
- hypothesis history is append/revision based
- negative and contradictory history remains available
- fresh Researcher can retrieve prior work through BioLab

## Task 10 — JevEngine

Implement TypeSafe-backed JevEngine.

Own:
- question identity/version
- primitive
- subject refs
- projection identity/version
- rendered input hash
- model/provider parameters
- result
- probability/confidence where native
- receipt

Persist important SemanticMeasurements through BioLab.

Rule:
- Search finds possibilities.
- Jev measures semantics.
- Agent decides.

No auto-selection threshold.

## Task 11 — Capability evolution

Implement BioLab capability records:
- Capability
- CapabilityVersion
- CapabilityAssessment
- qualification state/metadata as required
- active/default version state

Researcher may:
- search capabilities
- discover/build a new version
- test it in ExecutionEnv
- register it
- record assessment

Director may:
- inspect capability history
- assess performance across blocks
- request new capability development
- register/update capability metadata where justified
- activate/rollback a qualified version

Validator may assess but not activate.

Execution remains through ExecutionEnv.

## Task 12 — Validator

Implement exact ten-block validation cadence.

Validator:
- fresh Pi conversation
- fresh ExecutionEnv
- exact ten-block trajectory
- BioLab access
- Jev access
- independent reproduction

Output:
- ValidationReport

Hard lifecycle proof:

```text
ResearchBlock 10
-> Validator
-> ValidationReport persisted in BioLab
-> Director receives/reviews report
-> DirectorDecision cites report
-> ResearchBlock 11
```

## Task 13 — Continuous mission

Connect:

```text
Director
-> ResearchObjective
-> fresh Researcher block
-> ResearchDossier
-> Director
-> ...
```

Every ten blocks insert Validator.

Continue until explicit human stop/pause.

Do not implement autonomous mission completion in v0.

## Task 14 — HTTP/SSE and UI

Expose real state.

Durable UI from BioLab:
- Mission
- DirectorDecisions
- ResearchObjectives
- ResearchBlocks
- ResearchDossiers
- ScientificResults
- Interpretations
- Hypotheses
- Failures
- Capabilities
- SemanticMeasurements
- ValidationReports

Live UI from Pi/runtime projections:
- run_started
- model_active
- tool_started
- tool_output
- tool_completed
- jev_started
- jev_completed
- canonical_record_created
- run_completed
- run_failed

No fake progress.
No hidden chain-of-thought.
Browser refresh must not affect research execution.

## Task 15 — Failure qualification

Kill/restart during:
- Director generation
- Researcher generation
- Validator generation
- Pi tool execution
- ExecutionEnv process
- HTTP request
- ScientificResult recording
- artifact handling
- Jev request
- shutdown

Prove:
- no fake ScientificResult
- no skipped Validator barrier
- no reused Researcher across new blocks
- no raw canonical mutation
- recovery preserves owner boundaries

## Task 16 — Coding-agent qualification

Give weaker coding agents realistic extensions.

Examples:
- add a new public source workflow
- add Rust use inside ExecutionEnv
- add a new capability version
- add a BioLab memory query
- add a Jev measurement

Desired behavior:
- agents compose BioLab / ExecutionEnv / JevEngine / AgentRuntime / Core
- agents do not invent a new execution subsystem
- agents do not reach for raw SQL, raw Pi, raw TypeSafe, or raw Node I/O

Repeated bypasses mean the abstraction or enforcement is insufficient.
