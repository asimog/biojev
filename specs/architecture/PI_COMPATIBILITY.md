# Pi Durable compatibility contract

Pi Durable is BioJev's cognition runtime.

It is not the canonical research database and it is not the scientific authority model.

## Pi owns

- conversation history
- model turns
- tool calls
- durable Pi tool tasks
- compaction
- provider session state
- resume state
- runtime cancellation
- usage
- live runtime state

## BioJev owns

- mission lifecycle
- role authority
- ResearchBlock identity
- ten-minute block policy
- validation barrier
- BioLab canonical state
- ExecutionEnv isolation policy
- application lifetime
- UI/API surface

## Adapter boundary

Only `agent-runtime/**` may import Pi/Chord packages.

Pi types do not leak into:
- core
- agents
- BioLab
- ExecutionEnv
- JevEngine

## Role lifetime

Director:
- may use one mission-persistent conversation.

Researcher:
- fresh conversation for every new ResearchBlock.

Validator:
- fresh conversation for every ValidationCycle.

No subagents.

## Timeout rule

A cancelled wait must not be assumed to cancel durable underlying work.

ResearchBlock timeout sequence must be:

```text
deadline
-> AgentRuntime.abort(conversation)
-> confirm Pi work is terminal/idle
-> stop/clean owned ExecutionEnv work
-> finalize block TIMED_OUT
```

Verify exact behavior against the installed Pi version.

## Pi tool calls and canonical writes

Pi tool state is runtime state.

A Pi tool call that executes real work must return an attributable execution/source receipt.

An authorized BioLab tool can then create ScientificResult from that receipt.

Pi transcript or tool output alone does not become ScientificResult.

## Live UI

Pi may supply live noncanonical activity.

BioLab supplies durable institutional history.

UI can combine both but must not confuse them.

## Installed 1.0.2 verification (2026-10-05)

Verified against the installed pi-durable README and
`dist/harness/harness.js` / `dist/harness/scheduler.d.ts`:
- `submission.wait(context)` cancellation cancels only the wait.
- `conversation.abort(context)` withdraws queued inputs, aborts owned current
  work, and resolves when the conversation is idle.
- `conversation.waitForIdle(context)` provides an explicit idle wait.
- Background tasks survive ordinary abort; `{ background: true }` includes them.
  BioJev must not introduce detached background work or subagents.

Future ResearchBlock timeout must await abort with a cleanup context that has
not already expired, confirm idle, clean ExecutionEnv, then record TIMED_OUT.
No runtime adapter or timeout implementation is added by bootstrap. Tools must
call ExecutionEnv, then authorized BioLab recording operations; raw canonical
SQL is never a Pi tool surface. BioLab and Pi remain separate SQLite owners.
