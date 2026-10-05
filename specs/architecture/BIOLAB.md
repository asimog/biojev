# BioLab institutional memory interface

BioLab answers what the institution learned and retained. Its interface exposes
authorized domain intent and stable references, with recording checks local to
one implementation. Callers do not receive raw SQL or generic save/update/query.
Runtime transcripts answer what an agent did; they are not canonical research.
Canonical history lives in BioLab; Pi runtime state has a separate database.
The configured paths are owned by apps/biojev/config/config.ts.

The [Pi storage resource](PI_COMPATIBILITY.md#installed-integration) retains only
runtime state. It does not implement BioLab persistence, create scientific
records, or provide canonical recording tools. Authorized Pi tools now call
BioLab's domain operations; Pi storage never substitutes for them.

Mission storage and authorized recording now use migrated SQLite. Trusted
application code establishes AgentRun identity and receives distinct actor and
execution object capabilities. BioLab checks capability identity and active-run
state independently of payload fields. Actor tools cannot manufacture operation
receipts or artifact origins. Settled runs lose recording permission.

BioLab binds each new AgentRun to the current mission revision. Role admission
checks the revision used to prepare its context; retrying or reopening a run
preserves its original revision. Director handoffs from stale revisions are
rejected transactionally. Legacy runs without revision attribution can be read
and settled but cannot create new Director objectives.

Run completion uses exact run-scoped handoff/result facts, independent of the
bounded memory-search page. ResultAssessment must reference a ScientificResult.
Dossier result, assessment, interpretation, semantic-measurement, and failure
collections validate their reference kinds and retained targets.

The qualified path runs Pi coding tools, retains actual receipts and artifacts,
records an immutable result and separate interpretation, reopens BioLab, and
restores the artifact into a fresh Validator environment. Hypothesis revisions
retain their prior basis; Validator may assess but cannot revise hypotheses.
Lifecycle handoffs and orphan classification are implemented. Decision/objective
and validation/report/review transitions are transactional. A retained dossier
does not count its block before runtime and environment cleanup succeeds.
Canonical operation history is queryable after reopening; tools do not depend
on an in-memory receipt list. Semantic and capability persistence remain pending.

## Record families

Add records only when an implemented vertical path needs them.

| Family | Records |
| --- | --- |
| Mission | Mission, MissionRevision |
| Runtime attribution | AgentRun |
| Strategy | DirectorDecision, ResearchObjective |
| Investigation | ResearchBlock, ResearchDossier; OrphanBlock classification |
| Science | ScientificResult, Interpretation, Hypothesis, HypothesisRevision, ResultAssessment |
| Learning limits | Failure, Uncertainty |
| Reusable ability | Capability, CapabilityVersion, CapabilityAssessment |
| Semantics | SemanticMeasurement |
| Review | ValidationCycle, ValidationBlock, ValidationReport |

## Recording semantics

ScientificResult is an attributable output from actual computation or verifiable
structured-source retrieval. Useful provenance includes origin run/block,
execution/source receipt, command/tool/capability identity, inputs, sources,
parameters, environment identity, artifacts, output summaries, and missingness.
It does not imply correctness, significance, causality, replication, or importance.
Literature and model interpretation alone are not obtained scientific results.

ScientificResults remain immutable. Interpretations, assessments, and hypothesis
revisions may evolve while preserving their basis and history. Missingness is
explicit, and negative/contradictory outcomes remain retrievable.

## Handoff information

| Record | Information the handoff preserves |
| --- | --- |
| DirectorDecision | Mission, basis refs, validation report basis when pending, strategic rationale, changes/uncertainties, hypothesis/capability actions, next objective |
| ResearchObjective | Mission, origin decision, statement, why now, relevant refs, known failures/uncertainties, candidate directions, constraints |
| ResearchBlock | Mission/objective, agent run, conversation/environment identity, start/deadline/finish, terminal status, dossier ref |
| ResearchDossier | Block/objective, summary, result/interpretation/assessment/hypothesis refs, changes, semantic/capability refs, failures, uncertainty, contradictions, open questions, suggestions |
| ValidationCycle / ValidationBlock | Exact window, Validator block/run, runtime/environment identity, lifecycle, report ref |
| ValidationReport | Window refs, summary, reproduction/method/strategy findings, hypotheses/capabilities/memory/Jev findings, recommendations, basis refs |

Stable identifiers, attribution, timestamps, and immutable references make these
handoffs inspectable. These are semantic requirements, not preemptive table or
field-name mandates; current scaffold schemas implement only part of them.

## Capability learning

A capability is reusable ability, not permission to perform every action.
Ad hoc computation is allowed. Researcher may discover, test, register, and assess
versions. Director may assess the accumulated history and select or roll back
qualified defaults. Validator may critique but not activate defaults.
BioLab retains metadata/version history; Pi performs capability computation
through its ExecutionEnv. No separate capability or Lab runtime executes it.

[Authority](CONSTITUTION.md#authority-and-recording-permissions) defines caller permissions.
[Workflows](../workflows/README.md) defines recording, handoff, and reuse sequences.

OrphanBlock records cancelled, paused, or failed-without-dossier investigation
history. It is excluded from the research window but remains retrievable with
its obtained outputs and failures. Its persistence representation can be a block
classification; no separate table is required merely because the term exists.
ValidationBlock belongs to its ValidationCycle and is not a ResearchBlock.
