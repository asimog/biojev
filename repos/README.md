# Read-only dependency source

These are tracked, squashed Git subtrees from each upstream main branch:

| Directory | Upstream | Imported commit |
| --- | --- | --- |
| effect | https://github.com/Effect-TS/effect | 073bb475d |
| typesafe | https://github.com/typesafe-ai/typesafe-sdk-js | 66880ccded |

They are reference source, not nested clones or production dependencies.
Production code must never import from `repos/**`. Installed package versions
remain the actual dependency contract; upstream main can differ from them.

For Effect work, follow AGENTS.md: read the complete installed guide first,
then use `repos/effect/LLMS.md` and relevant source/tests as additional reference.

To update a subtree, run the corresponding command from the repository root:

```bash
git subtree pull --prefix=repos/effect https://github.com/Effect-TS/effect.git main --squash
git subtree pull --prefix=repos/typesafe https://github.com/typesafe-ai/typesafe-sdk-js.git main --squash
```

Pi is intentionally not vendored. Its runtime, Durable, tools, and model APIs are imported from npm packages only inside apps/biojev/platform/pi.
Read installed Pi documentation/source rather than creating another subtree or
copying upstream implementation into the platform folder.

Application authority and layout follow specs/architecture/CONSTITUTION.md
and specs/guides/REPOSITORY.md; upstream reference folders retain upstream docs.
