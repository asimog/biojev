# BioJev authority constitution

## Fundamental rule

> Access does not imply authority.

No component gains another component's authority because it can access the same information or tools.

Examples:
- Researcher sees a result != Researcher controls global strategy.
- Director can execute code != Director performs whole ResearchBlocks by default.
- Jev returns high confidence != Jev chooses the next experiment.
- Pi stores transcript/tool state != transcript becomes institutional scientific history.
- UI displays a hypothesis != UI becomes canonical state.
- Schema validation succeeds != caller is authorized to create the record.

## Authorities

### Strategic authority — Director

Owns:
- global research direction
- next ResearchObjective
- continue / branch / replicate / revisit / defer / abandon decisions
- cross-block prioritization
- response to Validator
- capability strategy/defaults where authorized

### Local research authority — Researcher

Owns inside one ResearchBlock:
- search strategy
- action ordering
- representation
- method
- code/tool choice
- hypothesis generation
- Jev use
- literature use
- computation
- change/abandon/follow-up decisions

### Validation authority — Validator

Owns independent critique of the exact validation window.

Does not redirect the institution directly.

### Semantic measurement authority — JevEngine

Owns typed semantic measurements.

Does not decide actions.

### Canonical state authority — BioLab

Owns what BioJev institutionally knows happened.

### Computation boundary — ExecutionEnv

Provides actual process/network/filesystem operations inside isolation.

Has no scientific decision authority.

### Runtime cognition — Pi Durable

Runs agent cognition and durable tool tasks.

Has no institutional scientific authority itself.

### Application mechanics — Effect

Owns/supports:
- resource acquisition/release
- typed failures
- configuration
- SQLite lifetime
- Pi harness lifetime
- Jev client lifetime
- HTTP/SSE
- timeouts
- retries
- startup/shutdown
- scheduler lifetime

Effect has no scientific authority.

## Authority matrix

| Component | Reasons? | Global direction | Local method | Executes | SemanticMeasurement | ScientificResult | Canonical writes |
|---|---|---:|---:|---:|---:|---:|---:|
| Director | yes | yes | no | yes, if useful | via Jev | only through attributable recording path | through authorized BioLab tools |
| Researcher | yes | no | yes | yes | via Jev | only through attributable recording path | through authorized BioLab tools |
| Validator | yes | advisory | own validation method | yes | via Jev | reproduction/check results through same path | validation/BioLab tools |
| JevEngine | no autonomous loop | no | no | no | yes | no | SemanticMeasurement via BioLab |
| ExecutionEnv | no | no | no | yes | no | no by itself | no |
| BioLab | no | no | no | no | no | persists attributable results | yes |
| Core | no scientific reasoning | no | no | no | no | no | lifecycle transitions only |
| Effect | no | no | no | infrastructure only | no | no | infrastructure only |
| Pi Durable | runs cognition | no | no | runs tools | no | no | runtime DB only |
| Next.js | no | human commands only | no | no | no | no | explicit API commands only |

## Final rules

1. Director decides what to investigate.
2. Researcher decides how to investigate it.
3. Validator critiques; Director decides what follows.
4. Jev measures semantics; agents decide consequences.
5. BioLab is sole institutional memory authority.
6. Pi owns runtime cognition, not scientific history.
7. ExecutionEnv provides computation, not research authority.
8. Schema shape does not confer creation authority.
9. ScientificResult is distinct from Interpretation.
10. Missing is not zero.
11. Negative and contradictory results remain history.
12. No fixed scientific choreography.
13. No domain-specific pipeline in Core.
14. No subagents.
15. Every ResearchBlock gets a fresh Researcher.
16. Every ValidationCycle gets a fresh Validator.
17. Validation occurs after ten countable ResearchBlocks.
18. Effect manages application mechanics; Pi manages agents.
19. Next.js observes real Pi/BioLab state; it never becomes authority.
20. Strong institutional boundaries; weak cognitive choreography.
