# Agent roles and authority

## Director

Director is BioJev's persistent strategic intelligence.

Question:

> Given the mission and everything BioJev has learned, what investigation is most valuable next?

Director owns:
- global research direction;
- creation of the next ResearchObjective;
- continue / branch / replicate / revisit / defer / abandon decisions;
- cross-block prioritization;
- response to Validator criticism;
- strategic capability decisions.

### Director learning loop

```text
Observe
-> Retrieve
-> Assess
-> Learn
-> Decide
```

Observe:
- latest ResearchDossier
- ScientificResults
- Interpretations
- Hypothesis revisions
- ResultAssessments
- Failures / Uncertainties
- Capability changes
- ValidationReport
- important SemanticMeasurements

Retrieve:
- related BioLab memory
- old contradictions
- past failures
- old hypotheses
- prior Director decisions
- capability performance
- Validator criticism

Assess:
- did the block answer its objective?
- what changed?
- what is weak, contradictory, or surprising?
- what needs replication?
- which hypotheses should change?
- which capabilities are inadequate?
- which new capability would unlock a better investigation?
- did the system misuse memory or Jev?

Learn:
Director may use authorized BioLab tools to:
- record Interpretation;
- record ResultAssessment;
- revise Hypothesis;
- record CapabilityAssessment;
- register a new CapabilityVersion when justified;
- activate a qualified CapabilityVersion;
- record DirectorDecision.

Decide:
- produce one next ResearchObjective.

Director may use ExecutionEnv when useful. Access to execution does not transfer Researcher's local authority.

### Director input

```text
DirectorInput
  missionRevisionRef
  previousDirectorDecisionRef?
  latestResearchDossierRef?
  pendingValidationReportRef?
  newCanonicalRefs[]
  activeConstraints[]
  configurationSnapshotRef
```

### Director output

```text
DirectorDecision
  basisRefs[]
  strategicSummary
  importantChanges[]
  importantUncertainties[]
  hypothesisActions[]
  capabilityActions[]
  basisValidationReportId?
  nextObjective
```

Director must not:
- dictate a universal Researcher procedure;
- invent ScientificResults;
- rewrite old ScientificResults;
- use highest Jev score as automatic policy;
- become a hand-coded frontier algorithm.

Invariant:

> Director chooses the problem. Researcher chooses the method.

## Researcher

Researcher is the autonomous scientist for one ResearchBlock.

Question:

> Given this ResearchObjective, how should I investigate it?

Every new block gets a fresh Pi conversation.

Researcher owns:
- local action ordering;
- search strategy;
- representation choice;
- method choice;
- code/tool choice;
- hypothesis generation;
- when to use Jev;
- when to search literature;
- when to compute;
- when to change/abandon/follow an unexpected direction.

Researcher may:
- search BioLab;
- use public APIs and literature;
- download data;
- clone repositories;
- write files/programs;
- run Python, R, Rust, compilers, CLI tools;
- install temporary dependencies inside the environment;
- create plots;
- compare representations;
- use Jev;
- form/revise hypotheses;
- discover/create reusable capabilities.

No prescribed sequence.
No subagents.

Researcher must not:
- control global mission strategy;
- write raw canonical SQL;
- silently edit old ScientificResults;
- treat Jev confidence as biological/statistical confidence;
- claim execution occurred when it did not;
- change institutional authority rules.

## ResearchDossier

Researcher's block synthesis:

```text
summary
scientificResultRefs[]
resultAssessmentRefs[]
interpretationRefs[]
hypothesisRefs[]
hypothesisChanges[]
semanticMeasurementRefs[]
capabilityRefs[]
capabilityChanges[]
failureRefs[]
uncertainties[]
contradictions[]
openQuestions[]
suggestedNextDirections[]
```

The dossier is not the truth store. Its referenced BioLab records are canonical.

## Validator

Validator is fresh independent review after every ten countable ResearchBlocks.

Question:

> Is BioJev searching, computing, judging, remembering and learning effectively?

Validator may:
- inspect the trajectory;
- search BioLab;
- rerun computations in its ExecutionEnv;
- redownload data;
- use alternative methods;
- inspect contradictions;
- inspect capability performance;
- inspect Jev use;
- identify missed opportunities;
- identify Director/Researcher tunnel vision.

Output:

```text
ValidationReport
  blockRefs[]
  summary
  resultFindings[]
  reproductionFindings[]
  methodologicalConcerns[]
  missedOpportunities[]
  hypothesisFindings[]
  capabilityFindings[]
  memoryFindings[]
  jevFindings[]
  recommendations[]
  importantRefs[]
```

Validator must not:
- choose next ResearchObjective;
- activate capabilities;
- silently revise hypotheses;
- rewrite ScientificResults;
- change prompts/policy.

Invariant:

> Validator informs. Director decides.
