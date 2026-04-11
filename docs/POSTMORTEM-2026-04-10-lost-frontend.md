# Post-mortem: frontend migration source lost during history rewrite

**Date:** 2026-04-10
**Severity:** High — committed source drifted from live production
**Resolution:** Frontend reconstructed from scratch based on Express API docs
**Status:** Resolved (landed in commit 218e6bd via PR #12)

## Summary

During a security cleanup session, a `git filter-repo` run silently discarded
uncommitted working-tree changes. Those changes were the **only** copy of the
frontend migration from Supabase → Express API. The committed code after the
rewrite no longer matched what was actually running in production. The live
Hostinger bundle kept working (because it was built and deployed before the
rewrite), but any new build from the repo produced a broken Supabase-based
version.

This was caught three hours later when a security audit grepped for leaked
credentials and found `import { supabase } from ...` in the source — a
clear contradiction with the live bundle, which contained `api.agenciaeverline`.

## Timeline

All times 2026-04-10 Brasília (GMT-3).

| Time  | What happened |
|-------|---------------|
| ~13:00 | User (pre-session) had a working tree with the Express frontend migration applied on top of a revert commit (`653c945 Reverted to commit 35aee...`). Those changes were **uncommitted**. User built the frontend, uploaded `dist/` to Hostinger via tar-over-ssh. Production now serves the Express version. |
| ~14:21 | Session starts. I run `git status` — it shows ~42 files as modified/deleted/added, including `src/App.tsx`, `src/contexts/AuthContext.tsx`, `src/pages/Login.tsx`, `src/pages/Panel.tsx`, admin tabs, etc. These are the uncommitted migration changes. |
| 17:40 | I start committing things. First: the backend — `api/` directory gets staged and committed as `702a4fa feat(backend): migrate from Supabase to Node/Express API`. But the frontend migration files in `src/` stay unstaged. |
| 17:42 | I do `git stash push -u` trying to isolate unrelated changes for a clean security commit. The stash is popped cleanly shortly after. |
| 18:22 | I run `git filter-repo --replace-text /tmp/everline-secret-purge.txt` to purge leaked credentials from history. filter-repo rewrites 915 commits, repacks the object store, and runs `git reset --hard` to sync the working tree with the new HEAD. **The uncommitted frontend migration files are silently overwritten with the reverted-commit version.** |
| 18:22 | I check `git status` — expect to see the uncommitted changes I knew about. Instead I see only 16 untracked files. I don't notice that the ~26 previously-modified files are gone, because the ones I was actively working on (`DEPLOY.md`, `docker-compose.yml`) are clean. I assume the stash-pop "merged cleanly" and move on. |
| ~19:30 | I go through CI setup, Dependabot, PG user hardening, branch protection — several hours of work, all building on top of a broken source tree. |
| ~20:40 | User asks for a security audit ("dá uma geral") before making the repo public. |
| ~20:50 | I grep source for leaked strings and find zero secrets but spot `import { supabase }` in 8 files. Cross-check with the live bundle → live has `/auth/login`, source has `signInWithPassword`. They don't match. |
| ~21:00 | I search every recovery avenue locally (VSCode history, Time Machine, trash, Cursor history, APFS snapshots). All empty. The filter-repo backup I'd made earlier in `/tmp` had been cleaned up. |
| ~21:30 | User confirms no external backup. I reconstruct the 8 frontend files from scratch using the Express API contract I'd already documented in `docs/API.md`. |
| 22:30 | PR #12 opens, CI passes, merged as 218e6bd. Build output verified: contains `/auth/login`, zero `supabase` references. Bundle size drops from 1184KB → 986KB. |

## Root cause

**`git filter-repo` runs `git reset --hard HEAD` after rewriting history,
and I ran it while there were uncommitted working-tree changes I cared
about.**

The reset was a quiet side-effect of filter-repo's repack step. There was
no warning, no abort-on-dirty-tree check, no staging of what was lost.
From git-filter-repo's perspective, everything worked: the history was
rewritten, the working tree was synced. From my perspective, 26 files
silently reverted to an older version with no indication anything was gone.

The files were never in any commit, any stash, any reflog, or any
filter-repo intermediate. They existed only in the working tree, and the
working tree got hard-reset to HEAD.

## Contributing factors

1. **Lovable's "revert commit" pattern.** The previous HEAD was literally a
   revert of the frontend migration (`653c945 Reverted to commit 35aee...`).
   So the user's workflow was: revert commit lands in git → re-apply migration
   in working tree → build from working tree → deploy. This leaves the live
   build strictly ahead of any committed state, and makes the working tree
   the only source of truth. Fragile by design.

2. **I committed a subset before the rewrite.** When I committed
   `702a4fa feat(backend): migrate from Supabase to Node/Express API`, I
   only staged the *backend* files (`api/`, `src/lib/api.ts`,
   `src/components/ErrorBoundary.tsx`). The frontend migration files were
   in the same working tree but I missed them. A single
   `git add -A` would have saved the whole thing.

3. **I didn't read git-filter-repo's docs before running it.** I knew it
   rewrote history; I didn't know it hard-resets the working tree. Running
   a destructive tool without reading its man page is on me.

4. **I only backed up `.git/`, not the whole directory.** Earlier in the
   session I ran `cp -r .git /tmp/everline-git-backup-$(date +%s)` as a
   safety net. But the working tree files aren't in `.git/` — they're on
   disk next to it. The backup was useless for recovering uncommitted
   changes.

5. **The `/tmp` backup got auto-cleaned.** I deleted the `.git/` backup
   earlier in the session when I thought everything was stable, *before*
   discovering the loss. Even the partial safety net was gone by the time
   I needed it.

6. **I didn't verify working-tree state after the rewrite.** `git status`
   showed fewer modified files than before, but I didn't notice because
   the files I was actively thinking about at that moment (DEPLOY.md,
   docker-compose.yml) were all clean. I should have diffed the full file
   list against the pre-rewrite state.

## Prevention

Concrete rules I'm committing to. These live in my working memory for
this project and will apply to any similar situation going forward.

### Never run history-rewriting tools with uncommitted work

Before `git filter-repo`, `git filter-branch`, `git rebase -i`, any force
push, or any `git reset --hard`:

```bash
git status --short | wc -l
# must be 0
git stash list
# must be empty (stashes count as "uncommitted work")
```

If either is non-zero, stop. Commit the uncommitted work (even as a
throwaway WIP commit) before running the destructive operation. You can
always reset back to the commit boundary after, and the commit is a hard
checkpoint that no tool can accidentally erase.

### Back up the whole working directory, not just `.git/`

```bash
# Good
tar czf ~/backups/everline-pre-rewrite-$(date +%Y%m%d-%H%M%S).tar.gz \
  -C ~/Documents/backup-cc Everline

# Bad (what I did)
cp -r .git /tmp/everline-git-backup-$(date +%s)
```

The `.git/` backup is only useful if the files you care about are in a
commit, stash, or reflog. Working-tree-only changes need the full directory.

### Don't delete backups until the change is verified end-to-end

"Verified end-to-end" = builds cleanly, tests pass, AND the artifact actually
produces the same output as before (diff the built bundle, not just the
source). Deleting a backup based on `git status --short` being empty is not
verification — it's the same check that missed the loss in the first place.

### Diff against the expected state, not just against HEAD

After a history rewrite, `git diff HEAD` reports nothing if the rewrite did
a hard reset. That's the failure mode. Instead, diff against a known-good
reference — another clone, a tag, a backup tarball:

```bash
tar tzf ~/backups/everline-pre-rewrite.tar.gz > /tmp/expected-files.txt
(cd ~/Documents/backup-cc && find Everline -type f | sort) > /tmp/actual-files.txt
diff /tmp/expected-files.txt /tmp/actual-files.txt
```

### If a file is precious and uncommitted, commit it *first*, full stop

Uncommitted work is radioactive. It doesn't matter how obvious the plan
is or how careful you intend to be — a single `git reset --hard` from any
tool will erase it forever. Commit first, rebase/clean up later. The cost
of an extra WIP commit is zero; the cost of losing the work is hours of
reconstruction from reverse-engineered minified JS.

## What went right

A few things worked and are worth keeping:

- **Live production stayed up the whole time.** The deployed bundle was
  self-contained; the API and DB were never at risk.
- **I documented the Express API (`docs/API.md`) *before* discovering the
  loss.** That doc turned out to be the only complete spec of the
  endpoints — it made reconstruction straightforward.
- **The CI pipeline caught the PR in under a minute.** Typecheck and build
  both passed on the reconstruction before merge.
- **Branch protection held.** The ruleset (added earlier that evening)
  refused the direct push to main and forced the change through a PR +
  CI pipeline. Zero temptation to "just push and see."
- **The audit was paranoid enough to catch the inconsistency.** The user's
  "dá uma geral" request prompted the grep that surfaced `import { supabase }`
  in source vs `/auth/login` in the live bundle. Without that audit I would
  have published a broken repo.

## Open questions / follow-ups

- **Was there more than the 8 files I caught?** I grepped for `supabase`
  and `@supabase` but something could import from the reconstructed API
  incorrectly. The build + typecheck + live smoke test should catch it,
  but it's worth a second look during the deploy validation.
- **Should we add a `CHECK.md` pre-deploy script?** A little shell script
  that: (a) verifies `git status` is clean, (b) runs typecheck, (c) runs
  build, (d) greps the built bundle for expected API references, (e) exits
  non-zero if anything's off. Would make pre-deploy validation mechanical.
- **Should `api/db/dumps/` and working-tree snapshots be backed up off-machine?**
  Currently there's zero off-machine backup of uncommitted work. A periodic
  `tar + upload to object storage` cron would catch similar situations.
