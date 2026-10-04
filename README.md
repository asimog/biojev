# BioJev Effect + Pi Scaffold — Revised

This scaffold matches the simplified BioJev architecture.

High-level ownership:

- `core/` controls what is legally allowed to run next.
- `agents/` decide what and how.
- `biolab/` is the sole canonical institutional memory and capability authority.
- `jevengine/` measures semantic questions.
- `agent-runtime/` runs cognition through Pi Durable.
- `execution-env/` gives agents broad computation inside a controlled environment.
- `http/` + Next.js provide observability and explicit human controls.

Execution is provided by ExecutionEnv; no separate execution subsystem exists.

## Central rules

- Access does not imply authority.
- Director decides what to investigate.
- Researcher decides how to investigate it.
- Validator critiques; Director decides what follows.
- Jev measures; agents decide.
- BioLab is the sole institutional state authority.
- Pi owns runtime cognition, not scientific history.
- ExecutionEnv provides computation, not scientific authority.
- Every new ResearchBlock gets a fresh Researcher.
- Every ValidationCycle gets a fresh Validator.
- Validation runs after ten countable ResearchBlocks.
- No subagents.
- Strong institutional boundaries; weak scientific choreography.
- No `src/` directories in BioJev-owned code.

## Effect rule

Effect manages application mechanics.

Use portable Effect capabilities before raw Node APIs:
- FileSystem
- Path
- HttpClient
- ChildProcess / ChildProcessSpawner
- Scope
- Config
- SQL
- Stream / PubSub

Concrete Node implementations are supplied at the edge by `@effect/platform-node`.

## Pi rule

Pi Durable owns:
- conversations
- model turns
- tool tasks
- compaction
- cancellation/resume
- live runtime state
- usage

Only `agent-runtime/**` imports Pi packages.

## BioLab learning loop

BioLab stores durable records such as:
- Mission / revisions
- DirectorDecision
- ResearchObjective
- ResearchBlock
- ResearchDossier
- ScientificResult
- Interpretation
- Hypothesis / revisions
- ResultAssessment
- Failure / Uncertainty
- Capability / versions / qualification / assessments
- SemanticMeasurement
- ValidationCycle / ValidationReport

Director learns across blocks by reading and updating these records through authorized BioLab tools.

See `specs/IMPLEMENTATION_PLAN.md`.

## Run the bootstrap

Install from the root with `npm ci`. In separate terminals, run
`npm run dev:backend` and `npm run dev:web`, then open http://localhost:3000.
The backend serves `GET /api/status` on http://127.0.0.1:3001.

Run `npm run check:fast` during edits and `npm run check` before completion.
See `specs/BOOTSTRAP_REPORT.md` for verified versions, boundaries, and scope.
