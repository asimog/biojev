# Pi-owned ExecutionEnv

Pi Durable alone owns ExecutionEnv. It is the controlled computational workspace
used by each of Pi's three roles. The interface offers broad coding tools and
attributable operation receipts, while isolation and cleanup remain local to its
implementation. It is not a separate scientific subsystem or capability runtime.

The Effect application manages Pi Harness lifetime and institutional deadlines.
It requests work or abort through Pi, then waits for Pi's execution cleanup.
It has no separate environment resource, execution API, or cleanup subsystem.

## Pi tool access and environment responsibilities

| Caller may request | Implementation must enforce |
| --- | --- |
| Read, write, edit files | Workspace identity and filesystem isolation |
| Run scripts, binaries, compilers, package managers | Process lifetime, limits, termination, cleanup |
| Retrieve public data and repositories | Explicit network policy and source attribution |
| Install temporary tools and dependencies | Changes remain inside the owned environment |
| Use parallel computation | Work remains owned by the same run and cleanup scope |

ExecutionEnv may support Python, R, Rust, shell tools, public interfaces, and
future programs without a bespoke BioJev module for each program. Access to
BioLab/Pi databases, other run workspaces, host credentials, SSH keys, home, and
unrelated host files is excluded. Pi's working-directory configuration does not
by itself guarantee isolation.

The installed Pi ExecutionEnv combines filesystem and shell capabilities.
The Pi platform integration supplies HarnessOptions.env, using conversation
identity for environment ownership; cwd alone is not ownership.
The [Pi integration](PI_COMPATIBILITY.md#installed-integration) registers bundled
coding tools only when supplied an environment factory. The Linux implementation
now imports NodeExecutionEnv inside Bubblewrap and implements the portable Pi
contract through a private transport. Tests connect this factory to imported
Harness and bundled write/bash tools. Role programs supply this factory with
trusted run identity and BioLab receipt recording. Production composition remains
pending; the status backend does not enable computation automatically.

## Qualified Linux mechanism

Each operation uses a separate user, PID, mount, and network namespace with an
owned workspace shared only by that run. System executables, certificates,
installed npm dependencies, and the private relay are read-only. Host home,
canonical/runtime stores, and other environments are not mounted. No host
environment variables are inherited. Further user namespaces are disabled and
procfs is absent, preventing programs from addressing the relay's descriptors.

Shell operations use upstream Slirp for outbound networking with host loopback
disabled and IPv6 disabled. This is broad egress, not a public-address firewall;
private-network egress restrictions would need an additional configured policy.
The real host HTTP-service denial and a public HTTPS JSON retrieval were verified.
See [Slirp's network policy](https://github.com/rootless-containers/slirp4netns/blob/master/slirp4netns.1.md).

Linux limits currently bound each process to 8 GiB virtual address space, 1,024
processes per real UID, 256 descriptors, and 256 MiB per file. At most eight
operations enter concurrently. These are process/file limits, not aggregate
memory or workspace quotas. The transport bounds requests/responses at 32 MiB;
line readers use a bounded snapshot. Large datasets can remain inside the
environment and be processed by programs without crossing the relay.

Namespaces end with each operation, so detached daemons cannot outlive it;
parallel operations share files but each owns its descendants. Explicit cleanup
aborts outstanding operations, waits for namespace teardown, and closes the
environment to further use and removes its private workspace. Failed teardown
remains visible. Role deadlines use the application/Pi abort and idle sequence below.
An optional owned workspace root names directories by validated environment
UUID so startup can clean an interrupted run without receiving a model-supplied
host path. Acquired temporary workspaces use the same explicit cleanup ordering.

The fixed network adapter obtains the user namespace owning the network
namespace with Linux NS_GET_USERNS before executing Slirp. This handles
Bubblewrap's nested namespace without weakening its user-namespace restriction.
It is platform plumbing, not a scientific Python engine or a second executor.
See the [Linux namespace API](https://man7.org/linux/man-pages/man2/ns_get_userns.2const.html).

## Receipts and termination

A receipt identifies the real operation, its inputs/source, runtime/environment,
exit or retrieval status, artifacts, and useful outputs. BioLab's authorized
recording path can use that provenance to create ScientificResult; a receipt
alone is not a canonical record.

The current implementation creates trusted operation receipts with environment
identity, arguments, timestamps, actual status, and bounded output. The adapter keeps a run-local view and persists receipts through its trusted
BioLab callback before returning tool outcomes when role recording is bound. It
retains selected artifacts by content hash outside temporary workspaces and
verifies that hash when restoring an input into a fresh environment. Agent tools
do not receive host artifact paths or database access. Institutional metadata
and authorization for those references remain BioLab's responsibility.

Pi must clean all processes and resources launched through its ExecutionEnv.
On timeout, the application requests Pi abort with a live cleanup context and
awaits both runtime idle and Pi-owned environment cleanup before retaining the
terminal block state through BioLab. Idle alone does not prove process cleanup.
See [workflows](../workflows/README.md#timeout-and-cancellation) for sequencing.
Future implementation lives within the Pi integration described by the
[repository guide](../guides/REPOSITORY.md).
