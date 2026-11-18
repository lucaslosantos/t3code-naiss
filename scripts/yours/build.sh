#!/usr/bin/env bash
# Builds "T3 Code (naiss)" for Apple silicon and stages it at ~/.t3/yours-staged.app.
# Unsigned by Apple (ad-hoc signature), no notarization, no update feed. Never touches the
# running or installed app; run apply.sh (or install.sh) to install the staged build.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

case "${1:-}" in
  -h | --help)
    echo "Usage: $(basename "$0")   (env: YOURS_STAGED_APP overrides the staging path)"
    exit 0
    ;;
  "") ;;
  *) die "Unknown argument: $1" ;;
esac

require_macos_arm64
# Use the checkout's pinned vite-plus; a newer global `vp` refuses to plan tasks for it.
export PATH="$REPO_ROOT/node_modules/.bin:$PATH"
command -v vp >/dev/null || die "vp is not on PATH."
command -v node >/dev/null || die "node is not on PATH."

artwork="${HOME}/.t3/luko-artwork"
if [[ -f "$artwork/companion.riv" ]]; then
  cp "$artwork/companion.riv" "$REPO_ROOT/apps/web/src/components/yours/mascot/companion.riv"
  export T3CODE_LUKO_ARTWORK="$artwork"
fi

started=$(date +%s)
cd "$REPO_ROOT"

# Public Clerk/relay identifiers (the ones official builds bake in) so sign-in and T3 Connect work.
# .env / .env.local win when present; nothing is written to disk.
if ! grep -qs '^T3CODE_CLERK_PUBLISHABLE_KEY=.' .env .env.local; then
  while IFS='=' read -r key value; do
    if [[ -n "$key" && -n "$value" && -z "${!key:-}" ]]; then export "$key=$value"; fi
  done < <(grep -E '^(T3CODE_CLERK_PUBLISHABLE_KEY|T3CODE_CLERK_JWT_TEMPLATE|T3CODE_CLERK_CLI_OAUTH_CLIENT_ID|T3CODE_RELAY_URL)=' .env.example)
fi

# No publish config => electron-builder writes no app-update.yml => the updater is off for good.
unset GITHUB_REPOSITORY T3CODE_DESKTOP_UPDATE_REPOSITORY T3CODE_DESKTOP_MOCK_UPDATES
# No Apple signing or notarization.
unset T3CODE_DESKTOP_SIGNED CSC_LINK CSC_KEY_PASSWORD CSC_NAME APPLE_API_KEY APPLE_API_KEY_ID APPLE_API_ISSUER APPLE_ID APPLE_TEAM_ID T3CODE_APPLE_TEAM_ID
export CSC_IDENTITY_AUTO_DISCOVERY=false
export VITE_NAISS_FORK=1
export T3CODE_DESKTOP_PRODUCT_NAME="$YOURS_APP_NAME"
export T3CODE_DESKTOP_APP_ID="$YOURS_APP_ID"

# The Rust resource-monitor helper needs cargo. Without it, reuse the official app's binary
# (the build only copies it from native/resource-monitor/target, which is gitignored).
if ! command -v cargo >/dev/null && [[ "${T3CODE_DESKTOP_REUSE_RESOURCE_MONITOR:-}" != "1" ]]; then
  official_monitor="/Applications/${OFFICIAL_APP_NAME}.app/Contents/Resources/resource-monitor/t3-resource-monitor"
  cached_monitor="$REPO_ROOT/native/resource-monitor/target/aarch64-apple-darwin/release/t3-resource-monitor"
  [[ -x "$official_monitor" ]] ||
    die "cargo is missing and $official_monitor does not exist. Install Rust (https://rustup.rs, then: rustup target add aarch64-apple-darwin)."
  log "WARNING: cargo not found; reusing the resource monitor from $OFFICIAL_APP_NAME. Install Rust to build it from this checkout."
  mkdir -p "$(dirname "$cached_monitor")"
  cp "$official_monitor" "$cached_monitor"
  export T3CODE_DESKTOP_REUSE_RESOURCE_MONITOR=1
fi

out_dir="$(mktemp -d "${TMPDIR:-/tmp}/t3code-naiss-build.XXXXXX")"
trap 'rm -rf "$out_dir"' EXIT

log "Building $YOURS_APP_NAME ($(git rev-parse --short HEAD)) into $out_dir..."
node scripts/build-desktop-artifact.ts --platform mac --target dir --arch arm64 --output-dir "$out_dir"

app="$out_dir/mac-arm64/$YOURS_APP_NAME.app"
[[ -d "$app" ]] || app="$(find "$out_dir" -maxdepth 2 -name "$YOURS_APP_NAME.app" -type d | head -n 1)"
[[ -n "$app" && -d "$app" ]] || die "The build produced no '$YOURS_APP_NAME.app' under $out_dir."

# electron-builder skips signing without an identity, and its Info.plist edits break Electron's
# linker signature; arm64 macOS refuses to run unsigned code, so seal the bundle ad hoc.
# YOURS_CODESIGN_IDENTITY may name a stable local certificate so Keychain "Always Allow" survives rebuilds.
log "Signing (${YOURS_CODESIGN_IDENTITY:-ad hoc})..."
codesign --force --deep --sign "${YOURS_CODESIGN_IDENTITY:--}" --timestamp=none "$app"
verify_bundle "$app"

mkdir -p "$(dirname "$YOURS_STAGED_APP")"
rm -rf "$YOURS_STAGED_APP.tmp"
ditto "$app" "$YOURS_STAGED_APP.tmp"
rm -rf "$YOURS_STAGED_APP"
mv "$YOURS_STAGED_APP.tmp" "$YOURS_STAGED_APP"
verify_bundle "$YOURS_STAGED_APP"

log "Staged $(plist_value "$YOURS_STAGED_APP" CFBundleShortVersionString) ($(git rev-parse --short HEAD)) at $YOURS_STAGED_APP in $(($(date +%s) - started))s."
log "Install it with: scripts/yours/apply.sh   (inside the app: scripts/yours/apply.sh --detach)"
