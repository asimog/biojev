# BioJev architecture

## Purpose

BioJev is an autonomous computational biology research institution.

A human supplies a broad mission. BioJev decides how to investigate it and keeps institutional learning over time.

## High-level ownership

```text
core
    controls what is legally allowed to run next

agents
    decide what and how

BioLab
    remembers and owns capability history

JevEngine
    measures semantic questions

AgentRuntime
    runs cognition through Pi Durable

ExecutionEnv
    gives agents controlled computation
```

There is no separate execution/science subsystem.

## Authority rule

> Access does not imply authority.

Examples:
- Researcher can see a result but does not own global strategy.
- Director can execute code but does not become the Researcher for a whole block.
- Jev can return high confidence but does not choose the next experiment.
- Pi can store transcripts but does not own institutional scientific history.
- UI can display a hypothesis but does not make it canonical.

## Effect model

BioJev follows:

```text
pure function
    deterministic transformations

Effect program
    dependencies + failures + async + resource lifetime

Effect Service
    genuine capability

Layer
    concrete implementation
```

Likely initial high-value Services:
- BioLab
- JevEngine
- AgentRuntime
- ExecutionEnv

Do not create a service for every domain noun.

## Bitter Lesson

Strongly constrain:
- authority
- state ownership
- persistence
- provenance
- lifecycle
- execution isolation
- validation cadence
- recovery

Weakly constrain:
- scientific strategy
- source choice
- representation
- method
- programming language
- tool choice
- hypothesis path
- Jev usage

Rule:

> Strong institutional boundaries. Weak scientific choreography.

## Durable ownership

`data/biojev.sqlite`
- canonical institutional state

`data/pi-runtime.sqlite`
- Pi runtime cognition state

Pi state is not BioLab state.

## Canonical loop

```text
Human
  -> Director
  -> ResearchObjective
  -> fresh Researcher in ResearchBlock
  -> ResearchDossier + canonical BioLab records
  -> Director
  -> next ResearchObjective
```

Every ten countable blocks:

```text
ResearchBlock 10
  -> fresh Validator
  -> ValidationReport
  -> Director MUST review
  -> ResearchBlock 11
```

No subagents.
