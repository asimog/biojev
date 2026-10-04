# Repository guide

BioJev does not use `src/` directories.

Target:

```text
apps/biojev/
  main.ts
  core/
  agents/
  agent-runtime/
  biolab/
  execution-env/
  jevengine/
  platform/
  config/
  http/
  test/

apps/web/
  app/
  components/
  lib/

tooling/
specs/
repos/
data/
```

Execution code belongs under `execution-env/`; do not create a second execution subsystem.

`repos/**` is read-only reference source and is never imported by production code.

`data/**` is runtime state and is gitignored except placeholder directories.

Use one root npm lockfile.

Do not add `packages/*` until there is a real shared package with two real consumers.
