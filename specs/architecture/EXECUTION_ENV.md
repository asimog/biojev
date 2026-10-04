# ExecutionEnv specification

ExecutionEnv is BioJev's controlled computation boundary.

It is not a scientific authority and it is not canonical memory.

All three agents may receive an ExecutionEnv.

Researcher uses it most heavily.

## Purpose

Give agents broad computational freedom inside a constrained environment.

Rule:

> Freedom inside the environment; isolation outside it.

## May support

- read/write/edit files
- shell/process execution
- public network requests
- git clone
- curl/wget
- Python
- R
- Rust/cargo
- compilers
- CLI tools
- temporary package installation
- data transformation
- plots
- arbitrary future runtimes

Do not build bespoke application APIs for every scientific program.

## Owns

- working directory
- filesystem boundary
- process execution
- environment variables
- network policy
- process lifetime
- resource limits
- cleanup
- isolation from host secrets
- isolation from canonical databases

## Does not own

- global research strategy
- local scientific method
- semantic judgment
- capability activation
- institutional persistence
- scientific truth

## Effect implementation

ExecutionEnv should almost never use raw Node I/O.

Prefer Effect:
- FileSystem
- Path
- HttpClient
- ChildProcess
- ChildProcessSpawner
- Scope
- Stream
- Config

Use `@effect/platform-node` at the platform edge.

A raw Node API is allowed only if:
1. an Effect capability is genuinely missing;
2. the need is documented;
3. the implementation is isolated in `platform/`;
4. callers still see the ExecutionEnv contract.

## Execution receipts

ExecutionEnv returns attributable receipts.

A receipt can include:
- receipt id
- program and args
- working directory
- exit code
- stdout/stderr
- environment/runtime identity
- artifact refs
- source URL/HTTP metadata
- timing/resource facts

ExecutionEnv does not create ScientificResult by itself.

An authorized BioLab recording path uses the receipt as provenance for ScientificResult.

## Security

The environment must not get implicit access to:
- `data/biojev.sqlite`
- `data/pi-runtime.sqlite`
- host home
- repository secrets
- provider secrets
- unrestricted host filesystem

Network policy must be explicit.

A future Linux Layer may use bubblewrap, containers, or another isolation mechanism through Effect process APIs.
