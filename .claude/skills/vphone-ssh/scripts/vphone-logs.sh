#!/usr/bin/env bash
#
# vphone-logs.sh — structured, timestamped Unbound logs from the virtual iPhone.
#
# Unbound logs via os_log. There is NO on-device `log` binary, so we read os_log
# HOST-side: idevicesyslog pulls a `.logarchive` from the device, and the host's
# /usr/bin/log renders it as NDJSON (one JSON event per line). We then pick the
# two Unbound sources by SUBSYSTEM (no syslog-line regex):
#
#   app.unbound             → native os_log (Logger.m)
#   com.facebook.react.log  → JS / React Native console.* (category "javascript")
#
# Every field (timestamp, level, subsystem, category, message) comes typed from
# the JSON; format-logs.jq turns each event into a clean line. The ONLY string
# cleanup is ANSI removal + unwrapping the JS console arg-list, done by jq on the
# message field — never on the whole log line.
#
# LEVELS: --info --debug are REQUIRED. RN logs everything at "Info" type, but the
# unified-logging store still gates Info/Debug events behind these flags; without
# them ~all JS (and most native) lines vanish. We never filter by level.
#
# Live `stream` = poll: pull a short archive every INTERVAL seconds and emit only
# events newer than the last one seen (dedup by machTimestamp). Host `log stream`
# can't target a remote device, and idevicesyslog has no structured output, so
# polling is how we keep the clean ndjson pipeline live (~INTERVAL latency).
#
# SAFETY: two devices are usually paired — the throwaway vphone AND a real iPhone.
# We resolve the vphone by ProductType iPhone99,11 and NEVER fall back to the real
# device. Override with VPHONE_UDID.
#
# Usage:
#   vphone-logs.sh show [seconds] [grep]   # snapshot last N seconds (default 30)
#   vphone-logs.sh since <unixts> [grep]   # snapshot from an absolute UNIX time
#   vphone-logs.sh stream [grep]           # live tail (Ctrl-C to stop)
#   vphone-logs.sh udid                    # print resolved vphone UDID
#   vphone-logs.sh json [seconds]          # raw Unbound NDJSON (for piping)
#
#   [grep] is an optional case-insensitive substring the formatted line must
#   contain, e.g. "updater" or "[JS]".
#
# Pin a window to an action: grab the time, do the action, then `since`:
#   T=$(date +%s); vphone.sh restart; vphone-logs.sh since "$T"
#
# Env: VPHONE_UDID (override), VPHONE_LOG_INTERVAL (stream poll seconds, default 2).
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JQ_FMT="$HERE/format-logs.jq"
VPHONE_PRODUCT="iPhone99,11"
PREDICATE='subsystem == "app.unbound" OR subsystem == "com.facebook.react.log"'
INTERVAL="${VPHONE_LOG_INTERVAL:-2}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "$1 not found (brew install $2)" >&2; exit 1; }; }
need idevicesyslog libimobiledevice
need jq jq
[ -x /usr/bin/log ] || { echo "/usr/bin/log (macOS unified logging) not found" >&2; exit 1; }

resolve_udid() {
  if [ -n "${VPHONE_UDID:-}" ]; then echo "$VPHONE_UDID"; return; fi
  need idevice_id libimobiledevice; need ideviceinfo libimobiledevice
  local match=""
  while IFS= read -r udid; do
    [ -n "$udid" ] || continue
    if [ "$(ideviceinfo -u "$udid" -k ProductType 2>/dev/null || true)" = "$VPHONE_PRODUCT" ]; then
      [ -z "$match" ] && match="$udid" || { echo "multiple vphone candidates; set VPHONE_UDID" >&2; exit 1; }
    fi
  done < <(idevice_id -l 2>/dev/null)
  [ -n "$match" ] || { echo "vphone ($VPHONE_PRODUCT) not found; set VPHONE_UDID" >&2; exit 1; }
  echo "$match"
}

# Emit Unbound NDJSON for device $2, windowed by spec $1:
#   age:<secs>     -> last <secs> seconds (idevicesyslog --age-limit)
#   since:<unixts> -> from absolute UNIX timestamp (idevicesyslog --start-time),
#                     plus an exact post-filter so nothing older than <unixts>
#                     leaks in (the archive over-fetches around the boundary).
# The window is anchored at PULL time; events are sorted by machTimestamp.
pull_ndjson() {
  local spec="$1" udid="$2"
  local tmp; tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN

  local kind="${spec%%:*}" val="${spec#*:}" start_pred=""
  case "$kind" in
    since)
      idevicesyslog -u "$udid" archive "$tmp/a.tar" --start-time "$val" >/dev/null 2>&1 || return 0
      # `log show --start` takes a local "YYYY-MM-DD HH:MM:SS" — exact post-trim
      # in case the archive over-fetches around the boundary.
      start_pred="$(date -r "$val" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || true)" ;;
    age|*)
      [ "$kind" = age ] || val="$spec"   # bare number => treat as age seconds
      idevicesyslog -u "$udid" archive "$tmp/a.tar" --age-limit "$val" >/dev/null 2>&1 || return 0 ;;
  esac

  # The tar IS a logarchive's contents (Info.plist, *.tracev3, Persist/, …), but
  # `log` requires the directory name to end in `.logarchive`, so extract there.
  mkdir -p "$tmp/d.logarchive"
  tar -xf "$tmp/a.tar" -C "$tmp/d.logarchive" 2>/dev/null || return 0
  local show_args=(--archive "$tmp/d.logarchive" --predicate "$PREDICATE" --info --debug --style ndjson)
  [ -n "$start_pred" ] && show_args+=(--start "$start_pred")
  /usr/bin/log show "${show_args[@]}" 2>/dev/null \
    | jq -rR 'fromjson? // empty' 2>/dev/null || true
}

# NDJSON (stdin) -> clean formatted lines, with optional case-insensitive
# FIXED-STRING filter (so "[JS]" matches literally, not as a regex class).
format() {
  local extra="${1:-}"
  if [ -n "$extra" ]; then
    jq -rcf "$JQ_FMT" 2>/dev/null | grep -iF --line-buffered -e "$extra"
  else
    jq -rcf "$JQ_FMT" 2>/dev/null
  fi
}

case "${1:-stream}" in
  udid) resolve_udid ;;

  json)
    UDID="$(resolve_udid)"; SECS="${2:-30}"
    pull_ndjson "age:$SECS" "$UDID" ;;

  show)
    UDID="$(resolve_udid)"; SECS="${2:-30}"; EXTRA="${3:-}"
    echo ">> last ${SECS}s from vphone $UDID (native app.unbound + JS com.facebook.react.log, all levels)" >&2
    pull_ndjson "age:$SECS" "$UDID" | format "$EXTRA" ;;

  since)
    UDID="$(resolve_udid)"; TS="${2:?since requires a UNIX timestamp (see: $0 now)}"; EXTRA="${3:-}"
    echo ">> since $(date -r "$TS" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "$TS") from vphone $UDID (native + JS, all levels)" >&2
    pull_ndjson "since:$TS" "$UDID" | format "$EXTRA" ;;

  stream)
    UDID="$(resolve_udid)"; EXTRA="${2:-}"
    echo ">> streaming vphone $UDID (poll ${INTERVAL}s, native + JS, all levels) — Ctrl-C to stop" >&2
    win="$(mktemp)"; trap 'rm -f "$win"' EXIT
    last=0
    while :; do
      # One pull per round, reused twice: print events newer than `last`, then
      # advance `last` to the newest machTimestamp in this window (dedup).
      pull_ndjson "$((INTERVAL + 3))" "$UDID" > "$win" || true
      jq -rc --argjson last "$last" 'select((.machTimestamp // 0) > $last)' < "$win" | format "$EXTRA"
      newest="$(jq -rs 'map(.machTimestamp // 0) | max // 0 | floor' < "$win" 2>/dev/null || echo 0)"
      [ "${newest:-0}" -gt "$last" ] 2>/dev/null && last="$newest"
      sleep "$INTERVAL"
    done ;;

  *)
    sed -n '2,42p' "$0" | sed 's/^# \{0,1\}//'
    exit 1 ;;
esac
