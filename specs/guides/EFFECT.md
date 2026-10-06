# Application composition guide

Use installed source as the contract. Follow the learning instructions in
[AGENTS.md](../../AGENTS.md#learning-more-about-effect) before writing Effect code.
Manifests and the lockfile define installed versions; do not duplicate their
inventory in documentation.

## Constructs and module depth

Use pure functions for deterministic transformations, Effect programs for
behavior with dependencies/failures/resources, Effect Services for genuine
capabilities, and Layers for concrete provision. BioLab and JevEngine are the
initial application capability modules; domain records are shapes, not
one capability per noun. Pi Harness is scoped infrastructure, not a second
conversation/task implementation.

Accept dependencies at program interfaces. Provide long-lived implementations
at the composition root. Keep transactions local to BioLab, rendering local to
Jev, and ExecutionEnv isolation and cleanup local to Pi. Role callers use those
interfaces.
Use typed errors and explicit resource lifetimes. Shape validation does not
replace the [authority checks](../architecture/CONSTITUTION.md#authority-and-recording-permissions).

Portable filesystem, path, HTTP and process interfaces belong at controlled
infrastructure seams. Normal application code uses no raw filesystem/process/path
or backend fetch. A genuinely missing portable capability requires a documented
platform implementation while callers keep the same controlled interface.

NodeRuntime.runMain stays at the process entrypoint. Domain programs return
Effects. Pi owns cognition and tool durability; application programs enforce
institutional sequencing and request cleanup through each owner's interface.
Pi alone acquires, uses, and cleans ExecutionEnv. Effect supplies configuration,
timeouts, retries, and scoped Pi lifetime without another computation subsystem. See
[workflows](../workflows/README.md) for resource and failure ordering.

## Promise-based Pi resources

The platform Harness resource uses Effect.fn and acquireRelease only to open
and close the imported Pi SQLite storage and Harness. Effect implements no
VM, agent loop, or tool-task runtime.
The [Pi dependency decision](../architecture/PI_COMPATIBILITY.md#dependency-decision-from-installed-source)
defines the three required Pi imports. Map expected opening failures to
PiResourceError; keep mandatory release failures visible. Acquisition and finalization use a cleanup
context that cannot expire midway through releasing ownership.

For role calls, bridge Effect interruption to a Chord context and explicitly
abort owned Pi work when the institutional workflow requires it. A cancelled
Promise wait or closed Harness is insufficient. The role programs now implement
this bridge separately from Harness acquisition. Keep Pi handles inside platform/pi;
application contracts remain independent of runtime types.

ExecutionEnv callbacks are a foreign Promise boundary. Its Linux adapter captures
the platform Context and invokes runPromiseWith only when Pi calls an environment
method; it never runs an Effect inside another application Effect. Cancellation
is bridged to the scoped operation, and cleanup awaits actual namespace teardown.
The checker allowlists the specific foreign callback files described here, and keeps application runners
restricted to the entrypoint. The private relay imports Pi's NodeExecutionEnv
and uses native stdin/stdout for transport; the fixed namespace adapter uses a
Linux ioctl unavailable in portable Effect/Node. Both are documented platform
edges, not alternative application services or cognition implementations.

Authorized BioLab tool callbacks use the same Context runner at platform/pi/tools.ts.
Their programs call BioLab with trusted object capabilities. Effect Schema
validates the canonical boundary and supplies the imported tool's JSON Schema.
Pi's TypeBox wrapper types its registration; it introduces no competing domain
model. Models cannot mint authority by serializing run/role fields.

TypeSafeLive.ts also uses a captured HttpClient Context only at the imported
SDK's Promise HTTP callback. The checker allowlists that exact file. Each
callback buffers its response inside an Effect Scope and releases HTTP resources
before returning the SDK's Web Response. The SDK's AbortSignal interrupts the
HTTP operation. NodeHttpClient.layerNodeHttp enforces the body-size reference;
the Node transport and cancellation are qualified by local HTTP tests. No raw
backend fetch or nested application runner is introduced.

## Verified installed conventions

Context.Service and Schema.TaggedError define capabilities and expected errors.
Config.String/Port and Schema.Literals arrays use current spellings.
NodeServices provides filesystem/path/process support but not HttpClient;
provide HTTP transport explicitly. The installed SQLite implementation exposes
both its concrete and generic SQL interfaces with scoped lifetime.
Recheck these facts against installed source before changing integrations.

## Exact unstable uses

| Export | Allowed file |
| --- | --- |
| effect/http/HttpRouter#add | apps/biojev/http/status.ts |
| effect/http/HttpServerResponse#json | apps/biojev/http/status.ts |
| effect/http/HttpRouter#serve | apps/biojev/main.ts; apps/biojev/test/status.test.ts |
| effect/http/HttpClient#HttpClient | apps/biojev/test/status.test.ts |
| effect/http/HttpClient#HttpClient; HttpClientRequest#post; HttpClientRequest#bodyText; HttpIncomingMessage#MaxBodySize | apps/biojev/jevengine/TypeSafeLive.ts |
| effect/http/HttpServer#HttpServer; HttpRouter#add; HttpRouter#serve; HttpServerRequest#HttpServerRequest; HttpServerResponse#json; effect/net/NetAddress#toUrl | apps/biojev/jevengine/TypeSafeLive.test.ts |

| Institutional / infrastructure use | Allowed file |
| --- | --- |
| effect/sql/SqlClient#SqlClient | apps/biojev/biolab/SqliteLive.ts; apps/biojev/biolab/recording.ts; apps/biojev/biolab/lifecycle.ts |
| effect/sql/SqlError#SqlError (type only) | apps/biojev/biolab/lifecycle.ts |
| effect/sql/Migrator#fromRecord | apps/biojev/biolab/SqliteLive.ts |
| effect/process/ChildProcess (make only) | apps/biojev/platform/ownership.ts; apps/biojev/platform/pi/execution-env/Linux.ts |
| effect/process/ChildProcessSpawner#ChildProcessSpawner | apps/biojev/platform/ownership.ts; apps/biojev/platform/pi/execution-env/Linux.ts |
| effect/http/HttpRouter#serve; HttpClient#HttpClient; HttpServer#HttpServer | apps/biojev/platform/pi/execution-env/Linux.test.ts |

ChildProcess is marked unstable at module level in the installed source, so its
allowance is confined to the ownership and Linux environment files, which use
only make. The fixed ownership
infrastructure process holds Linux flock locks on both store files. Its stdin
closes when the parent exits, releasing ownership without a stale PID file.
It executes no agent commands; agent computation remains inside Pi-owned
ExecutionEnv. The boundary checker allows this one infrastructure file in
addition to the Pi execution implementation.

The compiler configuration allowlists these exact exports by file. Other
unstable/experimental diagnostics remain strict. createServer is isolated in
platform/HttpLive.ts because the Node server constructor requires it; application
composition retains ownership of serving and cleanup. Recheck on upgrade.

The installed checker reports the overloaded bodyText combinator as the
HttpClientRequest module. That module allowance is confined to TypeSafeLive.ts,
which uses only post and bodyText; all other files retain strict diagnostics.

## Editor and diagnostics

The workspace settings select the native TypeScript SDK patched by @effect/tsgo.
Workspace extension recommendations are authoritative. Reload the editor and
open a TypeScript file after setup changes. Do not install a parallel standalone
tsgo. Setup defaults may remove explicit diagnostic severities: inspect and
reconcile the diff instead of accepting a weaker configuration.

Biome provides editor lint diagnostics, formatting, safe fixes, and import
organization on explicit save. The extension uses the workspace configuration;
vendored sources and installed skills are excluded from Biome processing.

Effect diagnostics and ordinary typechecking are separate checks; one passing
does not prove the other passes. The fast feedback command runs both, alongside
boundary checks, lint, and tests. The full command also builds both workspaces.
The default editor build task runs fast feedback; the full verification task
runs the completion checks. AGENTS.md owns when to run these commands. Lint
warnings fail the feedback loop. Root lint also checks editor and
compiler configuration, so configuration changes enter the same feedback loop.

Linux computation tests require Bubblewrap with disable-userns support, prlimit,
Python 3, and Slirp with userns-path support. They exercise actual isolation and
fail if the required host capabilities are absent. The network binary defaults
to /usr/bin/slirp4netns; BIOJEV_SLIRP_BINARY and
BIOJEV_SLIRP_LIBRARY_DIRECTORY configure an unpacked local installation.
Root tests and backend development load optional ignored root .env and then
.env.local using
Node's native env-file support. No dotenv dependency or global tool configuration
is required. Editor type/lint diagnostics do not require those runtime tools.

## Genesis composition

Supply the discovery Effect and semantic-question projection to discoverGenesis.
It uses existing BioLab and JevEngine capabilities; no Genesis Service or
Effect-owned agent/environment is added. Core admission uses retained lifecycle
facts and invokes the existing Pi Director once the map is ready. Semantic
failure retains candidates and an explicit failure rather than a fabricated zero.
The minimal persistence uses the already allowlisted lifecycle SQL surface.

Production mission HTTP uses the installed HttpRouter add/schemaPathParams,
HttpServerRequest request/schemaBodyJson/schemaSearchParams, MaxBodySize, and
HttpServerResponse json/stream/type/setHeaders only in http/missions.ts. The
installed checker identifies the overloaded setHeaders call as the response
module; that module allowance is confined to this file. Other unstable APIs
remain strict. Its transport test separately allowlists serve, HttpClient and
request post/bodyText/setHeader. SSE disconnect cancels observation only, not
the independently scoped mission fiber.

The imported-Pi HTTP lifecycle test in platform/pi/mission.test.ts uses the same
serve/client/request surface, allowlisted only for that file. History responses
carry a retained-record cursor so reconnecting/polling UI clients append immutable
records without resetting previously loaded pages. Empty pages preserve the
cursor; it is an observation token, not institutional authority.

Production Genesis runs through the imported Director, not a catalog reader.
Insufficient discovery remains explicit and parks scheduling rather than spinning
repeated model turns. Scoped concurrent Director/Researcher work is application
lifetime management, not a second cognition loop. The imported environment
conformance suite invokes its scoped Effect runner at a foreign test callback;
check-boundaries allowlists only that exact conformance.test.ts boundary.
