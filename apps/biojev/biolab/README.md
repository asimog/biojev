# BioLab

BioLab is the sole canonical institutional state authority.

BioLab is both:
- durable institutional memory;
- the catalog/history of reusable capabilities.

ExecutionEnv has no separate database or capability authority.

## BioLab stores

- Mission / MissionRevision
- AgentRun
- DirectorDecision
- ResearchObjective
- ResearchBlock
- ResearchDossier
- ScientificResult
- Interpretation
- Hypothesis / HypothesisRevision
- ResultAssessment
- Failure / Uncertainty
- Capability / CapabilityVersion / CapabilityAssessment
- SemanticMeasurement
- ValidationCycle / ValidationReport

## BioLab is not generic CRUD

Bad:

```text
save(record)
update(type, id, data)
query(sql)
```

Good:

```text
searchMemory(...)
recordResultAssessment(...)
reviseHypothesis(...)
searchCapabilities(...)
registerCapabilityVersion(...)
recordCapabilityAssessment(...)
activateCapabilityVersion(...)
```

## Director learning

Director can use authorized BioLab tools to:
- search institutional memory;
- inspect prior results and dossiers;
- record result assessments;
- revise hypotheses;
- assess capability performance;
- register/update capability versions when justified;
- activate qualified versions;
- create the next ResearchObjective.

This lets Director learn over blocks without hardcoding a frontier algorithm.

## Researcher learning

Every new ResearchBlock gets a fresh Researcher. Long-term learning comes from BioLab, not inherited Researcher transcript.

## ScientificResult authority

A schema-valid object is not automatically a valid ScientificResult.

BioLab may record a ScientificResult only through an authorized path that can point to attributable execution or verifiable structured-source provenance.

`ScientificResult` means "this attributable operation actually produced this result." It does not mean true, important, replicated, causal, or biologically meaningful.

## Missingness

Missing, unavailable, unknown, not measured, zero, false, and negative result remain distinct.

## Negative history

Negative, null, contradictory, and failed-replication results remain institutional history.
