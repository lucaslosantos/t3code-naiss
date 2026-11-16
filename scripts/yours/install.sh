#!/usr/bin/env bash
# Manual one-shot: build.sh then apply.sh. Flags go to apply.sh (--detach, --delay N, --no-launch).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/build.sh"
"$SCRIPT_DIR/apply.sh" "$@"
