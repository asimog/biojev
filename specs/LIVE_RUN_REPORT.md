# Live lifecycle qualification

## Current adaptive twelve-attempt run — qualification FAILED

Date: 2026-10-06. Mission: `live-two-minute-v0`. Real OpenRouter cognition,
TypeSafe semantics and imported Pi Durable/Pi AI/Chord 1.0.4 were used.
The final runtime source was `458da6d49fc6be1ebcf8bb6c25bde9eb41b380d3`. Fixes were deployed between
research attempts, and the human mission was refined to prefer genuinely small
objectives. This is an exploratory qualification with interventions, not an
uninterrupted qualification of one immutable build.

The requested twelve research attempts settled: **five completed countable
ResearchBlocks and seven timed-out orphan blocks**. This did not produce twelve
countable blocks. No Validator cycle ran because the ten-countable-block barrier
was never reached. Consequently live validation and Director review of a
ValidationReport remain unqualified for this implementation.

The mission was explicitly stopped after attempt 12. Backend reports IDLE;
all canonical runs are settled and no owned workspace remains. The local frontend
continues to serve at http://localhost:3000; backend is http://127.0.0.1:3001.

### Budgets and outcomes

Budgets began at 120,000 ms. Each retained ResearchBlock timeout adds 60,000 ms
to subsequent role budgets for the mission, capped at 300,000 ms. Successful and
cancelled blocks do not increase the budget. The current deadline reminder uses
Pi's native `whenBusy: "steer"` after 60 percent of the budget has elapsed.
Work is aborted at the hard deadline before a timed-out block is finalized;
finalization/cleanup timestamps can be a few milliseconds beyond that deadline.

| Attempt | Budget seconds | Settled seconds | Status | Countability |
| --- | ---: | ---: | --- | --- |
| 1 | 120 | 120.1 | TIMED_OUT | ORPHAN |
| 2 | 120 | 120.0 | TIMED_OUT | ORPHAN |
| 3 | 240 | 240.0 | TIMED_OUT | ORPHAN |
| 4 | 300 | 300.0 | TIMED_OUT | ORPHAN |
| 5 | 300 | 157.2 | COMPLETED | COUNTABLE |
| 6 | 300 | 273.9 | COMPLETED | COUNTABLE |
| 7 | 300 | 300.0 | TIMED_OUT | ORPHAN |
| 8 | 300 | 300.0 | TIMED_OUT | ORPHAN |
| 9 | 300 | 272.8 | COMPLETED | COUNTABLE |
| 10 | 300 | 149.6 | COMPLETED | COUNTABLE |
| 11 | 300 | 253.5 | COMPLETED | COUNTABLE |
| 12 | 300 | 300.0 | TIMED_OUT | ORPHAN |

### Verified behavior

- Director-led Genesis completed with actual external retrieval, retained source
  snapshots, explicit partial-discovery limitations and real Jev measurements;
  no source-specific application branch or mandatory catalog was introduced.
- Twelve fresh Researcher conversations and one persistent Director conversation
  were retained. Director side work ran alongside every research attempt in its
  own environment; twelve side-work runs were recorded.
- BioLab retained eleven ScientificResults, five ResearchDossiers, three
  SemanticMeasurements, and separate interpretations, failures and uncertainties.
  Every ScientificResult has an operation receipt from its own origin run.
- Both SQLite integrity checks return `ok`; every retained artifact matches its
  recorded size and SHA-256 identity.
- Frontend HTTP, proxied history and SSE snapshots were exercised successfully.
  Browser rendering/hydration was not independently inspected with a browser.
- Final stop leaves zero active runs, no scheduler failure and no owned workspace.
- `npm run check` passes 73 tests across 19 files, including 24 imported Pi
  environment conformance cases and deterministic 25-block/two-validation-window
  integration coverage; Effect diagnostics, boundaries, lint, typechecks and builds
  also pass. Those fixtures do not replace the missing live Validator qualification.

### Bugs corrected and remaining gaps

Discovery bookkeeping previously allowed an empty declared-input list alongside
real outcomes, preventing Genesis qualification. The Pi tool now derives declared
input IDs from its explicit outcomes while preserving completeness and provenance
checks. Instructions clarify immutable candidate updates and the shared projection
requirement for native Jev batches.

Stale hypothesis revisions previously returned an unhelpful conflict message.
They now return the exact latest revision reference, and the predecessor query is
mission-scoped. A regression demonstrated the original failure and proves that
independent missions can reuse a hypothesis identity without borrowing history.

The live run still fails reliable bounded handoff: agents frequently keep computing
or retaining optional learning records until the deadline, leaving no dossier.
An earlier native reminder improves urgency but does not guarantee completion.
The smallest next qualification task is to reduce handoff/write friction without
relaxing recording authority, then run a clean real-provider ten-countable-block
window through Validator and Director review before admitting the next block.

Adaptive growth currently responds to ResearchBlock timeouts, not standalone
Director/Genesis or Validator timeout outcomes. No aggregate extracted-repository
quota or broader deployment qualification is claimed by this run.

Local evidence is retained under `data/live-two-minute-v0/` and ignored by Git:
`snapshot.json`, `history.json`, `qualification.json`, `backend.log`,
`adaptive-regression.log`, separate SQLite databases and content-addressed artifacts.
No credentials were copied into this report.

## Previous five-minute lifecycle (serial/catalog implementation)

Mission: `methods-five-minute-1791176636575`
Date: 2026-10-05 UTC

Completed with real OpenRouter/Pi cognition, TypeSafe semantics, separate SQLite stores, and Pi-owned Linux computation. This was an autonomous computational-methods mission; model responses were not deterministic fixtures. No source-specific application branches were added.

## Lifecycle outcome

Genesis → inaugural Director → ten completed countable ResearchBlocks → fresh Validator → ValidationReport → Director review → next objective. The mission was explicitly stopped after review. The scheduler admitted Block #11 before the polling observer saw the review transition; that extra attempt was cancelled as an orphan after about 25 seconds and excluded from the count.

Every role had a configured 300,000 ms limit. All ten requested blocks finished in 42–188 seconds. Validator finished in 136.7 seconds. Genesis and its inaugural Director handoff completed in about 58 seconds.

## Genesis

Program: `computational-methods-landscape` version `1`. Two freshly retrieved Python documentation candidates were retained with snapshots and hashes. These were external candidates, not qualified CapabilityVersions. TypeSafe returned model `jev-1.13.0` and semantic relevance 0.93; this was not scientific confidence. Director selected the first objective. Genesis did not count toward validation.

## Every ResearchBlock

All ten rows are COMPLETED / COUNTABLE and have a canonical dossier. Findings are scoped to small tested inputs and CPython 3.14.4, not general biological claims.

| Block | Seconds | What happened |
| --- | ---: | --- |
| 1 | 187.9 | Probed 11 statistical summaries and NaN behavior; retained outputs, limitations and assessment. |
| 2 | 61.8 | Reproduced finite baseline mean versus NaN propagation; recorded temporary-file persistence caveat. |
| 3 | 143.3 | Repeated mean probe with a retained /work artifact and successful read-back. |
| 4 | 69.7 | Created and restored BLOCK_OK/version artifact; an operational check. |
| 5 | 93.6 | Compared summaries excluding one None with zero imputation; verified artifact round-trip. |
| 6 | 68.5 | Retained finite-baseline/NaN mean outputs and verified artifact restoration. |
| 7 | 54.5 | Produced a reachability report; acknowledged Director-side visibility was unobserved. |
| 8 | 115.0 | Retained SURFACED/version artifact and verified byte-identical restoration. |
| 9 | 41.8 | Observed median([1.0, NaN, 3.0]) returning NaN without an exception. |
| 10 | 123.6 | Observed mode([1.0, NaN, 3.0]) returning 1.0; retained version and literal result. |

## Validator

Report: `8f92a604-ab4a-4639-b0ed-9eef4fe2e1eb:1038`
Validation block: `cfd38c27-6b4d-43b5-81b0-d64248cb2005`

A fresh Validator independently restored an earlier artifact and reproduced its mean/NaN outputs. It ran additional NaN/None comparisons, challenged the Director's repeated assumption that Researcher output was absent, and criticized the repetitive trajectory. It retained its own result, assessment, failure, uncertainty, and verification artifact.

## Director review

Decision: `cc892118-aefa-42f7-be34-e2e4f2891ea9:1060`

Director explicitly cited the ValidationReport, accepted the correction that retained artifacts worked, acknowledged repeated surfacing probes, and selected a new objective about sentinel-code missing markers. The canonical cycle is REVIEWED and the validation-window counter reset. The next objective was admitted only after review.

## Important limitations and errors

- Many blocks repeated mean/NaN or artifact checks instead of broadening the investigation. Lifecycle success is not evidence of effective research strategy.
- Empty literal-substring memory searches were repeatedly interpreted as absent history. Canonical history contains earlier dossiers, results and receipts. Fresh-role operation_receipts lists that environment's operations; an initially empty list does not prove earlier blocks never executed.
- Artifact retrieval uses restore_artifact. read_record does not resolve Artifact bodies; using it for that purpose generated misleading not-found diagnoses. /tmp contents do not persist across operations; /work is the persistent run workspace.
- Validator and Director called a finite mode result fabrication or dropping missing data. That interpretation is not established: Python documents mode returning the first encountered value when frequencies tie. multimode returning all tied values is a different contract, not itself a contradiction. See [Python mode/multimode documentation](https://docs.python.org/3/library/statistics.html#statistics.mode). Missing-marker handling still requires an explicit caller policy.
- Validator's suggestion to require scientific outputs for countability is advisory and conflicts with the existing allowance for honest no-results dossiers. It did not change Core or BioLab rules.
- A result and interpretation summarized as test were retained during Block #1 before richer records were submitted. They remain immutable history, not polished scientific claims.
- Tool reference/schema errors and failed file lookups occurred. They were not hidden or counted as successful recording.
- The observer initially checked the current-window snapshot for REVIEWED; review advances the window and removes that cycle from this view. Final qualification therefore checks the retained canonical cycle and Director reference directly. The observer's shutdown error is not a failed mission lifecycle.

## Verification

The final audit checked ten countable completed blocks with dossiers and elapsed/deadline limits; exact cycle membership; a completed fresh Validator; retained report and linked Director decision; STOPPED mission; no active runs or unresolved recovery; empty temporary workspaces; and integrity of both separate databases. No Bubblewrap/Slirp workers remained after orderly shutdown.

Canonical ordinary record counts: 13 Interpretation, 11 DirectorDecision, 11 ResearchObjective, 12 ScientificResult, 16 Failure, 7 Uncertainty, 6 ResultAssessment, 10 ResearchDossier, 1 ValidationReport. Genesis measurements and candidates are retained separately.

Feedback: 43 tests pass, zero Effect diagnostics, boundaries/lint/typechecks pass, and both builds pass.

## Per-block evidence references

| Block | Block ID | Dossier ID |
| --- | --- | --- |
| 1 | `49fd7613-316f-410b-b4f7-dd681741f747` | `444e0fc3-06cb-4515-b435-daf39397e00c:128` |
| 2 | `593b522e-8ede-4ee3-9094-d18ad35fc3b5` | `da2b4e20-92a6-48a9-9c81-8c1d7daa7bca:231` |
| 3 | `93b493ac-8887-432d-a02f-25d3aaf95662` | `59b903b6-986f-40c8-be6f-28746d6c2b62:330` |
| 4 | `15133eac-56b7-4adf-b195-886443dffd11` | `03373177-ae8e-4363-8136-a4d67b148e25:405` |
| 5 | `a7770cf4-ef94-41f8-8f18-d873330abe0a` | `12a99627-7e1b-4708-91bb-8e68f24702ea:500` |
| 6 | `31a5edd0-9e96-44c9-b0a2-dedc9b3f7886` | `b22cfaa1-e5f9-41a3-bc31-544dfe359b62:589` |
| 7 | `1ea2c438-e366-4e0c-9719-08a3fb87965b` | `d6790099-5521-4959-b34e-dab251eaee6e:660` |
| 8 | `e55fc284-5811-46ef-a3c4-c9482b9cccd8` | `42c3f46c-58ee-4123-bc7d-3accadb65da0:745` |
| 9 | `99505aea-7547-4bbf-879c-c792c47fd15b` | `c453cbb0-b0f8-4da2-bf5d-c99715268f9a:812` |
| 10 | `618a04ea-744c-4c85-a9e6-6f93a8e9d31e` | `a18591e7-0f68-4be4-a993-937fa6e28b03:877` |

## Local evidence

- [Final snapshot](../data/live-five-minute-v0/snapshot.json)
- [Canonical history](../data/live-five-minute-v0/history.json)
- [Qualification audit](../data/live-five-minute-v0/qualification.json)
- [Institutional SQLite](../data/live-five-minute-v0/biojev.sqlite)
- [Pi runtime SQLite](../data/live-five-minute-v0/pi.sqlite)

Runtime stores, receipts, catalog snapshots, artifacts and logs are under data/live-five-minute-v0 and remain ignored by Git. Credentials were not copied into the report.

At the time of this run, the next task was to fix memory search and handoff retrieval. That follow-up is now implemented and qualified by the [fast 25-block regression](IMPLEMENTATION_PLAN.md#fast-retrieval-and-handoff-regression-qualification). The live-run history and its errors remain unchanged.
