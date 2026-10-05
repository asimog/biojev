# Jev semantic measurement interface

Jev is BioJev's fast, bounded System One semantic measurement mechanism,
not an autonomous agent. Its interface accepts a
question, subject references, and a reproducible projection; it returns a typed
measurement or explicit failure. Rendering, transport, batching, and response
validation stay local to the implementation.

The semantic primitives are Noul, Choice, and Score.
The measure operation accepts a versioned question using one of those native
primitives. Choice supplies named criteria; Score supplies at least two ordered
rubric descriptions. Comparison and classification are semantic questions,
not extra Services or copied provider primitives.

Useful questions concern relevance, distinction, contradiction, semantic support,
method fit, representation suitability, candidate comparison, or the relationship
between an objective and institutional history. Jev is optional in an investigation.

Search generates possibilities. Jev measures semantic properties. An agent
chooses consequences. High confidence does not select an objective, accept a
hypothesis, launch computation, or activate a capability automatically.

Authorized role tools call this interface when trusted composition supplies Jev through authorized application programs.
Harness acquisition and CodingTools registration do not install semantic-provider
credentials or enable Jev role tools. Provider integration stays local here;
Pi receives the tool's semantic result rather than the provider implementation.

## TypeSafe provider

Jev uses the [TypeSafe API](https://docs.typesafe.ai/sdk/javascript) directly,
through the installed `@typesafe-ai/sdk`. Its backend configuration is
`TYPESAFE_API_KEY`, optional `TYPESAFE_BASE_URL` (default
`https://api.typesafe.ai`), and `TYPESAFE_DEFAULT_MODEL` (default `jev-latest`).
The key is separate from Pi's OpenRouter key and is never supplied to agents or
the browser. `.env.example` documents both providers' model choices; ignored
root `.env.local` holds local values. Backend development and root tests load
`.env` followed by `.env.local`; an already exported environment value takes priority.

`TypeSafeLive` implements the JevEngine Layer. It supplies Effect HttpClient as
the SDK's HTTP callback, bridges cancellation, and disables SDK payload logging.
Each measurement has one bounded ten-second attempt, a one-MiB request bound,
and a four-MiB response bound with the qualified Node HTTP client. Provide
NodeHttpClient.layerNodeHttp at composition. This imports SDK behavior instead
of rebuilding TypeSafe transport or routing Jev through Pi cognition.

The boundary validates finite native answers, matching primitive/criteria,
probability distributions, usage, and model identity. Missing or invalid answers
are typed failures; they never become zero. Measurements preserve projection and
question versions, exact request hash, actual model, native answer/usage, and the
request receipt when supplied. No semantic threshold selects a research action.
Local HTTP tests qualify all three primitives, malformed responses, HTTP failure,
and cancellation. Authorized BioLab retention and role-tool binding are implemented but production
composition remains unfinished; returning a structurally valid measurement does not confer canonical
recording authority. Live authenticated verification remains separate.

## Retained measurements

Important measurements should retain question identity/version, primitive,
subject refs, projection identity/version, rendered input hash, provider/model,
material parameters, result, native distribution/confidence when available,
origin run, timestamp, and receipt. BioLab records these through its authorized
interface. Reproducibility means preserving the question and relevant inputs;
it does not imply deterministic model output.

Semantic confidence is not biological or statistical confidence. Jev does not
replace empirical computation. The interface must preserve unavailable values
rather than convert them to zero scores.

[Workflows](../workflows/README.md#optional-semantic-judgment) provides examples;
[authority](CONSTITUTION.md#authority-and-recording-permissions) assigns decisions to agents.

## Genesis integration

Genesis requires broad semantic discovery through this same Jev interface.
Measurements annotate or order retained candidate views without reducing the
canonical candidate set, selecting objectives, or activating capabilities.
Individual ResearchBlocks remain free to omit Jev.

[Genesis](GENESIS.md) owns initialization lifecycle, provenance, partial-failure
policy, and the distinction from later Refresh.
