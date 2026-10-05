# Repository ownership and locality

BioJev-owned application code uses no src/ directories. Inspect repository files
for the current tree. [Module design](../architecture/README.md) explains interfaces
and depth; this guide assigns ownership rather than snapshotting every file.

| Location | Local responsibility |
| --- | --- |
| apps/biojev/core/ | Pure legal sequencing, replaceable Genesis program, and mission/command programs |
| apps/biojev/agents/ | Domain handoff contracts for the roles Pi runs |
| apps/biojev/biolab/ | Institutional recording/query interface and canonical shapes |
| apps/biojev/jevengine/ | Semantic question/measurement validation and imported TypeSafe SDK transport |
| apps/biojev/platform/ | Concrete application infrastructure composition |
| apps/biojev/platform/pi/** | Direct npm Pi imports, scoped Harness, role/tool integration, recovery and tests |
| apps/biojev/platform/pi/execution-env/** | Pi-owned Linux isolation, upstream environment relay, receipts, retained artifacts, and cleanup |
| apps/biojev/config/ | Process configuration |
| apps/biojev/http/ | Backend command/read/observation interfaces |
| apps/biojev/test/ | Behavioral checks at application interfaces |
| apps/web/ | Human UI and server-rendered observation |
| tooling/ | Local enforcement scripts |
| specs/ | Design, workflows, plan, and verification evidence |
| repos/ | Tracked upstream reference sources |
| data/ | Ignored runtime state with tracked placeholders |

Future directories are created when implemented behavior needs them. Removed
standalone runtime/execution contracts, speculative role factories, and
comment-only implementations are not recreated as new pass-through modules.

Pi/Chord imports and their integration tests stay in the Pi integration.
The main mission integration test lives here so it can configure real imported
Pi with deterministic models; domain-facing tests use institutional handoffs
instead of importing Pi types. Semantic-provider imports stay in
jevengine. SQL belongs in institutional storage or scoped infrastructure, never
role/domain callers. Agent process imports stay inside Pi-owned ExecutionEnv.
Its internal folder is a locality rule, not an independent application module,
Effect Service, or second owner of execution.
The architecture checker enforces these seams. Platform placement alone does
not establish isolation or authorize raw I/O.

Dependency selection belongs to the
[Pi compatibility guide](../architecture/PI_COMPATIBILITY.md#dependency-decision-from-installed-source).
Import Durable's bundled storage/tools instead of installing a CLI, agent-core,
or another executor to obtain them. The three Pi packages are Durable, Pi AI,
and Chord; their current integration qualifies resources and controlled computation,
with role/lifecycle programs exercised in integration tests. Production backend
composition remains pending.

Use one root lockfile; npm keeps Pi package files in node_modules. The Pi
platform folder contains integration only, never copied upstream source or a
second package installation. Pi is not vendored under repos/pi. Production
never imports repos/**. Upstream reference
documentation remains upstream-owned; local specifications govern BioJev.
Add shared packages only for actual multiple consumers, and introduce an Adapter
only for real variability at a seam.

Genesis is coordinated in core/genesis.ts with BioLab-owned validated discovery
records and storage. Concrete discovery is supplied by composition. Source
identifiers, catalog metadata, and external abilities stay outside Core policy;
no permanent source/search/capability subsystem or vendored runtime is introduced.
