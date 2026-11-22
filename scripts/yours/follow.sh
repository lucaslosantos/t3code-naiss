#!/usr/bin/env bash
# Teammate machines only: brings in the owner's latest `yours` from origin, builds it and installs it.
# Runs daily from the LaunchAgent that teammate-setup.sh installs. When the app is open it asks
# before restarting; when it is closed it installs quietly. --now updates right away, without asking.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

YOURS_BUILT_MARKER="${YOURS_T3_DIR}/yours-follow-built"
now=0
case "${1:-}" in
  --now) now=1 ;;
  "") ;;
  -h | --help)
    echo "Usage: $(basename "$0") [--now]   (teammate machines; see YOURS.md, Teammates)"
    exit 0
    ;;
  *) die "Unknown argument: $1" ;;
esac

notify() {
  osascript -e "display notification \"$1\" with title \"$YOURS_APP_NAME\"" >/dev/null 2>&1 || true
}

fail() {
  notify "$1 Details: ~/.t3/logs/yours-follow.log"
  die "$1"
}

require_macos_arm64
# LaunchAgents start with a bare PATH; add the usual tool locations.
export PATH="$HOME/.vite-plus/bin:$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$REPO_ROOT"
[[ "$(git config --get yours.follow || true)" == "true" ]] ||
  die "This checkout is not set up to follow the team build (that is the owner's machine). See YOURS.md."

git fetch --quiet origin yours || fail "Could not reach GitHub to check for updates."
before="$(git rev-parse HEAD)"
if ! git merge-base --is-ancestor origin/yours HEAD; then
  [[ -z "$(git status --porcelain)" ]] ||
    fail "Update skipped: this copy has unsaved changes. Ask an agent to commit them, then update again."
  if ! git merge --quiet --no-edit origin/yours; then
    git merge --abort || true
    fail "Update skipped: your own changes conflict with the team version. Use Make it mine → Update from T3 Code now."
  fi
fi
head="$(git rev-parse HEAD)"

if [[ "$(cat "$YOURS_BUILT_MARKER" 2>/dev/null || true)" != "$head" ]]; then
  log "Building $(git rev-parse --short HEAD)..."
  vp i >/dev/null || fail "Update failed while installing dependencies."
  "$SCRIPT_DIR/build.sh" || fail "Update failed while building."
  echo "$head" >"$YOURS_BUILT_MARKER"
elif [[ ! -d "$YOURS_STAGED_APP" ]]; then
  log "Already up to date."
  exit 0
fi

# What's new: customizations logged since the last update, plus official T3 Code when it moved.
changes="$(git diff "$before" "$head" -- CUSTOMIZATIONS.md | sed -n 's/^+- [0-9-]*: //p' | sed -E 's/ \(merges? [^)]*\)\.?$//' | head -n 4)"
if git log --format=%s "$before..$head" | grep -q "upstream"; then
  changes="${changes:+$changes
}Latest improvements from official T3 Code."
fi
[[ -n "$changes" ]] || changes="Fixes and small improvements."

if ! app_is_running "$YOURS_APP_NAME"; then
  if ((now)); then
    "$SCRIPT_DIR/apply.sh"
  else
    "$SCRIPT_DIR/apply.sh" --no-launch
    notify "Updated. Open the app to see what's new."
  fi
  exit 0
fi
if ((now)); then
  # Usually called from an agent turn inside the app, so the install must outlive it.
  "$SCRIPT_DIR/apply.sh" --detach
  exit 0
fi

message="A new version is ready.

${changes//\"/\\\"}

Restarting takes a few seconds; your threads pick up where they left off."
choice="$(osascript -e "button returned of (display dialog \"$message\" with title \"$YOURS_APP_NAME\" buttons {\"Later\", \"Restart now\"} default button \"Restart now\" giving up after 3600)" 2>/dev/null || true)"
if [[ "$choice" == "Restart now" ]]; then
  "$SCRIPT_DIR/apply.sh" --detach --delay 2
else
  log "Update kept for later; asking again on the next check."
fi
