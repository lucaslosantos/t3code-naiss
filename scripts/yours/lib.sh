# shellcheck shell=bash
# Shared settings and helpers for the "T3 Code (naiss)" local packaging scripts.
# Sourced by build.sh, apply.sh, rollback.sh and install.sh; not meant to run on its own.

YOURS_APP_NAME="T3 Code (naiss)"
LEGACY_APP_NAME="T3 Code (Yours)"
YOURS_APP_ID="com.t3tools.t3code.yours"
OFFICIAL_APP_NAME="T3 Code (Beta)"

# The fork shares the official T3 home on purpose: same threads, projects and settings.
YOURS_T3_DIR="${HOME}/.t3"
YOURS_USERDATA_DIR="${YOURS_T3_DIR}/userdata"
YOURS_STAGED_APP="${YOURS_STAGED_APP:-${YOURS_T3_DIR}/yours-staged.app}"
YOURS_PREVIOUS_APP="${YOURS_T3_DIR}/yours-previous.app"
YOURS_INSTALLED_APP="${YOURS_INSTALLED_APP:-/Applications/${YOURS_APP_NAME}.app}"
YOURS_BACKUP_DIR="${YOURS_T3_DIR}/backups"
YOURS_BACKUP_KEEP=10
YOURS_LOG_DIR="${YOURS_T3_DIR}/logs"
YOURS_QUIT_TIMEOUT_SECONDS="${YOURS_QUIT_TIMEOUT_SECONDS:-90}"

log() {
  printf '[yours %s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

die() {
  log "ERROR: $*" >&2
  exit 1
}

require_macos_arm64() {
  [[ "$(uname -s)" == "Darwin" ]] || die "macOS only."
  [[ "$(uname -m)" == "arm64" ]] || die "Apple silicon (arm64) only; uname -m is $(uname -m)."
}

plist_value() {
  /usr/libexec/PlistBuddy -c "Print :$2" "$1/Contents/Info.plist" 2>/dev/null
}

# A bundle is acceptable only if it is our identity, has no update feed, and its signature verifies.
verify_bundle() {
  local app="$1"
  [[ -d "$app" ]] || die "No app bundle at $app."
  local id name
  id="$(plist_value "$app" CFBundleIdentifier || true)"
  name="$(plist_value "$app" CFBundleName || true)"
  [[ "$id" == "$YOURS_APP_ID" ]] || die "$app has bundle id '$id', expected '$YOURS_APP_ID'."
  [[ "$name" == "$YOURS_APP_NAME" || ( "$app" == "$YOURS_PREVIOUS_APP" && ( "$name" == "$LEGACY_APP_NAME" || "$name" == "T3 Code (luko)" ) ) ]] || die "$app has name '$name', expected '$YOURS_APP_NAME'."
  # Without app-update.yml electron-updater has no feed, so the official updater can never replace the fork.
  [[ ! -e "$app/Contents/Resources/app-update.yml" ]] ||
    die "$app contains app-update.yml; refusing a build that could auto-update to the official app."
  codesign --verify --deep --strict "$app" || die "codesign verification failed for $app."
}

app_is_running() {
  [[ "$(osascript -e "application \"$1\" is running" 2>/dev/null || echo false)" == "true" ]]
}

# Any process whose executable lives inside the bundle (the app, its helpers, its bundled server).
bundle_has_processes() {
  ps -axo comm= | grep -F -- "$1/Contents/" >/dev/null
}

# Graceful quit through Apple Events; never signals processes.
quit_app_gracefully() {
  local name="$1" bundle="$2"
  if app_is_running "$name"; then
    log "Asking \"$name\" to quit..."
    osascript -e "quit app \"$name\"" >/dev/null 2>&1 || true
  fi
  local waited=0
  while app_is_running "$name" || { [[ -d "$bundle" ]] && bundle_has_processes "$bundle"; }; do
    if ((waited >= YOURS_QUIT_TIMEOUT_SECONDS)); then
      die "\"$name\" is still running after ${YOURS_QUIT_TIMEOUT_SECONDS}s (a quit confirmation may be open). Nothing was changed."
    fi
    sleep 1
    waited=$((waited + 1))
  done
  log "\"$name\" is not running."
}

# Copies (never opens or modifies) the live database files into ~/.t3/backups/<timestamp>/.
backup_database() {
  local stamp dest copied=0
  stamp="$(date '+%Y%m%d-%H%M%S')"
  dest="${YOURS_BACKUP_DIR}/${stamp}"
  if [[ ! -e "${YOURS_USERDATA_DIR}/statev2.sqlite" ]]; then
    log "No database at ${YOURS_USERDATA_DIR}/statev2.sqlite; skipping backup."
    return 0
  fi
  if app_is_running "$OFFICIAL_APP_NAME"; then
    log "WARNING: \"$OFFICIAL_APP_NAME\" is running, so the database may change while it is copied."
  fi
  mkdir -p "$dest"
  local file
  for file in "${YOURS_USERDATA_DIR}"/statev2.sqlite "${YOURS_USERDATA_DIR}"/statev2.sqlite-wal "${YOURS_USERDATA_DIR}"/statev2.sqlite-shm; do
    [[ -e "$file" ]] || continue
    cp -p "$file" "$dest/"
    chmod a-w "$dest/$(basename "$file")"
    copied=$((copied + 1))
  done
  log "Backed up $copied database file(s) to $dest."
  # Keep the newest backups; only timestamp-named directories are ever pruned.
  local old
  while IFS= read -r old; do
    [[ -n "$old" ]] || continue
    chmod -R u+w "$old" && rm -rf "$old"
    log "Pruned old backup $old."
  done < <(find "$YOURS_BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '[0-9]*-[0-9]*' | sort -r | tail -n +$((YOURS_BACKUP_KEEP + 1)))
}

register_app() {
  local lsregister="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
  [[ -x "$lsregister" ]] && "$lsregister" -f "$1" >/dev/null 2>&1 || true
  # Both apps declare t3code://; send those links to the fork (best effort, YOURS_SKIP_URL_HANDLER=1 skips).
  if [[ "${YOURS_SKIP_URL_HANDLER:-0}" != "1" ]]; then
    osascript -l JavaScript -e "ObjC.import('CoreServices'); \$.LSSetDefaultHandlerForURLScheme(\$('t3code'), \$('$YOURS_APP_ID'))" >/dev/null 2>&1 ||
      log "Could not make the fork the t3code:// handler (non-fatal)."
  fi
}

relaunch() {
  local app="$1"
  if [[ "${YOURS_NO_LAUNCH:-0}" == "1" ]]; then
    log "Not relaunching (--no-launch)."
    return 0
  fi
  # LaunchServices starts the app with the login session's environment, not this shell's.
  open "$app" || die "Could not open $app."
  log "Launched $app."
}

# Parses the shared flags. Sets YOURS_DETACH, YOURS_DELAY, YOURS_NO_LAUNCH, YOURS_DETACHED_CHILD.
parse_common_flags() {
  YOURS_DETACH=0
  YOURS_DELAY=8
  YOURS_DETACHED_CHILD=0
  while (($#)); do
    case "$1" in
      --detach) YOURS_DETACH=1 ;;
      --delay)
        [[ $# -ge 2 && "$2" =~ ^[0-9]+$ ]] || die "--delay needs a number of seconds."
        YOURS_DELAY="$2"
        shift
        ;;
      --no-launch) YOURS_NO_LAUNCH=1 ;;
      --detached-child) YOURS_DETACHED_CHILD=1 ;;
      -h | --help)
        cat <<EOF
Usage: $(basename "$0") [--detach] [--delay SECONDS] [--no-launch]
  --detach        Re-run fully detached from the caller (new session, reparented to launchd)
                  after --delay seconds (default 8), logging to ${YOURS_LOG_DIR}/. Use this when
                  the caller runs inside "${YOURS_APP_NAME}", e.g. an agent turn.
  --no-launch     Do not reopen the app afterwards.
EOF
        exit 0
        ;;
      *) die "Unknown argument: $1" ;;
    esac
    shift
  done
  export YOURS_NO_LAUNCH="${YOURS_NO_LAUNCH:-0}"
}

# With --detach, re-exec this script in a new session and return 0 in the caller (which should exit).
# Returns 1 when the work should run in the current process.
detach_if_requested() {
  local script="$1" logfile="$2"
  if [[ "$YOURS_DETACHED_CHILD" == "1" ]]; then
    log "Detached run (pid $$); starting in ${YOURS_DELAY}s."
    sleep "$YOURS_DELAY"
    return 1
  fi
  [[ "$YOURS_DETACH" == "1" ]] || return 1
  mkdir -p "$YOURS_LOG_DIR"
  local args=(--detached-child --delay "$YOURS_DELAY")
  [[ "$YOURS_NO_LAUNCH" == "1" ]] && args+=(--no-launch)
  # perl forks, the child calls setsid() and execs: the worker leaves the caller's process group
  # and session and is reparented to launchd, so quitting the app (and its agents) cannot stop it.
  (cd / && /usr/bin/perl -MPOSIX=setsid -e 'my $pid = fork; die "fork: $!" unless defined $pid; exit 0 if $pid; setsid() or die "setsid: $!"; exec @ARGV or die "exec: $!"' \
    /bin/bash "$script" "${args[@]}" </dev/null >>"$logfile" 2>&1)
  log "Detached. It starts in ${YOURS_DELAY}s; follow it with: tail -f \"$logfile\""
  return 0
}
