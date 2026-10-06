# BioJev role, authority, and invariant constitution

This constitution governs the Effect application, its Pi Durable integration,
and the human UI. It defines authority independently of implementation access.

The institution constrains authority, persistence, provenance, lifecycle,
isolation, validation, resource lifetime, and recovery strongly. Agents retain
freedom over scientific questions, search, representations, methods, languages,
hypotheses, tools, and whether Jev is useful within an investigation.
Genesis separately requires semantic discovery under its initialization contract.

1. Director selects the next investigation; Researcher selects its method.
2. Validator independently critiques; Director decides the response.
3. Exactly three cognitive roles exist. Computational parallelism does not create subagents.
4. Pi Durable runs all three cognitive roles and alone owns runtime cognition, conversation/tool-task durability, and ExecutionEnv.
5. Every role computes through its Pi-owned isolated ExecutionEnv; no application-owned execution subsystem exists.
6. BioLab is the sole canonical institutional history and capability authority.
7. Access, schema validity, and tool availability do not confer recording authority.
8. Pi runtime state is distinct from institutional truth.
9. Jev measures semantics; agents decide consequences. Jev is not scientific computation.
10. ScientificResult records obtained output; Interpretation and ResultAssessment express meaning and criticism.
11. Missing, unknown, unavailable, not measured, zero, false, and negative remain distinct.
12. Negative, null, contradictory, unexpected, and failed-replication results remain history.
13. Every new ResearchBlock has a fresh Researcher conversation.
14. Every ValidationCycle has a fresh Validator conversation and clean ExecutionEnv.
15. Validation is mandatory after ten countable blocks, including failed and timed-out blocks with dossiers; cancelled/orphan blocks do not count.
16. Validator gets its own review block after each ten-block window; Director processes its report before the next ten-block window begins.
17. Core controls legal sequencing and contains no domain-specific scientific workflow.
18. Capabilities emerge from research; arbitrary actions do not require prior registration.
19. UI state and live activity are projections. Browser refresh does not affect research execution.
20. A mission continues until the human stops it; pause retains active research as an orphan without completing the mission.

21. The existing Director performs open-ended Genesis discovery and chooses its inaugural direction; block 0 is initialization, not a ResearchBlock.
22. Genesis is replaceable, source-agnostic, once per Mission, and outside ResearchBlock countability.
23. Director side work may run alongside Researcher in a separate Pi environment; only the settled handoff selects the next objective, and Validator review remains blocking.

Validator is required for v0. No second agent/workflow runtime, centralized
Search engine, scientific execution subsystem, mandatory scientific modality/literature/Jev
stage, fixed hypothesis count, or universal interestingness formula is introduced.

[Workflows](../workflows/README.md) defines sequencing and operational failure
obligations. Disease, assay, source, and method examples are research possibilities,
not architecture stages.

## Institutional constraints and scientific freedom

BioJev follows the Bitter Lesson: favor strong models, broad computation,
search, memory, general tools, empirical feedback, and learning from outcomes.
Strong institutional boundaries constrain authority, persistence, provenance,
lifecycle, isolation, validation, and recovery. Scientific strategy, source
choice, search order, representation, method, language, tools, hypotheses, and
Jev usage within ResearchBlocks remain agent choices.

Core vocabulary is domain-agnostic. Mutation, CNV, expression, GDC, TCGA,
survival, single-cell, proteomics, and alignment may be useful investigations;
none is a mandatory control stage. Search stays source-local to BioLab, public
sources, files, repositories, and capabilities. Search produces possibilities,
Jev measures semantic properties, and agents choose consequences.

## Runtime and execution ownership

Pi runtime behavior is imported from installed upstream packages inside
platform/pi. Pi Durable is not reconstructed in Effect, and Pi
source is not vendored. The platform folder contains integration, not a fork.

Effect is the application programming model. It supports Core lifecycle,
BioLab, JevEngine, Pi Harness resources, and HTTP/SSE. Pi Durable runs Director,
Researcher, and Validator and is the sole owner of ExecutionEnv. Effect opens
and closes Pi resources and requests role work or cancellation through Pi;
it does not acquire, execute through, or clean an independent environment.

Pi tool calls enter Pi-owned ExecutionEnv for actual process, filesystem, and
network operations. Pi owns environment selection, workspace identity, execution
lifetime, isolation, and cleanup. BioJev defines institutional requirements for
that boundary and supplies integration code inside Pi's platform seam. This does
not create an Effect ExecutionEnv Service, separate scientific executor, or
runtime per programming language. All three roles may compute; computation
access confers no strategic, local research, or recording authority.

## Authority and recording permissions

Access does not imply authority. The ability to read, compute, or construct a
valid record never transfers another role's decision or recording permissions.

| Actor/module | Authority | Authorized output | Constraint |
| --- | --- | --- | --- |
| Director | Global research strategy | DirectorDecision and next ResearchObjective; strategic assessments and capability decisions | Does not prescribe mandatory Researcher procedure |
| Researcher | Local method for one objective | ResearchDossier, results, interpretations, hypotheses, capability discoveries | Does not control global direction or capability defaults |
| Validator | Independent critique of the exact window | ValidationReport and attributable reproduction/check records | Does not select the next objective, activate capabilities, or change prompts |
| Jev | Semantic measurement | SemanticMeasurement through BioLab | No automatic action or scientific-truth decision |
| BioLab | Canonical institutional state | Authorized attributable records and lifecycle transitions | No computation or scientific reasoning |
| Core | Legal sequencing | Next legal action and coordinated lifecycle transitions | No method choice, ranking, biological reasoning, or Jev policy |
| Pi Durable | Runtime cognition and sole ExecutionEnv ownership | Conversations, model turns, durable tools, runtime activity, controlled computation | No direct canonical SQL or institutional authority |
| Pi-owned ExecutionEnv | Computation within Pi | Execution/source receipts and artifacts | No autonomous role, canonical write, or scientific decision |
| Application runtime | Application mechanics | Acquisition, release, configuration, scheduling, observation | Does not replace Pi cognition or research decisions |
| Human UI | Explicit human commands and observation | Start, pause, resume, revise mission, stop requests | Local state and events are not canonical history |

An authorized BioLab recording operation must validate actor permissions and
provenance as well as shape. A Pi transcript or tool output alone is insufficient
for ScientificResult. Important Jev measurements also become canonical only
through BioLab. No generic SQL/write tool is exposed to agents.

Tool registration belongs inside the trusted Pi integration. Computation tools receive
only the role's controlled ExecutionEnv. Runtime/storage/conversation APIs are
not agent tools, and opening Harness does not authorize a new investigation.

Director exclusively authors the next ResearchObjective and its strategic
DirectorDecision. Researcher authors ResearchDossier. Validator authors
ValidationReport. JevEngine creates SemanticMeasurement; only BioLab persists
it canonically. ScientificResult comes from attributable real operations and is
persisted through authorized BioLab recording, never from a transcript alone.
Core coordinates lifecycle changes through BioLab rather than owning a second
canonical state store. Human commands request authorized backend transitions;
Next.js and SSE own no institutional truth.

Deleting runtime conversations must not delete retained research. Revising an
interpretation must not mutate an old ScientificResult. Director computation
access does not make Director the scientist for the entire ResearchBlock.

See [BioLab](BIOLAB.md) for recording semantics and
[workflows](../workflows/README.md) for role handoffs.

[Genesis](GENESIS.md) defines the initialization contract and required semantic
discovery. That obligation applies to institutional initialization, not to every
ResearchBlock. Later Refresh never repeats inaugural initialization.
