# Cognitive roles and handoff interfaces

Pi Durable runs exactly three roles. Each is primarily a Pi configuration: model,
instructions, authorized tools, extensions, working directory, and ExecutionEnv.
[Authority](CONSTITUTION.md#authority-and-recording-permissions) defines permissions; [workflows](../workflows/README.md)
defines ordering. Role programs, instructions and institutional tools now run
through imported Harness with the [configured provider](PI_COMPATIBILITY.md#production-model-routing)
or an explicit test catalog/model pair. Tests exercise their real handoffs,
freshness, timeout and review gates. Production composition, authenticated
verification and observation remain pending. Select authorized extensions/tools
explicitly for each role; do not infer authority from a shared registry.

| Role | Input | Output | Lifetime |
| --- | --- | --- | --- |
| Director | Mission revision, recent handoffs, pending validation, institutional references | DirectorDecision and one bounded ResearchObjective | One mission-persistent conversation; recover from BioLab if runtime state is lost |
| Researcher | ResearchObjective and accessible institutional references | ResearchDossier and attributable records produced during investigation | Fresh conversation for each new ResearchBlock |
| Validator | Exact ten-block window and its institutional history | ValidationReport and any reproduction/check records | Fresh conversation and clean environment for its own ValidationBlock per ValidationCycle |

## Director

Director asks which investigation is most valuable given the mission and what
BioJev has learned. It retrieves history itself, assesses results, uncertainties,
contradictions and capability limitations, and responds to Validator criticism.
Its institutional rationale is concise and explicit, not hidden chain-of-thought.
Director exclusively chooses whether to continue, branch, replicate, revisit,
defer, or abandon an investigation, and selects qualified capability defaults.
Shell access supports strategy; it does not make Director the Researcher for
whole blocks.

An objective states what matters: determine whether a finding survives an
independently defined cohort. Candidate directions are suggestions, not commands
to download one source, apply one model, or ask a fixed number of Jev questions.

## Researcher

Researcher owns local action ordering, search, representation, method, code,
hypothesis generation, and changes of approach. It may investigate unexpected
findings, use temporary dependencies, develop capabilities, or omit Jev.
Long-term learning comes from BioLab rather than an inherited previous transcript.
A resumed unfinished block retains its existing logical identity and conversation
where available; it is not a new block. Pause/cancellation instead orphan the
active investigation; mission resume does not resume that orphan.

## Validator

Validator critiques search, computation, judgment, memory, capabilities, and Jev
use across the exact window. It can reproduce work, redownload data, write
independent implementations, and identify tunnel vision or missed opportunities.
Recommendations inform Director; they do not directly change research direction.

All roles have authorized BioLab/Jev tools and computation through Pi-owned
ExecutionEnv. Neither the application nor a role owns a parallel environment.
Multiple scripts, requests, and measurements may run in parallel; responsibility
remains with one model for each role invocation. Fresh roles must be able to
retrieve prior outcomes through institutional records.
