# BioJev specifications

BioJev is an autonomous, domain-agnostic computational research institution.
The human supplies a mission; BioJev selects investigations and methods.
Institutional sequencing is deterministic. Scientific procedure stays open.

## Read by purpose

| Document | Owns |
| --- | --- |
| [Architecture](architecture/README.md) | Modules, interfaces, seams, and design depth |
| [Constitution](architecture/CONSTITUTION.md) | System invariants |
| [Genesis](architecture/GENESIS.md) | Director-led initial discovery, inaugural direction, and Refresh distinction |
| [Roles](architecture/AGENT_ROLES.md) | Role inputs, outputs, and lifetimes |
| [BioLab](architecture/BIOLAB.md) | Institutional records and recording interface |
| [Jev](architecture/JEVENGINE.md) | Semantic measurement interface |
| [ExecutionEnv](architecture/EXECUTION_ENV.md) | Pi-owned computation and isolation obligations |
| [Pi compatibility](architecture/PI_COMPATIBILITY.md) | Cognition ownership and integration obligations |
| [Workflows](workflows/README.md) | Sequencing, handoffs, validation, timeout, recovery, and observation |
| [Implementation plan](IMPLEMENTATION_PLAN.md) | Implementation slices and acceptance criteria |
| [Effect guide](guides/EFFECT.md) | Application composition conventions and exact unstable usages |
| [Repository guide](guides/REPOSITORY.md) | File ownership and source layout |

The converged Effect application / Pi Durable architecture in the constitution
is the design baseline. Pi alone owns ExecutionEnv and runs the three roles. Topic documents own distinct facts; link to their owner instead of
copying workflow diagrams, record catalogs, or dependency inventories.
The [Pi compatibility guide](architecture/PI_COMPATIBILITY.md#installed-integration)
distinguishes tested role/resource/computation paths and production qualification,
and owns the three-package Pi dependency decision. The root README
describes current implementation. The workflows describe obligations, including
behavior and acceptance criteria. Dependencies
and tooling settings are defined by manifests, lockfile, and editor configuration.

[Jev cookbook patterns](guides/JEV_COOKBOOKS.md) are optional agent techniques,
not mandatory scientific choreography.
