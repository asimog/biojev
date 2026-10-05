# Genesis: initial institutional discovery

Genesis gives BioJev its initial searchable scientific world. Jev helps it search
and semantically organize that world. Director uses that world to choose the
institution's first research direction.

Search finds possibilities. Jev measures meaning. Director chooses direction.
Researcher chooses method.

## Scope and replacement

Genesis is one initialization phase per Mission. It is not ResearchBlock 0 or a
cognitive role. It has no independent strategic authority and introduces no new
Service, search engine, capability engine, or execution subsystem.

Application composition supplies a versioned discovery program. Replace that
program or its source configuration without changing Core, role contracts,
BioLab authority, or the research counter. Discovery identifiers and metadata
are data; no source names, modalities, installed tools, ranking rules, or
scientific abilities are embedded in Core or application routing. There are no
GDC or bio.tools branches, required catalog slots, or provider-specific completion
conditions. Those names describe optional deployment examples only. Any source
or capability catalog can be supplied by a replacement discovery program;
provider-specific ingestion is outside this specification-change task.

Replacement affects initialization that has not completed and later Refresh.
Changing configuration never erases completed Genesis or research history. An
incomplete attempt can be retried with a different versioned program, preserving
its earlier snapshots, failures, and retrieved candidates.

## Lifecycle and authority

```text
Human Mission
  -> Genesis discovery program
  -> broad candidates retained and indexed in BioLab
  -> Jev-assisted semantic discovery/comparison
  -> inaugural Pi Director searches the retained landscape
  -> DirectorDecision #1 and ResearchObjective #1 retained atomically
  -> Genesis COMPLETED
  -> normal fresh Researcher / ResearchBlock #1
```

The discovery program retrieves and normalizes possibilities. BioLab owns the
retained map. JevEngine measures semantic properties. Only the existing Director
chooses the first objective; its mission-persistent conversation then continues
through the normal institutional cycle. Genesis does not perform a ResearchBlock
and never contributes to validation countability.

| State | Meaning / next permitted transition |
| --- | --- |
| NOT_STARTED | No attempt; begin discovery |
| DISCOVERING | Retain candidates, snapshots, failures, and semantic measurements |
| READY_FOR_DIRECTION | Sufficient durable map and explicit completeness report; invoke inaugural Director |
| DIRECTOR_RUNNING | Existing Pi Director owns strategic reasoning; interrupted work requires reconciliation |
| COMPLETED | Durable sufficient map plus inaugural decision and linked objective exist |
| FAILED | Insufficient map or initialization failure; explicit retry remains possible |

A failed Director attempt returns to READY_FOR_DIRECTION after Pi abort/cleanup;
it never satisfies completion. Recovery reconciles interrupted work before any
new discovery or cognition. Human pause/stop take scheduling priority; neither
fabricates completion. Resume continues initialization if incomplete.

Genesis is bound to the mission revision used for its initial direction. A
revision before completion invalidates stale Director work, preserves discovered
candidates, and requires a new completeness assessment and Director context for
the current revision. Revisions after completion use ordinary Director review;
they do not restart Genesis. A new Mission has its own initialization, although
existing institutional candidates may be reused with their original provenance.

Core enforces: stop, pause, recovery, incomplete Genesis, validation, pending
Director review, normal Director, ready Researcher, wait. No ResearchBlock can
be admitted before canonical Genesis completion, including direct BioLab calls.
Completion and inaugural decision/objective linkage form one transaction. Do
not infer Genesis from an existing objective or invent discovery provenance for
legacy missions; any migration exception must be explicit and inspectable.

## Broad discovery and semantic recall

Fetch broadly, normalize broadly, retain broadly, index broadly, then use
Jev-assisted retrieval/comparison to help Director inspect the landscape.
Genesis uses Jev, while later individual investigations may omit it.

Measurements can concern mission relevance, similarity, method fit,
contradiction, duplicates, conceptual groups, or relevance with little lexical
overlap. Measurements annotate retained candidates and can order a query view.
They never delete candidates, choose an objective, activate a capability, or
turn a fixed threshold/top-K into canonical truth. Keep original candidate
identities searchable even when a measurement suggests weak relevance.

Search remains source-local: source discovery, external capability catalogs,
and BioLab's local indexed retrieval. Jev has no candidate-generation monopoly.
Director and Researcher may search beyond the initialization map immediately.

## Canonical discovery records

DiscoveredSource represents an externally known source/resource. Preserve source
and endpoint identity, description, available operations, input/output concepts,
data types/formats, access requirements, open/controlled access, query/filter
features, documentation, available version/release, retrieval time, snapshot
artifact reference, and normalizer identity/version. Unknown metadata stays
unknown. Source-specific fields belong to extensible metadata, not Core branches.

DiscoveredCapability represents an external candidate known to exist. Useful
metadata includes external identity, name, description, topics, operations,
formats, languages, platforms, documentation/repository/publication references,
license, source snapshot, record hash, and retrieval/normalizer identity.
Discovery does not imply installation, executability, trust, or qualification.

CapabilityVersion names an exact usable implementation. CapabilityAssessment
records observed performance/limitations. A Director-selected default references
a qualified version; it is not derived automatically from catalog membership or
semantic score. Execution remains inside Pi-owned ExecutionEnv.

BioLab operations express domain intent: registerDiscoveredSource,
registerDiscoveredCapability, searchSources, searchCapabilities, inspect, and
recordGenesisSnapshot as the implemented path needs them. They validate trusted
recording provenance; agents receive neither generic CRUD nor SQLite access.
Catalog descriptions are retained discovery metadata, not ScientificResults.

## Snapshot and partial failure

A GenesisSnapshot links genesis identity, mission/revision, discovery-program
identity/version, start/completion times, source and catalog snapshot references,
imported source/candidate counts, explicit import failures, normalizer versions,
important SemanticMeasurement references, and inaugural decision/objective IDs.
It references imported records rather than duplicating their full contents.
Retain attempts and their failures; completed snapshots are immutable.

The deterministic v0 sufficiency policy is: every configured discovery input has
an explicit success/failure outcome; at least one retained, searchable source or
capability candidate exists; and at least one successful Jev comparison is
retained for that map. Existing attributable candidates may satisfy the map
requirement. Counts alone do not certify scientific usefulness.

A source or catalog outage can therefore permit partial initialization. Preserve
which inputs failed and explicitly give Director the completeness report. Never
report a failed catalog as an empty successful catalog. No viable retained map,
missing input outcomes, or unavailable required semantic comparison leaves
Genesis FAILED and blocks ResearchBlock #1. Retry is operational, not autonomous
mission termination. Semantic failure does not discard discovered candidates.

## Refresh and long-term learning

Refresh updates retained source/capability indexes later, using a replaceable
discovery program and new attributable snapshots. It carries no strategic
privilege, does not reset Genesis, and does not alter research/validation counts.
Director responds to its new information through ordinary decision tools.

After each block, Director searches retained dossiers, results, uncertainties,
capabilities, and validation findings. It can abandon the initial direction at
once. Genesis supplies a head start, never a permanent boundary or ranking.

## V0 qualification

The mission-lifecycle integration seam must prove durable initialization before
block one, completion requiring both inaugural references, Jev preserving recall,
explicit partial failure, swappable discovery implementations, retry/reopen,
normal research following initialization, Refresh leaving completion unchanged,
and validation based only on ten countable ResearchBlocks. Use real BioLab and
imported Pi with deterministic responses; external catalog ingestion is deferred.
Full production v0 qualification also requires the command/observation/shutdown
acceptance checks in the implementation plan. Passing initialization tests alone
does not qualify a deployed autonomous mission.

BioLab persists DISCOVERING while semantic discovery is running, readiness and
failure checkpoints, DIRECTOR_RUNNING when the inaugural run is admitted, and
completion with both handoff references. Absence means NOT_STARTED. Interrupted
Director settlement restores readiness without fabricating completion.
BioLab's trusted discovery operation
retains candidate and measurement bodies separately from the snapshot. Semantic
transport attribution uses the Genesis initialization identity; it creates no
fourth AgentRun or role. Actor semantic tools keep their normal role-run identity.
Discovery reads paginate by candidate identity; a bounded page is not pruning.

Director decisions and later learning may cite retained DiscoveredSource,
DiscoveredCapability and initialization SemanticMeasurement references. BioLab
resolves these within the caller's mission and checks the candidate kind;
discovery references cannot impersonate obtained results or qualified versions.
Pi read_record resolves these same references without requiring a duplicate
copy in the ordinary research-record table.
