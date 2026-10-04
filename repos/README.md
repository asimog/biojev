# Read-only dependency source

These are tracked, squashed Git subtrees from each upstream main branch:

| Directory | Upstream | Imported commit |
| --- | --- | --- |
| effect | https://github.com/Effect-TS/effect | 073bb475d |
| pi | https://github.com/earendil-works/pi | 2e63fcdfbf |
| typesafe | https://github.com/typesafe-ai/typesafe-sdk-js | 66880ccded |

They are reference source, not nested clones or production dependencies.
Production code must never import from `repos/**`. Installed package versions
remain the actual dependency contract; upstream main can differ from them.

For Effect work, read `repos/effect/LLMS.md` and inspect relevant source/tests.

To update a subtree, run the corresponding command from the repository root:

```bash
git subtree pull --prefix=repos/effect https://github.com/Effect-TS/effect.git main --squash
git subtree pull --prefix=repos/pi https://github.com/earendil-works/pi.git main --squash
git subtree pull --prefix=repos/typesafe https://github.com/typesafe-ai/typesafe-sdk-js.git main --squash
```

The initial bootstrap deferred these imports because no baseline commit existed.
The user's follow-up authorized installation; a local baseline and subtree
commits were then created. Nothing has been pushed to GitHub.
