# Manual setup

Run these commands in WSL from the BioJev repo root.

## 1. Confirm environment

```bash
node --version
npm --version
pwd
git status
```

Node 24 is suitable for current Pi packages that require modern Node.

## 2. Check current package versions

```bash
npm view effect version
npm view @effect/platform-node version
npm view @effect/sql-sqlite-node version
npm view @effect/vitest version
npm view @effect/tsgo version
npm view typescript version
npm view vitest version
npm view @biomejs/biome version
npm view @types/node version

npm view @earendil-works/pi-durable version
npm view @earendil-works/pi-ai version
npm view @earendil-works/chord version

npm view @typesafe-ai/sdk version
```

Also:

```bash
npm view @effect/vitest peerDependencies
npm view @effect/tsgo peerDependencies
npm view @earendil-works/pi-durable engines
```

Reference versions at scaffold creation:
- Effect 4.0.0 family
- @effect/tsgo 0.48.0
- TypeScript 7.0.2
- Pi durable/pi-ai/chord 1.0.2
- TypeSafe SDK 0.6.0

Use the current compatible versions you see.

## 3. Install root dev tools

If the reference versions are still current/compatible:

```bash
npm install --save-dev --save-exact   typescript@7.0.2   @types/node@24   @effect/tsgo@0.48.0   @effect/vitest@4.0.0   vitest@5.0.2   @biomejs/biome
```

Pin exact Biome and Node type versions after checking npm.

## 4. Install backend dependencies

If the versions are still current:

```bash
npm install --workspace=@biojev/backend --save-exact   effect@4.0.0   @effect/platform-node@4.0.0   @effect/sql-sqlite-node@4.0.0   @earendil-works/pi-durable@1.0.2   @earendil-works/pi-ai@1.0.2   @earendil-works/chord@1.0.2   @typesafe-ai/sdk@0.6.0
```

Execution is provided by the existing ExecutionEnv module.

## 5. Configure Effect tsgo

```bash
npx @effect/tsgo setup
```

Use @effect/tsgo as the TypeScript language service.

Do not run standalone tsgo in parallel.

Then:

```bash
npm run check:effect
```

Confirm it checks `apps/biojev/**/*.ts` and does not assume `src/`.

## 6. Check architecture boundaries

```bash
npm run check:boundaries
```

Expected:

```text
BioJev architecture boundaries: OK
```

## 7. Generate Next.js

First:

```bash
npx create-next-app@latest --help
```

Then use current flags for:
- TypeScript
- App Router
- Tailwind
- npm
- no src directory
- Biome if supported

Likely:

```bash
npx create-next-app@latest apps/web   --typescript   --tailwind   --app   --use-npm   --import-alias "@/*"
```

Do not add `--src-dir`.

If asked about a src directory, choose No.

If a nested lockfile appears:

```bash
rm apps/web/package-lock.json
npm install
```

from repo root.

## 8. Add read-only source after a clean commit

```bash
git subtree add   --prefix=repos/effect   https://github.com/Effect-TS/effect.git   main   --squash
```

```bash
git subtree add   --prefix=repos/pi   https://github.com/earendil-works/pi.git   main   --squash
```

```bash
git subtree add   --prefix=repos/typesafe   https://github.com/typesafe-ai/typesafe-sdk-js.git   main   --squash
```

Never import production code from these folders.

## 9. Optional Effect skill

Inspect:

```bash
npx skills add Effect-TS/skills --help
```

Install only the `effect-ts` skill for the coding agents you use.

## 10. Verify

```bash
npm run check:boundaries
npm run check:effect
npm run lint
npm test
npm run typecheck
npm run build
```

Do not implement the real Pi adapter, BioLab schema, ExecutionEnv isolation, or Jev adapter until their dedicated tasks.
