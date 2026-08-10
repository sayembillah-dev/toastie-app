#!/usr/bin/env bash
#
# Runs ON THE VPS. Invoked over SSH by .github/workflows/ci-cd.yml with the git
# SHA being deployed. Expects the release tarball to already be at
# $APP_ROOT/tmp/<sha>.tar.gz and $APP_ROOT/shared/.env to be populated.
#
# Contract: this script either leaves the new release serving traffic, or
# leaves the previous one serving traffic. It never exits with the site down.

set -euo pipefail

readonly APP_ROOT="${APP_ROOT:-/srv/toastly}"
readonly KEEP_RELEASES=5

readonly SHA="${1:?usage: remote-deploy.sh <git-sha>}"
readonly RELEASES="$APP_ROOT/releases"
readonly CURRENT="$APP_ROOT/current"
readonly NEW_RELEASE="$RELEASES/$SHA"
readonly TARBALL="$APP_ROOT/tmp/$SHA.tar.gz"
readonly ECOSYSTEM="$APP_ROOT/shared/ecosystem.config.cjs"

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mFAIL: %s\033[0m\n' "$*" >&2; }

# Physical path of whatever is live right now, for rollback. Empty on first deploy.
PREVIOUS_RELEASE=""
if [ -L "$CURRENT" ]; then
  PREVIOUS_RELEASE="$(readlink -f "$CURRENT")"
fi
readonly PREVIOUS_RELEASE

# ---------------------------------------------------------------- unpack ----

log "Unpacking release $SHA"
[ -f "$TARBALL" ] || { fail "tarball not found: $TARBALL"; exit 1; }

rm -rf "$NEW_RELEASE"
mkdir -p "$NEW_RELEASE"
# -p preserves the symlinks inside the pnpm-deployed node_modules.
tar -xzpf "$TARBALL" -C "$NEW_RELEASE"
rm -f "$TARBALL"

[ -f "$NEW_RELEASE/api/dist/main.js" ]     || { fail "api bundle missing dist/main.js"; exit 1; }
[ -f "$NEW_RELEASE/web/apps/web/server.js" ] || { fail "web bundle missing server.js"; exit 1; }

# The ecosystem file must outlive any single release: PM2 keeps a reference to
# it, and pointing at a path inside a release directory would break the moment
# that release is pruned.
cp "$NEW_RELEASE/ecosystem.config.cjs" "$ECOSYSTEM"

# ------------------------------------------------------------ flip + boot ----

# Atomic: `mv -T` on a symlink is a single rename(2), so no request ever
# observes a missing `current`. `ln -sfn` alone is NOT atomic when the target
# already exists — it unlinks first, leaving a window with no symlink.
log "Pointing current -> releases/$SHA"
ln -sfn "$NEW_RELEASE" "$CURRENT.tmp"
mv -Tf "$CURRENT.tmp" "$CURRENT"

log "Reloading PM2"
# APP_VERSION is what /api/health echoes back, and what the smoke test asserts.
export APP_VERSION="$SHA"
# `startOrReload` re-reads the config, so both apps re-resolve the `current`
# symlink to the new physical path. --update-env propagates APP_VERSION.
pm2 startOrReload "$ECOSYSTEM" --update-env
pm2 save --force >/dev/null 2>&1 || true

# ------------------------------------------------------------- smoke test ----

# Polls rather than sleeps: a fixed sleep is either flaky or slow, and cluster
# workers come up at different speeds under load.
wait_for() {
  local name="$1" url="$2" attempts=30
  for i in $(seq 1 "$attempts"); do
    if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then
      log "$name responding after ${i}s"
      return 0
    fi
    sleep 1
  done
  fail "$name did not respond at $url after ${attempts}s"
  return 1
}

smoke_test() {
  wait_for "API" "http://127.0.0.1:4000/api/health" || return 1
  wait_for "Web" "http://127.0.0.1:3000/" || return 1

  local health
  health="$(curl -fsS --max-time 5 http://127.0.0.1:4000/api/health)"
  echo "  health: $health"

  # Postgres reachable — a 200 with db:down means the app is up but useless.
  case "$health" in
    *'"db":"up"'*) ;;
    *) fail "health reports db down"; return 1 ;;
  esac

  # The release actually serving is the one we just shipped. Without this a
  # stale PM2 worker still running the previous release would pass every other
  # check, and the deploy would report success while shipping nothing.
  case "$health" in
    *"\"version\":\"$SHA\""*) ;;
    *) fail "serving a different release than $SHA — PM2 did not pick up the new path"; return 1 ;;
  esac

  return 0
}

# ---------------------------------------------------------------- verdict ----

if smoke_test; then
  log "Deploy OK — $SHA is live"

  # Prune old releases, always keeping whatever `current` points at.
  if [ -d "$RELEASES" ]; then
    live="$(readlink -f "$CURRENT")"
    # shellcheck disable=SC2012  # names are git SHAs: no spaces or newlines
    ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | while read -r old; do
      old="${old%/}"
      [ "$(readlink -f "$old")" = "$live" ] && continue
      log "Pruning $(basename "$old")"
      rm -rf "$old"
    done
  fi
  exit 0
fi

# ------------------------------------------------------------- rollback ----

fail "Smoke test failed for $SHA"

if [ -z "$PREVIOUS_RELEASE" ] || [ ! -d "$PREVIOUS_RELEASE" ]; then
  fail "No previous release to roll back to — leaving $SHA in place for inspection."
  pm2 logs --lines 40 --nostream || true
  exit 1
fi

log "Rolling back to $(basename "$PREVIOUS_RELEASE")"
ln -sfn "$PREVIOUS_RELEASE" "$CURRENT.tmp"
mv -Tf "$CURRENT.tmp" "$CURRENT"

export APP_VERSION="$(basename "$PREVIOUS_RELEASE")"
pm2 startOrReload "$ECOSYSTEM" --update-env

if wait_for "API (rolled back)" "http://127.0.0.1:4000/api/health"; then
  fail "Rolled back to $(basename "$PREVIOUS_RELEASE"). The bad release is at $NEW_RELEASE."
else
  fail "ROLLBACK ALSO FAILED — site is down, manual intervention required."
fi

pm2 logs --lines 40 --nostream || true
exit 1
