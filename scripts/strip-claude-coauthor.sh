#!/usr/bin/env bash
# Rewrites every commit's message to strip `Co-Authored-By:` trailers that
# reference Claude / anthropic.com, then trims any trailing blank lines the
# removal leaves behind. Uses git filter-branch (built in) so no extra tooling
# is required.
#
# THIS REWRITES HISTORY. Every commit SHA on every branch/tag will change.
# The remote is NOT touched — you have to `git push --force-with-lease` yourself
# after reviewing the result.

set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "error: working tree or index is dirty. Commit or stash first." >&2
  exit 1
fi

if [ -n "$(git ls-files --others --exclude-standard)" ]; then
  echo "warning: you have untracked files. They won't be touched, but review before proceeding." >&2
fi

current_branch=$(git symbolic-ref --quiet --short HEAD || echo "DETACHED")
current_head=$(git rev-parse HEAD)
backup_ref="refs/heads/backup/pre-strip-claude-$(git rev-parse --short HEAD)"

echo "current branch : $current_branch"
echo "current HEAD   : $current_head"
echo "backup branch  : ${backup_ref#refs/heads/}"
echo

# Save a local backup branch so a plain `git reset --hard <backup>` restores state.
git update-ref "$backup_ref" HEAD
echo "backup saved to $backup_ref"

# If a previous filter-branch left refs/original/ around, clear it — otherwise
# filter-branch refuses to run.
if git for-each-ref --format='%(refname)' refs/original/ | grep -q .; then
  echo "clearing stale refs/original/ from a previous filter-branch run"
  git for-each-ref --format='%(refname)' refs/original/ \
    | xargs -n 1 git update-ref -d
fi

export FILTER_BRANCH_SQUELCH_WARNING=1

# --msg-filter reads the commit message on stdin, writes the rewritten one on
# stdout. sed drops matching Co-Authored-By lines; awk trims trailing blanks.
git filter-branch -f --msg-filter '
  sed -E "/^[Cc]o-[Aa]uthored-[Bb]y:.*([Cc]laude|anthropic\.com).*$/d" \
  | awk "
      { lines[NR] = \$0 }
      END {
        last = 0
        for (i = 1; i <= NR; i++)
          if (lines[i] !~ /^[[:space:]]*\$/) last = i
        for (i = 1; i <= last; i++) print lines[i]
      }
    "
' -- --all

# filter-branch stashes the pre-rewrite refs under refs/original/. Drop them so
# `git log` isn't polluted; the backup branch above is enough to roll back.
if git for-each-ref --format='%(refname)' refs/original/ | grep -q .; then
  git for-each-ref --format='%(refname)' refs/original/ \
    | xargs -n 1 git update-ref -d
fi

echo
echo "done. verify with:"
echo "  git log --all --format='%H %an <%ae>%n%b%n---' | grep -iE 'claude|anthropic' || echo clean"
echo
echo "if it looks right, publish with:"
echo "  git push --force-with-lease --all"
echo "  git push --force-with-lease --tags"
echo
echo "to roll back:"
echo "  git reset --hard ${backup_ref#refs/heads/}"
