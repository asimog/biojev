# Cognitive roles and handoff interfaces

Pi Durable runs exactly three roles. Each is primarily a Pi configuration: model,
instructions, authorized tools, extensions, working directory, and ExecutionEnv.
[Authority](CONSTITUTION.md#authority-and-recording-permissions) defines permissions; [workflows](../workflows/README.md)
defines ordering. Role programs, instructions and institutional tools now run
through imported Harness with the [configured provider](PI_COMPATIBILITY.md#production-model-routing)
or an explicit test catalog/model pair. Tests exercise their real handoffs,
freshness, timeout and review gates. Production composition connects role programs
to mission HTTP commands and observation. Configured provider/browser verification
is recorded separately from deterministic full-trajectory qualification. Select authorized extensions/tools
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
The runtime supplies the latest settled Researcher dossier, its typed reference,
and block identity as researchHandoff. Director uses that retained work when
choosing the next objective; its own transcript is not the handoff. Older records
remain available through lexical search and cursor-paginated memory browsing.
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
Current recovery conservatively settles unfinished work without replay. It
retains the old logical identity, provenance and available records, then admits
fresh legal work. Pause/cancellation orphan the active investigation; mission
resume does not resume that orphan. Any future explicit continuation of an
unfinished block must retain its existing identity rather than count a retry.

## Validator

Validator receives the exact window’s block identities, typed dossier references,
and retained dossier bodies. Its report goes to Director before the next window
can begin.
Validator critiques search, computation, judgment, memory, capabilities, and Jev
use across the exact window. It can reproduce work, redownload data, write
independent implementations, and identify tunnel vision or missed opportunities.
Recommendations inform Director; they do not directly change research direction.

All roles have authorized BioLab/Jev tools and computation through Pi-owned
ExecutionEnv. Neither the application nor a role owns a parallel environment.
Multiple scripts, requests, and measurements may run in parallel; responsibility
remains with one model for each role invocation. Fresh roles must be able to
retrieve prior outcomes through institutional records.

## Genesis integration

The inaugural Director receives the Mission, discovers source and capability
possibilities, updates BioLab with real snapshots and explicit incomplete inputs,
considers uncertainties and gaps, and chooses the first bounded ResearchObjective. Jev can assist its
reasoning. It supplies no mandatory Researcher procedure. The same Director
continues learning across blocks; its initial choice has no permanent privilege.

[Genesis](GENESIS.md) owns initialization lifecycle, provenance, partial-failure
policy, and the distinction from later Refresh.


The production Director performs Genesis itself: open-ended source/capability
discovery and authorized BioLab recording before its inaugural objective.
It also receives one side-work turn alongside each Researcher block in a separate
Pi environment. Side work may retain assessments, hypotheses and discovery but
cannot replace the active objective. The normal settled Director handoff and
Validator review gates still govern the next block. No extra role is created.
