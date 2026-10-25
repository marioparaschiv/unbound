#!/usr/bin/env bash
#
# vphone.sh — thin wrapper around the virtual iPhone (vphone) reachable over SSH.
#
# The vphone is a jailbroken iOS VM running Discord + the Unbound loader. It
# runs openssh-server (rootless JB; guest port 22, tunneled to host 2222), so
# default SFTP-mode scp works — do NOT use `scp -O` (no remote scp binary).
# `sudo` is password-based (`sudo -S`). There is no python on the device, so
# JSON edits are done host-side and pushed back.
#
# Port 2222 is a non-persistent usbmux forward (`iproxy 2222:22 -u <udid>`) that can drop on its
# own; every command below auto-repairs it first via ensure_tunnel (resolves the UDID by
# ProductType, same as vphone-logs.sh — never falls back to a paired real iPhone).
#
# Connection (overridable via env):
#   VPHONE_HOST=127.0.0.1  VPHONE_PORT=2222  VPHONE_USER=mobile  VPHONE_PASS=alpine
#   VPHONE_UDID (skip auto-resolution)  VPHONE_PRODUCT=iPhone99,11 (ProductType to match)
#
# Usage:
#   vphone.sh ping                          # check reachability (auto-repairs the tunnel first)
#   vphone.sh tunnel                        # explicitly (re)establish the usbmux port forward
#   vphone.sh ssh   <cmd...>                # run a command (no sudo)
#   vphone.sh sudo  <cmd...>                # run a command as root
#   vphone.sh push  <local> <remote>        # copy host -> device (scp/sftp)
#   vphone.sh pull  <remote> <local>        # copy device -> host (scp/sftp)
#   vphone.sh app-data <bundleid>           # print app Data container path
#   vphone.sh unbound-dir                   # print the Unbound directory path
#   vphone.sh settings-path                 # print Unbound settings.json path
#   vphone.sh settings-get [<jq-filter>]    # cat Unbound settings.json (host jq optional)
#   vphone.sh settings-set <dot.key> <json> # set unbound.<dot.key> = <json>, backup + push
#   vphone.sh restart                       # kill & relaunch Discord
#
set -euo pipefail

VPHONE_HOST="${VPHONE_HOST:-127.0.0.1}"
VPHONE_PORT="${VPHONE_PORT:-2222}"
VPHONE_USER="${VPHONE_USER:-mobile}"
VPHONE_PASS="${VPHONE_PASS:-alpine}"
VPHONE_PRODUCT="${VPHONE_PRODUCT:-iPhone99,11}"
DISCORD_BID="com.hammerandchisel.discord"
IPROXY_LOG="${TMPDIR:-/tmp}/vphone-iproxy.log"

# Cheap, dependency-free TCP probe (no nc/lsof needed) — succeeds iff something
# is accepting connections on $VPHONE_HOST:$VPHONE_PORT right now.
port_open() {
  ( exec 3<>"/dev/tcp/${VPHONE_HOST}/${VPHONE_PORT}" ) 2>/dev/null
}

# Resolve the vphone's UDID over usbmux by ProductType — mirrors vphone-logs.sh's
# resolve_udid so both scripts pick the same device and never silently target a
# real iPhone that happens to be paired too.
resolve_udid() {
  if [ -n "${VPHONE_UDID:-}" ]; then echo "$VPHONE_UDID"; return 0; fi
  command -v idevice_id >/dev/null 2>&1 || { echo "idevice_id not found (brew install libimobiledevice)" >&2; return 1; }
  command -v ideviceinfo >/dev/null 2>&1 || { echo "ideviceinfo not found (brew install libimobiledevice)" >&2; return 1; }
  local match=""
  while IFS= read -r udid; do
    [ -n "$udid" ] || continue
    if [ "$(ideviceinfo -u "$udid" -k ProductType 2>/dev/null || true)" = "$VPHONE_PRODUCT" ]; then
      [ -z "$match" ] && match="$udid" || { echo "multiple vphone candidates; set VPHONE_UDID" >&2; return 1; }
    fi
  done < <(idevice_id -l 2>/dev/null)
  [ -n "$match" ] || { echo "vphone ($VPHONE_PRODUCT) not found over usbmux; set VPHONE_UDID" >&2; return 1; }
  echo "$match"
}

# Idempotent: no-ops if the port is already forwarded. Only applies to the
# local usbmux loopback forward, not a custom/remote VPHONE_HOST.
ensure_tunnel() {
  [ "$VPHONE_HOST" = "127.0.0.1" ] || return 0
  port_open && return 0

  command -v iproxy >/dev/null 2>&1 || { echo "iproxy not found (brew install libimobiledevice) — cannot auto-forward the vphone port" >&2; return 1; }
  local udid; udid="$(resolve_udid)" || return 1

  echo "vphone port $VPHONE_PORT unreachable — starting iproxy $VPHONE_PORT:22 for $udid" >&2
  nohup iproxy "${VPHONE_PORT}:22" -u "$udid" >"$IPROXY_LOG" 2>&1 &
  disown

  local i
  for i in $(seq 1 20); do
    port_open && return 0
    sleep 0.25
  done

  echo "iproxy started but $VPHONE_HOST:$VPHONE_PORT never opened — check $IPROXY_LOG" >&2
  return 1
}

# Password-only auth: agent keys tried first can exhaust the server's MaxAuthTries.
SSH_BASE=(-p "$VPHONE_PORT" -o ConnectTimeout=8 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o PubkeyAuthentication=no -o PreferredAuthentications=password)
TARGET="${VPHONE_USER}@${VPHONE_HOST}"

need_sshpass() {
  command -v sshpass >/dev/null 2>&1 || { echo "sshpass not found (brew install sshpass)" >&2; exit 1; }
}

_ssh()  { need_sshpass; sshpass -p "$VPHONE_PASS" ssh "${SSH_BASE[@]}" "$TARGET" "$@"; }
# SFTP-mode scp (the default); openssh-server on the device provides sftp-server.
_scp()  { need_sshpass; sshpass -p "$VPHONE_PASS" scp -P "$VPHONE_PORT" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o PubkeyAuthentication=no -o PreferredAuthentications=password "$@"; }
_sudo() { need_sshpass; sshpass -p "$VPHONE_PASS" ssh "${SSH_BASE[@]}" "$TARGET" "echo '$VPHONE_PASS' | sudo -S sh -c \"$*\" 2>/dev/null"; }

app_data() {
  local bid="${1:?bundle id required}"
  _sudo "find /var/mobile/Containers/Data/Application -maxdepth 4 -name '.com.apple.mobile_container_manager.metadata.plist' -exec grep -l '$bid' {} +" \
    | sed 's#/\.com\.apple\.mobile_container_manager\.metadata\.plist##' | head -n1
}

unbound_dir() {
  local p; p="$(settings_path)"
  [ -n "$p" ] && dirname "$p"
}

settings_path() {
  # Unbound writes to Documents/Unbound/settings.json in the Discord data container.
  _sudo "find /var/mobile/Containers/Data/Application -maxdepth 5 -path '*Documents/Unbound/settings.json'" | head -n1
}

# Auto-repair the usbmux forward before any command that actually talks to the
# device. Bare/unknown invocations fall through to the usage text below untouched.
case "${1:-}" in
  ping|tunnel|ssh|sudo|push|pull|app-data|unbound-dir|settings-path|settings-get|settings-set|restart)
    ensure_tunnel || true ;;
esac

case "${1:-}" in
  ping)
    if _ssh "exit" >/dev/null 2>&1; then echo "vphone reachable ($TARGET:$VPHONE_PORT)"; else echo "vphone UNREACHABLE ($TARGET:$VPHONE_PORT)" >&2; exit 1; fi ;;

  tunnel)
    if port_open; then echo "tunnel OK ($VPHONE_HOST:$VPHONE_PORT -> device:22)"; else echo "tunnel FAILED — see $IPROXY_LOG" >&2; exit 1; fi ;;

  ssh)   shift; _ssh "$@" ;;
  sudo)  shift; _sudo "$*" ;;
  push)  shift; _scp "${1:?local}" "$TARGET:${2:?remote}" ;;
  pull)  shift; _scp "$TARGET:${1:?remote}" "${2:?local}" ;;

  app-data)      shift; app_data "${1:-$DISCORD_BID}" ;;
  unbound-dir)   unbound_dir ;;
  settings-path) settings_path ;;

  settings-get)
    shift
    p="$(settings_path)"; [ -n "$p" ] || { echo "settings.json not found" >&2; exit 1; }
    if [ -n "${1:-}" ] && command -v jq >/dev/null 2>&1; then
      _sudo "cat '$p'" | jq "$1"
    else
      _sudo "cat '$p'"
    fi ;;

  settings-set)
    shift
    key="${1:?dot.key required (e.g. loader.update.hmr)}"; val="${2:?json value required (e.g. true)}"
    command -v jq >/dev/null 2>&1 || { echo "jq required on host for settings-set" >&2; exit 1; }
    p="$(settings_path)"; [ -n "$p" ] || { echo "settings.json not found" >&2; exit 1; }
    tmp="$(mktemp)"; out="$(mktemp)"
    _sudo "cat '$p'" > "$tmp"
    # Merge under the "unbound" store using a dotted path -> nested object.
    jq --arg k "$key" --argjson v "$val" '
      ($k | split(".")) as $path
      | .unbound = (.unbound // {})
      | .unbound |= setpath($path; $v)
    ' "$tmp" > "$out"
    _sudo "cp '$p' '$p.bak'"
    _scp "$out" "$TARGET:/tmp/unbound-settings.json"
    _sudo "cp /tmp/unbound-settings.json '$p' && rm -f /tmp/unbound-settings.json"
    rm -f "$tmp" "$out"
    echo "set unbound.$key = $val (backup at $p.bak)" ;;

  restart)
    _sudo "killall -9 Discord" || true
    _ssh "uiopen --bundleid $DISCORD_BID"
    echo "Discord restarted" ;;

  *)
    sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'
    exit 1 ;;
esac
