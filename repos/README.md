# Read-only dependency source

These are tracked, squashed Git subtrees from each upstream main branch:

| Directory | Upstream | Imported commit |
| --- | --- | --- |
| effect | https://github.com/Effect-TS/effect | 073bb475d |
| typesafe | https://github.com/typesafe-ai/typesafe-sdk-js | 66880ccded |

These two directories are tracked subtrees, not production dependencies.
Production code must never import from `repos/**`. Installed package versions
remain the actual dependency contract; upstream main can differ from them.

For Effect work, follow AGENTS.md: read the complete installed guide first,
then use `repos/effect/LLMS.md` and relevant source/tests as additional reference.

To update a subtree, run the corresponding command from the repository root:

```bash
git subtree pull --prefix=repos/effect https://github.com/Effect-TS/effect.git main --squash
git subtree pull --prefix=repos/typesafe https://github.com/typesafe-ai/typesafe-sdk-js.git main --squash
```

Pi has a user-requested, Git-ignored local reference clone at `repos/pi`:

```bash
git clone https://github.com/earendil-works/pi.git repos/pi
```

The reviewed upstream commit is `28dcce2ba45ce4a9efeb0f5b686f0be830fd89b9`
(Pi 1.0.4); installed BioJev packages are pinned at 1.0.4. This clone is
neither a tracked subtree nor a runtime dependency. Pi runtime, tools, and model
APIs are imported from npm only inside apps/biojev/platform/pi. Never copy
upstream implementation into that folder. See the compatibility review in
specs/architecture/PI_COMPATIBILITY.md before upgrading.

Application authority and layout follow specs/architecture/CONSTITUTION.md
and specs/guides/REPOSITORY.md; upstream reference folders retain upstream docs.
