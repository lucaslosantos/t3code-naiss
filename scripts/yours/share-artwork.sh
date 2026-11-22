#!/usr/bin/env bash
# Owner's machine: zips the private Naiss artwork (logo and companion mascot, kept out of the public
# repo) to the Desktop, ready to send to teammates. They install it with add-artwork.sh.
set -euo pipefail

src="$HOME/.t3/luko-artwork"
zip="$HOME/Desktop/naiss-artwork.zip"
[[ -f "$src/companion.riv" ]] || { echo "No artwork at $src." >&2; exit 1; }
rm -f "$zip"
ditto -c -k --keepParent "$src" "$zip"
open -R "$zip"
echo "Saved $zip. Send it to teammates in Slack, with: ~/projects/t3code-naiss/scripts/yours/add-artwork.sh"
