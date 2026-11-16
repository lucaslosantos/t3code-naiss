#!/usr/bin/env bash
# Swaps /Applications/T3 Code (Yours).app with ~/.t3/yours-previous.app and relaunches.
# The swap is symmetric, so running it again rolls forward. Backs up the database first.
# Use --detach when running from inside the app; logs go to ~/.t3/logs/yours-rollback.log.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

parse_common_flags "$@"
require_macos_arm64
verify_bundle "$YOURS_PREVIOUS_APP"
if detach_if_requested "$SCRIPT_PATH" "$YOURS_LOG_DIR/yours-rollback.log"; then
  exit 0
fi

verify_bundle "$YOURS_PREVIOUS_APP"
quit_app_gracefully "$YOURS_APP_NAME" "$YOURS_INSTALLED_APP"
backup_database

swap="${YOURS_T3_DIR}/yours-rollback-swap.app"
rm -rf "$swap"
[[ -d "$YOURS_INSTALLED_APP" ]] && mv "$YOURS_INSTALLED_APP" "$swap"
mv "$YOURS_PREVIOUS_APP" "$YOURS_INSTALLED_APP"
[[ -d "$swap" ]] && mv "$swap" "$YOURS_PREVIOUS_APP"
log "Rolled back to $(plist_value "$YOURS_INSTALLED_APP" CFBundleShortVersionString); the replaced build is now $YOURS_PREVIOUS_APP."
register_app "$YOURS_INSTALLED_APP"
relaunch "$YOURS_INSTALLED_APP"
