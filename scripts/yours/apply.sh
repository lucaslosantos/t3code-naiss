#!/usr/bin/env bash
# Installs the build staged by build.sh: backs up the database (copy only), quits
# "T3 Code (Yours)" gracefully, keeps the current app as ~/.t3/yours-previous.app,
# moves the staged app to /Applications and relaunches it.
#
# Run with --detach from inside the app (for example from an agent turn): the work then
# continues in a detached process after a short delay and logs to ~/.t3/logs/yours-apply.log.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

parse_common_flags "$@"
require_macos_arm64
# Check before detaching so the caller sees a missing or bad build right away.
verify_bundle "$YOURS_STAGED_APP"
if detach_if_requested "$SCRIPT_PATH" "$YOURS_LOG_DIR/yours-apply.log"; then
  exit 0
fi

verify_bundle "$YOURS_STAGED_APP"
quit_app_gracefully "$YOURS_APP_NAME" "$YOURS_INSTALLED_APP"
backup_database

if [[ -d "$YOURS_INSTALLED_APP" ]]; then
  rm -rf "$YOURS_PREVIOUS_APP"
  mv "$YOURS_INSTALLED_APP" "$YOURS_PREVIOUS_APP"
  log "Kept the previous build at $YOURS_PREVIOUS_APP."
fi
if ! mv "$YOURS_STAGED_APP" "$YOURS_INSTALLED_APP"; then
  [[ -d "$YOURS_PREVIOUS_APP" && ! -e "$YOURS_INSTALLED_APP" ]] && mv "$YOURS_PREVIOUS_APP" "$YOURS_INSTALLED_APP"
  die "Could not move the staged build into place; the previous app was restored."
fi
log "Installed $(plist_value "$YOURS_INSTALLED_APP" CFBundleShortVersionString) at $YOURS_INSTALLED_APP."
register_app "$YOURS_INSTALLED_APP"
relaunch "$YOURS_INSTALLED_APP"
