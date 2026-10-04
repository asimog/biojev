# BioLab specification

BioLab is the sole canonical institutional state authority.

It is also BioJev's durable memory and capability history.

BioLab does not execute code. ExecutionEnv does.

## Canonical vocabulary

Add records only when a real vertical path requires them.

Core vocabulary:
- Mission
- MissionRevision
- AgentRun
- DirectorDecision
- ResearchObjective
- ResearchBlock
- ResearchDossier
- ScientificResult
- Interpretation
- Hypothesis
- HypothesisRevision
- ResultAssessment
- Failure
- Uncertainty
- Capability
- CapabilityVersion
- CapabilityAssessment
- SemanticMeasurement
- ValidationCycle
- ValidationReport

## Domain operations, not generic CRUD

Do not expose:
- `save(record)`
- `update(type, id, data)`
- `query(sql)`

Expose domain intent, for example:
- `searchMemory(...)`
- `inspect(...)`
- `recordScientificResult(...)`
- `recordInterpretation(...)`
- `recordResultAssessment(...)`
- `reviseHypothesis(...)`
- `searchCapabilities(...)`
- `registerCapabilityVersion(...)`
- `recordCapabilityAssessment(...)`
- `activateCapabilityVersion(...)`
- `recordResearchDossier(...)`
- `recordValidationReport(...)`

## One owner per truth

Examples:

```text
DirectorDecision
  authored by Director
  persisted by BioLab

ResearchDossier
  authored by Researcher
  persisted by BioLab

ValidationReport
  authored by Validator
  persisted by BioLab

SemanticMeasurement
  created by JevEngine
  persisted by BioLab

ScientificResult
  attributable to real execution/source retrieval
  persisted by BioLab

Pi transcript/tool state
  owned by Pi Durable
```

No duplicate authoritative copies.

## ScientificResult

ScientificResult means:

> An attributable result actually obtained from computation or verifiable structured-source retrieval.

It can refer to:
- origin run/block;
- execution receipt;
- command/tool/capability identity;
- inputs;
- source refs;
- parameters;
- runtime/environment identity;
- output artifact refs;
- useful stdout/stderr summary;
- missingness.

It does not mean:
- true;
- important;
- replicated;
- statistically significant;
- causal;
- novel;
- biologically meaningful.

Those belong to Interpretation and ResultAssessment.

## Schema does not confer authority

A value passing an Effect Schema means its shape is valid.

It does not mean the caller is permitted to create canonical history.

Therefore:

```text
valid structure
  != valid provenance
  != valid authority
```

BioLab must verify the authorized creation path.

## Missingness

Keep these distinct:
- zero
- false
- negative result
- not measured
- unavailable
- unknown
- missing

Never silently transform missingness into zero/no-effect/negative.

## Negative history

Preserve:
- positive
- negative
- null
- contradictory
- failed replication
- unexpected findings

## Director capability learning

Director must be able to learn from capability outcomes across blocks.

Authorized Director BioLab operations include:
- search capability history;
- inspect active/older versions;
- record CapabilityAssessment;
- register a new or revised CapabilityVersion when justified;
- activate a qualified version;
- roll strategy toward a different capability;
- create a ResearchObjective specifically to discover/build/qualify missing capability.

The Director must not be limited to the original capability portfolio.
