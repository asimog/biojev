# BioJev implementation specification and plan

## Current expansion

The latest scope replaces production catalog initialization with open-ended
Director-led Genesis (block 0, excluded from validation), adds Director side work
during each Researcher block, upgrades Pi Durable/Pi AI/Chord to 1.0.4 and adds
bounded large-file transfer up to 100 MB per asset or repository archive.
Native Jev batches and structured questions support the optional cookbook patterns
in [Jev recipes](guides/JEV_COOKBOOKS.md). No deterministic scientific loop is added.
Earlier qualification below describes the preceding serial/catalog implementation;
the changed paths now pass automated regression qualification. `npm run check`
passes Effect diagnostics, boundaries, lint, typechecking, 72 tests across 18 files,
and backend/Next.js builds. The tests include 24 imported Pi environment
conformance cases, a 100 MB artifact round trip, Director-led Genesis and
concurrent Director side work, and 25 ResearchBlocks with two validation/review
barriers. Live-provider qualification of these changed paths remains outstanding;
the earlier live run does not qualify the concurrent implementation.

## Problem Statement

BioJev must turn a human mission into ongoing bioinformatics and computation
with inspectable results and independent review. The verified scaffold and
completed slices below establish the starting point. Autonomous investigation,
canonical research retention, isolated computation, trajectory validation, and
mission recovery are not complete until their acceptance checks pass.

The specifications describe those obligations, but an implementer needs one
ordered plan that distinguishes working behavior from required behavior and
identifies what must pass before the next slice can run.

## Solution

Build a source agnostic bioinformatics and computation pipeline through small,
working application paths. The institutional path connects a mission, replaceable Genesis initialization, Director
objective, fresh Researcher, attributable results and dossier, and subsequent
Director decision. After ten countable ResearchBlocks, a fresh Validator runs
its own block and Director reviews its report before research continues.

Agents choose sources, formats, representations, methods, programs, and action
order. No settled scientific domain, complete ontology, universal payload
schema, predetermined source catalog, or bespoke adapter per source is required.
A sufficient initial searchable map is required, but its discovery program and
source choices are replaceable under the Genesis contract. Add schemas
and records when an implemented path needs them. Core enforces legal lifecycle;
BioLab owns retained history; imported Pi owns cognition and ExecutionEnv.

The [constitution](architecture/CONSTITUTION.md) governs authority. The
[workflows](workflows/README.md) govern sequencing and failure semantics. This
plan orders engineering work, not scientific steps, and does not replace those
specifications.

## User Stories

1. As a human operator, I want to supply a mission, so that BioJev investigates my research direction.
2. As a human operator, I want a mission to continue until I stop it, so that model judgments about completion do not end my investigation.
3. As a human operator, I want to pause active research while preserving available work as orphan history, so that interruption does not erase what happened.
4. As a human operator, I want to resume a paused mission with new legal work, so that orphan blocks and their old deadlines are not restarted.
5. As a human operator, I want mission revisions retained, so that later decisions remain attributable to the direction in force.
6. As a human operator, I want stop to prevent new work and clean running computation, so that ending a mission leaves no unowned processes.
7. As a human operator, I want real activity and retained history displayed separately, so that transient tool output is not mistaken for institutional truth.
8. As a human operator, I want browser refresh or disconnection to leave research running, so that observing the institution does not control its lifetime.
9. As a human operator, I want failures, missing values, negative results, and contradictions retained, so that the history does not exaggerate success.
10. As a Director, I want a mission-persistent conversation and searchable BioLab history, so that I can learn across investigations.
11. As a Director, I want to select the next ResearchObjective, so that strategic authority stays with one role.
12. As a Director, I want to explain the basis for an objective without prescribing a procedure, so that Researcher retains local scientific freedom.
13. As a Director, I want to review each required ValidationReport before authorizing further research, so that independent criticism changes my context.
14. As a Director, I want to assess capabilities and select qualified defaults, so that reusable ability improves without losing version history.
15. As a Researcher, I want a fresh conversation for each new ResearchBlock, so that prior model transcripts do not silently carry into a new investigation.
16. As a Researcher, I want to retrieve retained results, failures, and uncertainties, so that long-term learning comes through BioLab.
17. As a Researcher, I want to choose and change my method, so that unexpected findings can redirect local investigation.
18. As a Researcher, I want to retrieve public data, repositories, and provided inputs, so that research is not limited to predefined sources.
19. As a Researcher, I want to write and run programs and install temporary dependencies, so that new computational methods need no permanent BioJev engine.
20. As a Researcher, I want parallel computation within my owned environment, so that exploring alternatives does not require subagents.
21. As a Researcher, I want to record results backed by real operations and durable artifacts, so that others can inspect what was obtained.
22. As a Researcher, I want interpretation and hypothesis revisions separate from immutable results, so that new reasoning does not rewrite history.
23. As a Researcher, I want to submit a dossier, including explicit no-results outcomes, so that Director receives an honest synthesis of the block.
24. As a Researcher, I want optional Jev measurements with explicit uncertainty, so that semantic judgment informs rather than dictates my decisions.
25. As a Researcher, I want to discover and reuse capabilities without registering every action, so that institutional learning does not restrict ad hoc computation.
26. As a Validator, I want the exact ten countable ResearchBlocks and their records, so that I critique a defined trajectory.
27. As a Validator, I want a fresh conversation and separate clean environment, so that my review is independent of the Researcher runtime.
28. As a Validator, I want to rerun computations, retrieve data, and try alternatives, so that criticism can be grounded in actual checks.
29. As a Validator, I want to retain a report and reproduction results, so that Director can inspect my findings without transferring strategic authority to me.
30. As a human operator, I want validation and review gates to survive failures and restart, so that block eleven cannot bypass required review.
31. As a human operator, I want orphan and Validator blocks excluded from the research count, so that each review follows exactly ten countable investigations.
32. As a human operator, I want deadlines to abort Pi work and await environment cleanup, so that TIMED_OUT describes settled work.
33. As a human operator, I want recovery to reconcile unfinished work without repeating completed external actions blindly, so that a restart does not fabricate or duplicate research.
34. As a human operator, I want retained research to survive loss of Pi runtime state, so that runtime resumability is separate from institutional memory.
35. As a maintainer, I want Pi behavior imported through its existing integration seam, so that BioJev does not maintain another cognitive runtime.
36. As a maintainer, I want canonical writes to check trusted actor identity and provenance, so that valid JSON cannot impersonate another role.
37. As a maintainer, I want execution unable to reach canonical databases or host secrets, so that scientific freedom stays within controlled computation.
38. As a maintainer, I want one scheduler owner and transactional lifecycle changes, so that concurrent processes cannot admit duplicate investigations.
39. As a maintainer, I want new sources, formats, and programs to use existing computation and recording interfaces, so that extending research does not change Core.
40. As a maintainer, I want deterministic integration checks and strict editor/CI feedback, so that runtime and authority failures are found without paid model calls in every test run.

## Implementation Decisions

### Verified starting point

| Area | Working now | Qualification |
| --- | --- | --- |
| Observation | Mission command/history/SSE HTTP routes and Next.js command/observation UI; dynamic scheduler status | Populated desktop/mobile browser, reload, outage and restart checks pass; block inspector shows the latest 50 blocks, retained history is paginated |
| Core | Legal-action policy, composed continuous scheduler, and HTTP commands exercised through imported Pi | SIGKILL/reopen, missing runtime state and active SIGTERM checks pass |
| BioLab | Migrated mission/revision, science, Genesis and lifecycle storage; immutable authorized records, discovery/Refresh, semantic/capability recording, validation/review gates, receipts/artifacts and memory reads | Fresh Researcher/Validator reuse, Director selection/rollback and immutable crash recovery pass |
| Pi | Imported scoped Harness and role programs; persistent Director, fresh Researcher/Validator, explicit abort/idle/cleanup and conservative restart reconciliation; qualified OpenRouter routing | Real OpenRouter calls, committed model/tool/usage projection and composed HTTP scheduling verified |
| Computation | Imported Pi files/shell inside Linux isolation; real role binding; trusted receipts and content-hash artifacts; explicit descendant/workspace cleanup | Configured Linux computation produces retained results; interrupted-run recovery preserves them |
| Jev | Imported TypeSafe SDK over Effect HTTP; versioned questions/projections, native response validation/cancellation, authorized retention, role tools and Genesis discovery | Real TypeSafe Genesis measurement and deterministic native transport checks pass |
| Startup | Exclusive advisory ownership of both stores before backend storage/Harness acquisition; composed continuous scheduler | Same-store reopen and active shutdown settle before SQLite release |
| Feedback | Strict typecheck, Effect diagnostics, boundaries, lint, behavioral tests, and workspace builds | Full feedback passes without weakened diagnostics |

### Previous v0 qualification and current expansion

| Slice | State | Evidence / remaining work |
| --- | --- | --- |
| 1 | Qualified model/tool path | Persistent input/tool/answer, reopened input deduplication, wait cancellation versus abort, and no unsafe-tool replay on reopen |
| 2 | Mission storage and ownership implemented | SQLite reopen/revision/concurrency tests; competing owner and database alias rejection; real backend IDLE and successful store/lock reopening after SIGKILL |
| 3 | Controlled computation qualified | Actual Python/JSON and public HTTPS retrieval; bundled Pi write/bash; host database/symlink and HTTP denial; abort/namespace teardown; artifact retention/restoration/integrity |
| 4 | Recording path qualified | Forged capability/role/run and unrelated receipt rejection; immutable/revision checks; real Pi tools → retained result/interpretation → reopen → fresh Validator artifact reuse |
| G | Director-led Genesis implemented | Existing Director performs open-ended discovery and authorized BioLab updates; real artifact/Jev/inaugural handoff integration passes; no prescribed catalog-ingestion program |
| 5 | Role/block path qualified | Actual Python and shell outputs, honest no-results dossiers, persistent Director/fresh Researcher, explicit Pi timeout abort, cancellation/orphans, and fresh work after pause |
| 6 | Validation/review gate qualified | Exact ten-block window through actual Pi roles; failed Validator and Director attempts preserve gates; fresh Validator retry; explicit reviewed report before block eleven; canonical gate survives SQLite reopen |
| 7 | Qualified | Actual HTTP start/pause/resume/revision/stop drives imported Pi and real BioLab; acknowledgements await cleanup. SSE disconnect leaves cognition running. Reopen preserves orphan identity without unsafe replay, including absent Pi state. Production SIGKILL/reopen and active SIGTERM checks pass; provider smoke remains separate from deterministic trajectory qualification |
| 8 | Transport and capability reuse path qualified | Actual Pi tools retain two qualified versions; reopened BioLab supplies an implementation to a fresh Validator environment; Validator activation is denied; Director selection, rollback and clearing preserve history. Fresh Researcher and Validator reuse are qualified |
| 9 | Qualified | Cursor-based append-only history, actual committed tool activity and requested/reported model identity; populated desktop/mobile, reload, outage, restart and actual browser commands pass |
| 10 | Qualified for local Linux v0 | Full deterministic trajectory, configured-provider operator checks, populated observation and final feedback/release audit pass |

The goal remains the complete v0 path. Foundational tests establish only the
behaviors they exercise; they do not establish autonomous research.

A declared Service or successful resource open is not an implemented research
path. Existing record shapes are partial scaffolding, not a settled scientific
model or a mandate to create every listed table.

### Ownership and interface decisions

- Use the implemented BioLab operations for institutional reads, writes, and lifecycle transitions. Future operations are added only with their working consumer.
- Bind recording permissions to trusted run/role identity established by the application. A model-supplied actorRole or originRunId is not proof of authority. Tools expose the authorized subset; BioLab independently checks writes.
- Commit decision and ready objective, report and review-pending gate, and reviewed decision and next window atomically. A dossier may be retained while its block is pending; finalization links it to a countable terminal block only after actual Pi/environment cleanup. Active run/recovery state prevents scheduling during that gap. Preserve immutable references and avoid duplicate retention on retry.
- Keep results attributable to actual computation or verifiable structured retrieval. Preserve artifacts needed for later inspection before Pi removes temporary environments; a reference to a deleted workspace is insufficient. Fresh roles retrieve authorized retained artifacts without database access.
- Import Pi Durable, Pi AI, and Chord through the existing Pi integration. Use upstream conversations, tasks, bundled tools, abort, and resume. No copied Pi, additional script VM, AgentRuntime Service, or Effect cognition implementation is needed. The [Pi dependency decision](architecture/PI_COMPATIBILITY.md#dependency-decision-from-installed-source) owns package rationale.
- Pi alone owns environment selection, isolation, processes, and cleanup. Required host adaptation stays within that integration and uses the imported ExecutionEnv contract. A working directory alone is not isolation; qualify the concrete mechanism before enabling production computation.
- Effect manages application configuration, scoped resources, typed failures, deadlines, HTTP/SSE, and legal-action lifetime. Request cleanup through Pi; do not create a parallel execution interface. Follow the [Effect guide](guides/EFFECT.md), including narrow unstable API allowances.
- The user-selected cognition provider and ordered fallback are defined in [Pi model routing](architecture/PI_COMPATIBILITY.md#production-model-routing). The independent semantic provider is defined in [Jev's TypeSafe integration](architecture/JEVENGINE.md#typesafe-provider). These are settled configuration choices; provider smoke verification does not
  replace full mission qualification.
- Establish exclusive scheduler/store ownership before opening Pi storage. Keep canonical and runtime databases distinct; configuration must reject the same resolved store. Release ownership after resource cleanup.
- Keep source content and scientific representations open. Stable institutional references, provenance, and actual boundary validation are required; a complete biological ontology or universal source schema is not.
- Use the implemented mission command, history-read, and SSE snapshot interfaces in http/missions.ts and the validated view contracts in http/views.ts. Preserve the status path; add route payloads only for implemented behavior.
- Researcher and one persistent Director side-work turn may run concurrently in separate environments; Validator and strategic handoffs remain gated. Never install subagent tools or allow detached scientific work to evade abort and block cleanup.
- Current restart policy explicitly aborts interrupted runtime work before enabling Pi scheduling, then settles its original institutional identity with the actual deadline, retained dossier and available records. Unknown outcomes stay failed/orphaned rather than replayed. Missing runtime state follows the same conservative policy. Exact continuation of interrupted cognition is not required for v0.
- Command acknowledgement follows canonical state change and owned-work cleanup. Revision retains its history and invalidates an unused objective from the previous direction; revision of active research orphans that work before the next Director decision.

### Delivery order and dependencies

Every slice ends with observable behavior, meaningful tests, and the repository
feedback checks. Foundation work uses owned test storage and deterministic
models. No continuous mission scheduling is enabled before validation and
recovery obligations pass.

| Slice | Deliverable | Owner | Requires |
| --- | --- | --- | --- |
| 1 | Qualified imported model/tool/cancellation path | Pi integration | Existing Harness resource |
| 2 | Canonical mission storage and startup ownership | BioLab and application infrastructure | Existing contracts and configuration |
| 3 | Controlled computation, receipts, retained artifacts | Pi integration | 1 |
| 4 | Authorized recording and retrieval tools | BioLab and Pi tool integration | 2, 3 |
| G | Replaceable Genesis map → inaugural direction | Core program, BioLab, Jev, existing Pi Director | 2; qualified Jev transport |
| 5 | Genesis → Director → one bounded ResearchBlock → dossier | Role programs, Core lifecycle, BioLab | 1–4, G |
| 6 | Exact ten-block validation and Director review | BioLab, Core, Pi roles | 5 |
| 7 | Human commands, recovery, continuous mission lifecycle | Application lifecycle and command interface | 5, 6 |
| 8 | Semantic measurement and capability learning | JevEngine, BioLab, Pi tools | 4; integrate with roles from 5–6 |
| 9 | Real history/activity API and UI | Observation interface and UI | 7, 8 |
| 10 | Complete v0 qualification | Application integration tests | 1–9 |

Slices 1 and 2 can be developed independently. Slice 8 may follow slice 4 while
role work proceeds. Its tools are available in the completed v0; their use is
optional in any investigation. These are engineering dependencies, not a
mandatory retrieval → computation → Jev scientific sequence.

### 1. Qualify imported Pi behavior

Use a deterministic model provider to submit input, invoke one registered tool,
and settle an answer through imported Durable. Inspect the installed contract
for model configuration, stable request identity, submission waiting, abort,
idle, reopening pending work, usage, and committed activity.

Acceptance:

- The observable input/tool/answer history survives close and reopen.
- Retrying the same request does not admit duplicate input.
- Cancelling submission wait does not masquerade as aborting durable work.
- Explicit abort settles owned work. Harness close preserves recoverable work rather than falsely completing a ResearchBlock.
- Opening failures release acquired resources; cleanup failures stay visible.

Deliver only integration needed for this behavior. Resolve incompatibilities in
the pinned runtime before building scientific role behavior on them.

### 2. Retain missions and establish ownership

Implement BioLab migrations and authorized mission creation, reads, and retained
revisions. Add minimal AgentRun/lifecycle identity needed by the next slice.
Compose canonical storage and Pi resources under scoped application ownership;
keep the existing status backend available without starting research.

Acceptance:

- Mission and revision history survive reopening real institutional SQLite.
- A second scheduler owner is rejected before Pi work starts; ownership can be reacquired after orderly release.
- Canonical/runtime stores cannot resolve to the same database.
- Acquisition failure releases earlier resources and admits no research work.
- Callers receive institutional operations, not raw SQL or generic canonical writes.

### 3. Qualify Pi-owned computation and artifact lifetime

Supply the controlled environment factory through Pi and retain bundled coding
tools. Choose the smallest isolation mechanism that satisfies the documented
filesystem, process, network, environment-variable, and resource-limit boundary.
Qualify general files, shell programs, temporary dependencies, and permitted
retrieval without language-specific engines or source registries.

Acceptance:

- A real program and structured retrieval produce attributable receipts and inspectable outputs; failures remain explicit.
- Canonical/runtime databases, unrelated workspaces, host credentials, and unrestricted host files are inaccessible.
- Parallel and descendant processes remain owned by the run and terminate during Pi cleanup.
- Needed artifacts remain retrievable after temporary environment cleanup; fresh authorized roles can use retained inputs.
- Idle settlement and environment cleanup are checked separately. Failed cleanup prevents falsely settled institutional work.

Host isolation is an implementation decision to qualify here, not an assumption
already established by Pi acquisition or a requirement to invent another runtime.

### 4. Add authorized recording and retrieval

Connect real operation receipts to BioLab ScientificResult retention. Add
Interpretation, HypothesisRevision, ResultAssessment, Failure, Uncertainty, and
handoff records only as this working path needs them. Register role-specific
BioLab tools and source-local memory retrieval through the Pi integration.

Acceptance:

- Valid shape with forged role/run identity or unrelated provenance is rejected.
- Results remain immutable while later interpretation and assessment retain their basis.
- Missing, unavailable, unknown, not measured, zero, false, and negative are distinct; contradictory and failed-replication outcomes remain retrievable.
- Literature, a model claim, or a Jev score cannot substitute for an actual operation.
- Retrying authorized recording does not duplicate institutional history.
- Retrieval includes orphan history and retained artifacts without exposing storage internals.

### 5. Complete Genesis and the first investigation path

Implement [Genesis](architecture/GENESIS.md) as a replaceable initialization
program supplied by composition. Retain broad discovered candidates and explicit
source outcomes in BioLab; use Jev without score-based deletion or activation.
The existing inaugural Pi Director searches the map and commits the first
decision/objective before canonical completion admits ResearchBlock #1.
Genesis and later Refresh do not advance validation cadence.

Qualify alternative source-agnostic discovery programs, partial failure,
insufficient-map rejection, retry/reopen, stale mission revision, and completion
requiring both inaugural references. Provider-specific ingestion is deferred;
source choices live in deployment configuration rather than Core. Do not add
GDC/bio.tools branches, mandatory provider slots, or source-specific completion
conditions anywhere in application lifecycle code.


Implement role configuration, instructions, and authorized tools. Director
retains a mission conversation, retrieves relevant history, and commits a
decision and bounded objective. Run that objective in one fresh Researcher
conversation and Pi-owned environment. Record obtained results as they occur,
then retain an honest dossier and the actual terminal block state.

Acceptance:

- Director owns objective choice; Researcher chooses method and action order.
- A new block has a new Researcher; its provenance links mission, objective, AgentRun, conversation, environment, receipts, records, and dossier.
- COMPLETED_NO_RESULTS is an explicit outcome, not a zero finding or fabricated result.
- The approximate ten-minute ResearchBlock deadline requests explicit Pi abort with a live cleanup context, then waits for idle and environment cleanup before TIMED_OUT.
- Cancelled work and failed work without a dossier retain orphan history. A timeout without a dossier is outside the countable trajectory; preserve its actual output and failure context.
- Cleanup failure leaves recovery-required work rather than a falsely settled block.

Exercise one legal investigation at a time here. This slice is not permission
to run a continuous mission without the next slice's validation barrier.

### 6. Enforce validation and review

Derive the countable trajectory from canonical terminal records. After the
exact ten-block window, retain a ValidationCycle and its separate ValidationBlock.
Invoke a fresh Validator with a clean independent environment and access to
that window's history. Retain the report, then require a Director decision
that processes and cites it before admitting the next objective.

Acceptance:

- Completed blocks, including no-results outcomes, count. Failed/timed-out blocks with retained dossiers count; cancelled/orphan blocks do not.
- Validator's own block is outside the research count. An unfinished block recovered under its existing identity counts at most once.
- Tenth-block retention closes the gate. Report retention atomically changes validation-due to Director-review pending; research remains blocked.
- Validator failure leaves validation pending; Director failure leaves review pending. Neither permits block eleven.
- Review completion opens the next exact window without allowing Validator to select objectives, activate defaults, or rewrite results.

Use the [workflow transition contract](workflows/README.md#ten-block-validation-and-review)
for flag meaning; do not maintain an independent counter or parallel review state.

### 7. Connect mission commands, recovery, and continuous lifecycle

Expose authorized start, pause, resume, revise mission, and stop operations.
Compose the application cycle from canonical state, next legal action, actual
role outcome, and reread. On startup, reconcile unfinished institutional work
with public Pi runtime APIs before scheduling anything new.

Acceptance:

- Stop and pause prevent new scheduling while still triggering owned-work cleanup.
- Pause retains available research as orphan history with its original deadline; resume starts new legal work without reactivating that deadline or counting the orphan.
- Pausing validation/review never clears its outstanding gate.
- Recovery reconciles completed work and unfinished logical identity without duplicate records, double counts, or blind replay of completed external operations.
- Missing Pi state cannot erase BioLab history; reconstruct agent context from retained records and expose uncertain execution outcomes honestly.
- Shutdown requests Pi settlement/abort and environment cleanup before releasing Harness, storage, and ownership.
- Operational failures do not manufacture successful handoffs or autonomous mission completion. Only explicit human stop ends the mission.

### 8. Integrate semantic measurement and capability learning

Complete Jev's authorized canonical retention and role-tool binding using its
qualified question/projection contract and imported provider transport,
response validation, and important measurement retention through BioLab. Add
capability version history, assessment, and qualified default selection as
actual reuse paths need them. All capability execution remains inside Pi.

Acceptance:

- Retained measurements identify the question/version, subjects, projection/input identity, provider/model, material parameters, output, receipt, and origin run.
- Native confidence is preserved where available; absence stays absent. Semantic confidence is never treated as biological/statistical confidence.
- Jev returns measurements without choosing objectives, accepting hypotheses, executing programs, or activating capabilities.
- Researcher can create, assess, and reuse a capability in a fresh environment; Director can select or roll back qualified defaults; Validator can assess but not activate.
- Ad hoc computation needs no capability registration. Old capability versions and result history remain inspectable.
- An investigation can omit Jev and capabilities without losing access to general computation.

### 9. Expose real observation and human control

Connect command operations to validated HTTP interfaces. Serve durable views
from BioLab and stable live projections from Pi committed activity. Stream role,
model/tool, command/output, error, Jev, elapsed-time, and available usage/cost
information. Extend the existing status UI with actual mission and research views.

Acceptance:

- Commands affect canonical lifecycle through backend operations; browser state never schedules research.
- Live projections and durable queries agree on references while remaining distinct kinds of information.
- Dossiers, results, interpretations, hypotheses, failures, uncertainty, capabilities, reports, and Director responses are inspectable as implemented records.
- Refresh and stream reconnection preserve backend execution and recover the current view from real state.
- No fake activity, invented percentage, hidden chain-of-thought, or unavailable usage presented as zero appears in the UI.

### 10. Qualify the complete v0

Exercise Genesis followed by one complete ten-countable-block window, Validator block, Director
review, and subsequent research through the mission application interface.
Use deterministic models, real institutional/runtime stores, and actual
controlled computation. Include source/representation/program variation without
changing Core or settling a scientific ontology.

Acceptance:

- Interrupt model turns, tools, recording, environment cleanup, streaming, and shutdown; reopen and reconcile the actual outcomes.
- Validate the required success, no-results, timeout, orphan, pause/resume, review-failure, and missing-runtime paths.
- No raw canonical writes, second cognition/execution owner, subagent path, duplicate history, skipped validation, leaked process, or unowned resource remains.
- Source variation demonstrates interface generality; it is not a predefined biological benchmark or mandatory research procedure.
- The full repository feedback command passes, and operator verification of a configured real provider is recorded separately from automated deterministic checks.

## Testing Decisions

The user confirmed one main mission-lifecycle integration seam with focused
checks at existing Pi, BioLab, and HTTP boundaries. Use the actual application
command/lifecycle program and retained outcomes; do not add a test-only runtime
facade or require HTTP transport to test every institutional invariant.

- A good test submits real input at an owned interface and asserts observable output, persisted history, legal gating, or cleanup. It does not mirror a function body, mock private call ordering, or inspect Pi's internal tables.
- Extend the existing Pi scoped-resource test for deterministic model/tool input, abort, interrupted waits, reopening, and visible release failures. Keep all direct Pi imports in its integration, including tests.
- Test BioLab recording and transitions through its authorized interface with actual temporary SQLite and retained artifacts. Check authority rejection, immutable/revision behavior, retries, transactional gates, and reopening.
- Keep the existing pure nextAction tests for precedence; add missing recovery/ready/wait cases only with lifecycle work. Prove count and review behavior through retained records rather than Boolean-only mocks.
- Use one main integration fixture with deterministic role responses, real Pi and BioLab stores, controlled computation, and scoped resources. Grow it from one block to the ten-block/review/restart path; do not duplicate the mission engine in the fixture.
- Extend the existing real HTTP status test for command validation, state/history reads, and event-stream behavior. Add UI observation checks when the real command/stream path exists.
- Use controllable synchronization and clocks where relevant, not fixed sleeps. Real isolation/process tests must prove access denial and descendant cleanup, not merely assert factory configuration.
- Automated tests use owned temporary resources and no paid-provider credentials. Provider smoke verification is explicit; scientific quality is not claimed from deterministic infrastructure tests.
- Run the fast feedback command after small changes and the full command before completing each slice, as required by AGENTS.md. Preserve strict diagnostics and exact unstable allowances; fix incompatible APIs rather than suppress checks.

## Out of Scope

- Settling a biological domain, universal ontology, complete future schema, or predefined source collection before implementation.
- Fixed scientific choreography, modality order, mandatory ResearchBlock literature/Jev stages, fixed hypothesis counts, or universal interestingness scores.
- Additional autonomous roles/subagents, copied Pi internals, a second cognition/workflow runtime, a separate execution subsystem, or per-language scientific engines.
- Raw canonical SQL tools, transcript-as-scientific-history, mutable old results, or UI/SSE as canonical state.
- Additional developer approval gates or predefined scientific benchmarks.
- Distributed schedulers, new Pi CLI/TUI/MCP/server features, or new abstractions without a concrete working consumer.

## Further Notes

Published as [implementation issue #1](https://github.com/asimog/biojev/issues/1)
with the ready-for-agent label.

The plan was synthesized from every document in specs, the glossary, repository
instructions, current code/tests/configuration, and installed package inventory.
Topic specifications keep ownership of detailed contracts and tooling settings;
the plan does not repeat their dependency inventories or implementation trees.
The progress table records completed v0 paths and their qualification evidence. Configured autonomous research has produced real
results in operator verification; deterministic tests qualify the full trajectory.

All ten slices contribute to the complete v0. Validator is required before
continuous scheduling, and semantic tools/capability learning are implemented
without making their use mandatory in every block. The qualified Linux mechanism
is documented by ExecutionEnv; production bindings, new route payloads, and
minimal persistence representation are concrete decisions for their respective
slices, not a settled scientific-domain prerequisite.

Production composition now exposes validated mission HTTP commands and observation
routes, configured imported providers, owned workspace settings, and a Next.js
command/observation UI. Production crash/shutdown and HTTP-to-imported-Pi
lifecycle checks now complement the deterministic institutional trajectory.

## Genesis and v0 qualification

The Genesis specification is integrated into v0. BioLab persists DISCOVERING,
READY_FOR_DIRECTION, DIRECTOR_RUNNING, FAILED, and COMPLETED; NOT_STARTED is an
absent snapshot. Deterministic integration checks observe discovery during Jev
measurement and the inaugural Director's admitted phase. Settlement restores
readiness after interruption; completion still requires both inaugural references.

| Genesis invariant | Qualification evidence |
| --- | --- |
| Required before block one | Core precedence and direct BioLab block-admission rejection |
| Completion requires initial decision and objective | Director transaction retains both and completes the snapshot; insufficient map rejects handoff |
| No research count | Count remains zero through discovery and inauguration |
| Jev measures without selecting/discarding | Low-relevance candidate remains searchable; semantic outage retains discovered candidates and explicit failure |
| Partial discovery is explicit | Missing input outcomes fail sufficiency; catalog outage survives in Director's completeness report |
| Replaceable initialization | Discovery Effect and question projection are supplied; a different program identity can initialize an incomplete mission |
| Normal lifecycle follows | Main imported-Pi fixture performs Core discovery, inaugural Director, real computation and normal block settlement |
| Refresh remains separate | Refresh adds candidates without changing the completed snapshot, first objective, or research count; reopening preserves both |
| Validation remains exact | Same main fixture reaches ten countable blocks, fresh Validator, failed/retried review, and block eleven |
| No scientific pipeline encoded | Source identifiers and abilities are absent from Core policy; discovery candidates retain generic metadata |

Automated qualification uses real temporary BioLab/Pi SQLite, imported Pi with
deterministic responses, and actual controlled computation. It is application
end-to-end qualification, not a live GDC/bio.tools ingestion or browser-driven
mission claim. This older fixture used supplied candidates; current production discovery is Director-led and does not require a catalog-ingestion program.

Local Linux v0 is qualified against the acceptance checks below. This is a
single-operator loopback deployment, with configured Linux isolation prerequisites,
provider credentials and, for that earlier qualification, a supplied catalog.
Current production Genesis uses Director cognition and authorized discovery tools. Deterministic imported-Pi tests qualify the failure and
recovery paths. The later configured five-minute live run completed a real-provider
ten-block window, Validator and Director review; its report distinguishes lifecycle
completion from the trajectory’s scientific and retrieval limitations.

| Acceptance area | Evidence |
| --- | --- |
| Full institutional trajectory | Main mission fixture: Genesis, inaugural Director, ten countable blocks, fresh Validator, failed/retried review, block eleven |
| Commands and observer independence | Imported-Pi HTTP fixture: start, pause, resume, revise, stop, SSE disconnect, acknowledged cleanup |
| Failure and recovery | Timeout/tool abort, orphan handling, interrupted unsafe tools, missing Pi state, real production SIGKILL/reopen and active SIGTERM |
| Canonical recording | Real SQLite authority/revision/immutability tests; real operation receipts; five retained results unchanged after production recovery |
| General computation and capability reuse | Python/shell/representation variation, public retrieval, host access denial, parallel/descendant cleanup, artifacts restored into fresh roles; qualified version selection/rollback |
| Observation | Actual model/tool/command/output and catalog usage estimates; paginated retained history; populated browser commands, reload/mobile, outage and restart |
| Source independence | No source-specific branches in application/tooling; swappable catalog identities, broad retention, semantic failure, separate Refresh |
| Feedback and dependency review | Strict diagnostics, boundaries, lint, 43 behavioral tests, both workspace typechecks/builds; npm audit reports zero vulnerabilities |

Populated observation artifacts are at `/tmp/biojev-populated-observation-g07w3seh`.
Ten checks passed with the existing five real results and orphan history, including
both store integrity checks. The block inspector is a recent-50 view; the durable
record history uses append-only cursor pagination. Usage cost is explicitly a
catalog estimate, and provider billing is unavailable. Public/multi-user hosting,
aggregate workspace/memory quotas, and the newly changed Director-led external
discovery/concurrent lifecycle are not live-qualified by this older result; the execution guide records actual limits.

Live provider/browser qualification admitted a real mission, retained a
TypeSafe Genesis measurement, completed the inaugural Director handoff, and
admitted ResearchBlock #1. Browser pause settled Pi work as a cancelled orphan;
populated reload/mobile layout and explicit stop passed. This smoke stops before
a completed research dossier and does not replace crash/ten-block qualification.
Artifacts are at `/tmp/biojev-live-mission-fixed-42wnwnpf`.
The first live attempt exposed rejected discovery references in Director handoffs. BioLab
now resolves those references with mission/kind checks, and discovery tool results
include explicit canonical references instead of requiring the model to infer a
reference kind from the source/capability category. Deterministic regressions pass;
the successful rerun qualifies the first-block/control path only.

Production crash checks at `/tmp/biojev-crash-production-kkhd6mwe` forced SIGKILL
during a real Pi model turn, reopened the same stores, observed canonical recovery
failure attribution and settled pause, then removed the temporary runtime database
and verified institutional history survived. This qualifies cognitive crash
reconciliation, not an interrupted scientific process/recording transaction.
The first browser smoke loaded credentials but omitted this host's `.env` network
configuration; it therefore does not qualify real production computation. The
completed-result smoke loads both configured environment files and is separate.

That observation window ended before the dossier. Real controlled computation
retained five ScientificResults, interpretations, assessments and uncertainty;
it did not qualify a completed live-provider block. Reopening its stores at
`/tmp/biojev-science-recovery-dcnofgps` settled the interrupted Researcher as a
failed orphan while preserving all five result bodies unchanged. Active Pi
SIGTERM verification at `/tmp/biojev-graceful-shutdown-4yzjwhv_` settled its run
in 57 ms before storage release. The production composition now scopes role and
scheduler finalizers inside the BioLab Layer lifetime. Automated capability
reuse checks cover both fresh Researcher and Validator environments.

Current feedback verification passes 43 tests in 16 files, strict Effect
diagnostics, boundaries, lint, both workspace typechecks and builds. The acceptance
matrix combines deterministic trajectory qualification with separate real operator
evidence; obtained results alone are not treated as a completed research block.

Earlier foundation verification on 2026-10-05: `npm run check` passed 39 tests in 14 files,
zero Effect errors/warnings/messages, typechecking, boundaries, lint and both
workspace builds. A fresh production Chromium run passed eight backend/UI checks:
real status, competing-owner rejection, render/hydration, reload, mobile layout,
backend outage without invented status, restart recovery, and integrity of both
separate SQLite stores after shutdown. Browser artifacts are temporary at
`/tmp/biojev-genesis-e2e-iBD3wP`; they exercise the implemented status UI, not
unimplemented mission controls. No dependency or global tooling changes were
needed for this qualification.

## Configured five-minute live lifecycle

On 2026-10-05, a real-provider computational-methods mission completed Genesis,
ten countable ResearchBlocks, fresh Validator, and Director review. Every research
block completed inside five minutes; Validator completed in 136.7 seconds. The
mission was explicitly stopped after review, orphaning the already-admitted
eleventh attempt. [Live run report](LIVE_RUN_REPORT.md) records each block,
canonical evidence and material agent retrieval/reasoning errors. This verifies
the live lifecycle, not scientific effectiveness: repeated probes and unsupported
interpretations remain visible. BIOJEV_BLOCK_TIMEOUT_MS configures role limits;
the default remains ten minutes and this run used 300000.

## Fast retrieval and handoff regression qualification

The imported-Pi mission fixture now exercises Genesis (initialization, not a
countable block), 10 ResearchBlocks, Validator and Director review, 10 more blocks,
a second Validator and review, and 5 more blocks. It proves 25 settled countable
blocks, two exact reviewed windows and five blocks in the current window. The
first cycle also preserves injected Validator/Director failure-and-retry checks.

Director receives the latest settled dossier and uses its summary/reference in
the next decision. Validator receives the window’s dossiers. The fixture reads
real artifacts and ResearchBlocks through Pi tools, exercises memory browsing,
and verifies both reviewed cycles over HTTP after stop. Multi-word memory search
has a focused SQLite regression. Strict record-kind validation prevents guessed
aliases from becoming misleading not-found responses.

This is deterministic integration testing, not another paid scientific mission.
Imported Pi, separate real SQLite stores, and actual controlled computation are
used. Role deadlines are five-second caps, with no artificial per-block waits;
the targeted 25-block test completed in about 2.75 seconds on this host.

Run it with:

```bash
node --env-file-if-exists=.env --env-file-if-exists=.env.local node_modules/vitest/vitest.mjs run apps/biojev/platform/pi/mission.test.ts -t 'fast 25-block' --reporter=verbose
```
