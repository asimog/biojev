# JevEngine specification

JevEngine is BioJev's fast bounded semantic measurement mechanism.

It is not an autonomous agent.

Rule:

```text
Search
  what possibilities exist?

Jev
  what semantic properties do they appear to have?

Agent
  what should we do?
```

## Owns

- TypeSafe/Jev transport
- Noul / Choice / Score primitives as supported
- question identity/versioning
- projections
- batching
- provider/model identity
- native probability/confidence
- receipts
- result validation

## May measure

- relevance
- similarity
- contradiction
- semantic support
- method fit
- representation suitability
- candidate comparison
- relation between claims
- relation between prior work and current objective

## Must not

- select ResearchObjectives
- launch computation
- accept/discard hypotheses
- activate capabilities
- decide scientific truth
- auto-advance candidates by threshold

Invariant:

> Jev measures. Agents decide.

## SemanticMeasurement

Important judgments may become canonical BioLab records.

They should retain:
- measurement id
- question id/version
- primitive
- subject refs
- projection id/version
- input hash
- provider/model/parameters
- result
- native probability/confidence where applicable
- receipt
- origin run
- creation time

Jev confidence is confidence about a semantic judgment.

It is not statistical or biological confidence.
