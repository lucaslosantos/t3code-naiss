#!/usr/bin/env bash
# Teammate machines: installs the Naiss artwork zip the owner shared (logo and companion mascot),
# then rebuilds the app with it. Takes a zip path, or finds the newest naiss-artwork*.zip in Downloads.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dest="$HOME/.t3/luko-artwork"
zip="${1:-$(ls -t "$HOME"/Downloads/naiss-artwork*.zip 2>/dev/null | head -n 1 || true)}"
[[ -n "$zip" && -f "$zip" ]] ||
  { echo "Download naiss-artwork.zip from Slack into your Downloads folder first, then run this again." >&2; exit 1; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
ditto -x -k "$zip" "$tmp"
found="$(find "$tmp" -name companion.riv -not -path '*/__MACOSX/*' | head -n 1)"
[[ -n "$found" ]] || { echo "$zip does not contain the Naiss artwork (no companion.riv)." >&2; exit 1; }
rm -rf "$dest"
mkdir -p "$(dirname "$dest")"
ditto "$(dirname "$found")" "$dest"
echo "Installed the Naiss logo and mascot."

# Only rebuild when this checkout builds the team version; the setup script builds on its own.
if [[ "${YOURS_ARTWORK_NO_REBUILD:-0}" != "1" ]]; then
  echo "Rebuilding the app with them (a few minutes)..."
  rm -f "$HOME/.t3/yours-follow-built"
  "$SCRIPT_DIR/follow.sh" --now
fi
