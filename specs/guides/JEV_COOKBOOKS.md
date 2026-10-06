# Jev cookbook patterns for autonomous research

These optional recipes adapt the current [TypeSafe cookbook index](https://docs.typesafe.ai/cookbooks).
They are available to Director, Researcher and Validator through versioned
Noul/Choice/Score questions, structured state/instructions and native question
batches. Agents choose when and how to compose them; the application does not
install a mandatory scientific loop or copy the cookbook's demonstration domain.

| Upstream example | BioJev use and authority constraint |
| --- | --- |
| [Noul consistency](https://docs.typesafe.ai/cookbooks/consistency_noul_cookbook) | Compare question formulations; retain distributions and uncertainty. No new human approval gate. |
| [Choice consistency](https://docs.typesafe.ai/cookbooks/consistency_choice_cookbook) | Compare independent formulations and alternatives; agent interprets disagreement. |
| [Parallel questions](https://docs.typesafe.ai/cookbooks/parallel_questions) | Ask independent questions against one projection in one native batch. |
| [Reranking](https://docs.typesafe.ai/cookbooks/rerank_typesafe) | Annotate broadly retrieved candidates and reorder a view; retain candidates and original identities. |
| [Semantic find](https://docs.typesafe.ai/cookbooks/semantic_find) | Ask about identified passages with an answerability check; retain exact passage references. |
| [Structure recovery](https://docs.typesafe.ai/cookbooks/autoformat) | Classify text spans and proposed structure; preserve original input and transformation artifacts. |
| [Function calling](https://docs.typesafe.ai/cookbooks/function_calling) | Measure fit to tool names/arguments; Pi agent chooses an authorized tool, never Jev directly executing code. |
| [Skill suggestion](https://docs.typesafe.ai/cookbooks/skill_suggestion) | Compare discovered abilities; suggestion is not qualification, installation or activation. |
| [Entity alignment](https://docs.typesafe.ai/cookbooks/entity_alignment) | Compare candidate pairs and disagreement dimensions without silently merging immutable identities. |
| [RAG passage classification](https://docs.typesafe.ai/cookbooks/classifying_rag_passages) | Annotate relevance/support of source-local search results; selection remains agent judgment. |
| [Citation checking](https://docs.typesafe.ai/cookbooks/citation_check) | Compare claims with actual source passages; semantic support is not scientific replication. |
| [Guardrails](https://docs.typesafe.ai/cookbooks/llm_guardrails) | Measure concerns; authority, provenance and isolation are enforced structurally, never granted by a model score. |
| [Extraction cascade](https://docs.typesafe.ai/cookbooks/sde_cascade) | Agent may compare representations/models and verify proposed extraction using actual input. |
| [Date extraction](https://docs.typesafe.ai/cookbooks/date_extraction_cookbook) | Select supported date concepts; resolve/validate in computation and preserve missingness. |
| [Pre-parsed extraction](https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook) | Generate exact spans with computation; ask Jev to compare them; preserve original span provenance. |
| [Hierarchical classification](https://docs.typesafe.ai/cookbooks/hierarchical_classification) | Explore an agent-chosen hierarchy; no mandatory ontology, beam width or pruning policy in Core. |
| [Autoresearch feature discovery](https://docs.typesafe.ai/cookbooks/autoresearch_feature_discovery) | Agent proposes/revises questions, derives numeric features, computes predictive performance and learns from empirical errors. |
| [Confidence-aware classification](https://docs.typesafe.ai/cookbooks/classification_using_confidence) | Inspect distributions/confidence and broader labels; no scientific action threshold is built into JevEngine. |

## Feature discovery and further expansion

For autoresearch, an agent may propose questions, batch their measurements,
transform Noul probabilities or Score distributions into feature columns, fit a
model inside Pi's environment, and compare obtained performance. If it uses
held-out evaluation, keep that split outside proposal feedback and record the
actual program, artifacts and split identity. The agent chooses whether to add,
revise or stop using a question. No CatBoost dependency, wine dataset, five-round
loop, universal rubric or automatic feature selection is encoded in BioJev.

Useful further compositions include representation comparisons, contradictory
claim analysis, negative-result retrieval, capability gaps and method-fit
comparisons. These use the same general primitive interface rather than one
service/tool per recipe. ScientificResult records real computed outcomes;
SemanticMeasurement records Jev judgments; Interpretation explains agent belief.

## Operational limits

measure_semantics_batch accepts 1–64 independently versioned questions sharing
one projected state. Larger candidate collections require agent-chosen bounded
batches, not silently truncated recall. A request is bounded at one MiB and a
response at four MiB. Each retained question has its own identity and validated
answer, while batchId, inputHash, provider receipt and provider usage describe the shared
request. Tool results include deterministic semantic feature columns for optional
empirical feature-discovery work. Do not count the same request usage independently for each answer.

Cookbooks are examples, not institutional policy. Do not import their automatic
threshold routing, universal weighted scores or fixed scientific loops into Core.
