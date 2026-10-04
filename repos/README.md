# Read-only dependency source

These directories are local, read-only references for coding agents.

Planned:
- `repos/effect` -> https://github.com/Effect-TS/effect
- `repos/pi` -> https://github.com/earendil-works/pi
- `repos/typesafe` -> https://github.com/typesafe-ai/typesafe-sdk-js

Prefer `git subtree ... --squash` after the BioJev repository has a clean initial commit.

Production code must never import from `repos/**`.

When working with Effect:
1. read `repos/effect/LLMS.md`;
2. inspect only the relevant ai-docs/source/tests;
3. use the installed package version as the actual dependency contract.

Bootstrap deferred subtrees: the supplied directory had no Git metadata, and
https://github.com/asimog/biojev had no refs. The checkout is now initialized on
`main` with that origin, without an unsolicited commit or push. After a clean
baseline commit, run from the repository root:

```bash
git subtree add --prefix=repos/effect https://github.com/Effect-TS/effect.git main --squash
git subtree add --prefix=repos/pi https://github.com/earendil-works/pi.git main --squash
git subtree add --prefix=repos/typesafe https://github.com/typesafe-ai/typesafe-sdk-js.git main --squash
```

No nested clones were created. These paths are ignored by default; adjust the
ignore entries when intentionally adding tracked subtrees.
