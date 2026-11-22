#!/usr/bin/env bash
# One-time setup of "T3 Code (naiss)" on a teammate's Mac. Paste into Terminal:
#   curl -fsSL https://raw.githubusercontent.com/lucaslosantos/t3code-naiss/yours/scripts/yours/teammate-setup.sh | bash
# Installs the build tools, downloads the team version to ~/projects/t3code-naiss, builds and opens
# the app, and turns on the daily update (scripts/yours/follow.sh). Safe to run again.
set -euo pipefail

REPO_URL="https://github.com/lucaslosantos/t3code-naiss.git"
CHECKOUT="$HOME/projects/t3code-naiss"
AGENT_LABEL="com.t3tools.t3code.yours.follow"
AGENT_PLIST="$HOME/Library/LaunchAgents/$AGENT_LABEL.plist"

say() { printf '\n==> %s\n' "$*"; }
die() {
  printf '\nSetup stopped: %s\n' "$*" >&2
  exit 1
}

[[ "$(uname -s)" == "Darwin" && "$(uname -m)" == "arm64" ]] || die "this needs a Mac with Apple silicon (M1 or newer)."

if ! xcode-select -p >/dev/null 2>&1; then
  xcode-select --install >/dev/null 2>&1 || true
  die "macOS is installing its developer tools in a separate window. When that finishes, run this command again."
fi

export PATH="$HOME/.vite-plus/bin:$HOME/.cargo/bin:$PATH"
if ! command -v vp >/dev/null; then
  say "Installing the build tool (Vite+)..."
  curl -fsSL https://vite.plus | bash
  command -v vp >/dev/null || die "Vite+ installed, but 'vp' is not on PATH. Open a new Terminal window and run this command again."
fi

# The app bundles a small Rust helper; without Rust the build borrows it from an official T3 Code install.
if ! command -v cargo >/dev/null && [[ ! -d "/Applications/T3 Code (Beta).app" ]]; then
  say "Installing Rust (needed once to build the app)..."
  curl -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal
  "$HOME/.cargo/bin/rustup" target add aarch64-apple-darwin
fi
command -v cargo >/dev/null && rustup target add aarch64-apple-darwin >/dev/null 2>&1 || true

if [[ -d "$CHECKOUT/.git" ]]; then
  say "Found the team version at $CHECKOUT."
  [[ "$(git -C "$CHECKOUT" remote get-url origin)" == "$REPO_URL" ]] ||
    die "$CHECKOUT is a different project. Move it away and run this command again."
else
  say "Downloading the team version to $CHECKOUT..."
  mkdir -p "$(dirname "$CHECKOUT")"
  git clone --branch yours "$REPO_URL" "$CHECKOUT"
fi
cd "$CHECKOUT"
git config yours.follow true
# Merges of the team version into local changes need an identity; keep any the teammate already has.
git config user.email >/dev/null || git config user.email "teammate@t3code-naiss.local"
git config user.name >/dev/null || git config user.name "T3 Code (naiss) teammate"

if [[ ! -f "$HOME/.t3/luko-artwork/companion.riv" ]] && ls "$HOME"/Downloads/naiss-artwork*.zip >/dev/null 2>&1; then
  say "Adding the Naiss logo and mascot from your Downloads..."
  YOURS_ARTWORK_NO_REBUILD=1 scripts/yours/add-artwork.sh
fi

say "Building and installing the app (takes a few minutes the first time)..."
vp i
rm -f "$HOME/.t3/yours-follow-built"
scripts/yours/follow.sh --now

say "Turning on the daily update..."
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.t3/logs"
cat >"$AGENT_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$AGENT_LABEL</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$CHECKOUT/scripts/yours/follow.sh</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>8</integer><key>Minute</key><integer>30</integer></dict>
  <key>StandardOutPath</key><string>$HOME/.t3/logs/yours-follow.log</string>
  <key>StandardErrorPath</key><string>$HOME/.t3/logs/yours-follow.log</string>
</dict>
</plist>
EOF
launchctl bootout "gui/$(id -u)/$AGENT_LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$AGENT_PLIST"

say "Done. T3 Code (naiss) is in your Applications folder and checks for updates every morning."
echo "To use Make it mine, add the folder $CHECKOUT as a project in the app."
