# Agentic coding feedback loop

The repository must give coding agents fast, local, machine-readable correction.

Preferred loop:

```text
small edit
-> @effect/tsgo diagnostics
-> architecture boundary check
-> Biome
-> targeted tests
-> fix
-> repeat
```

Before completion:

```text
npm run check
```

## Effect tsgo

Use `@effect/tsgo`, not standalone tsgo in parallel.

Important diagnostics include:
- floatingEffect
- missingEffectContext
- missingEffectError
- missingLayerContext
- missingEffectServiceDependency
- genericEffectServices
- unsafeEffectTypeAssertion
- duplicatePackage
- unstableApiUsage
- experimentalApiUsage
- tryCatchInEffectGen
- missingStarInYieldEffectGen
- runEffectInsideEffect

Tune severity from real experience. Keep correctness/authority rules strict.

## Architecture boundary checker

`tooling/check-boundaries.mjs` should catch:
- Pi imports outside `agent-runtime`
- TypeSafe imports outside `jevengine`
- raw Node filesystem/process/path in BioJev application code
- direct Effect SQL provider imports outside BioLab/platform
- process.env outside config
- Effect runners inside normal application code
- raw backend fetch
- process execution outside ExecutionEnv/platform

When a rule stabilizes, move it to a Biome custom rule if the installed version supports it cleanly.

## General rule

A repeated coding-agent mistake should become, in order:
1. better abstraction;
2. type-level impossibility;
3. lint/boundary rule;
4. invariant test;
5. only then a larger prompt.
