# Canonical state

- `main` on github.com/Daemon22/Lycon is the single source of truth. It is the only branch.
- The Manus-managed copy (lycon-ish2tt9p.manus.space, commit 259c067) is NOT canonical. Its history is archived in tags `archive/manus-*`. Never copy or rsync a Manus snapshot over this tree; port changes by diff.
- No force-push to main and no rebasing main. Fix forward with new commits.
- Rollback point: tag `stable/2026-10-24-green` (fresh clone installs, type-checks, passes all tests, builds).
- Before merging anything: `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm build`.
