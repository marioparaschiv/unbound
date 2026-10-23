#!/usr/bin/env bash
# Reports how the device took a hot update, without missing lines logged before the wait started.
# Usage: hot.sh mark                             print a mark; take it before saving the edit
#        hot.sh wait <mark> [--timeout <seconds>] block until the update after <mark> patched, reloaded or failed
# Exit 0 on patched or reloaded, 1 on a failed build or patch, or on timeout (default 60 s).
set -uo pipefail
. "$(dirname "$0")/env.sh"

device_log=$UNBOUND_LOG_DIR/unbound-debugger.log
server_log=$UNBOUND_LOG_DIR/unbound-dev.log

usage() {
	sed -n '3,5s/^# //p' "$0" >&2
	exit 2
}

size() {
	stat -c %s "$1" 2>/dev/null || echo 0
}

# A log shorter than the mark was restarted by up.sh, so read it from the start.
since() {
	local offset=$2

	if (($(size "$1") < offset)); then
		offset=0
	fi

	tail -c +"$((offset + 1))" "$1" 2>/dev/null
}

case ${1:-} in
mark)
	echo "$(size "$device_log"):$(size "$server_log")"
	exit 0
	;;
wait) [[ ${2:-} =~ ^[0-9]+:[0-9]+$ ]] || usage ;;
*) usage ;;
esac

IFS=: read -r device_mark server_mark <<<"$2"
timeout=60

if [[ ${3:-} == --timeout ]]; then
	timeout=${4:?}
fi

start=$SECONDS
reason=

while ((SECONDS - start < timeout)); do
	server=$(since "$server_log" "$server_mark")
	device=$(since "$device_log" "$device_mark" | grep -a '\[HotRefresh\]')

	if line=$(grep -a -m 1 -E 'Build failed|Hot update failed' <<<"$server"); then
		echo "failed: $line"
		grep -a -A 8 -F "$line" <<<"$server" | tail -n +2
		exit 1
	fi

	if line=$(grep -a -m 1 -E 'Patched |reloading' <<<"$device"); then
		case $line in
		*Patched*)
			echo "patched after $((SECONDS - start))s: ${line#*\[HotRefresh\] }"

			if [[ $line == *': 0 fibers'* ]]; then
				echo 'WARN no mounted component re-rendered; open the screen that shows it'
			fi

			exit 0
			;;
		esac

		reason=${line#*\[HotRefresh\] }
	elif line=$(grep -a -m 1 'Full reload:' <<<"$server"); then
		reason=${line#*Full reload: }
	else
		sleep 0.5
		continue
	fi

	# The reloaded bundle's socket logs Connected after the trigger. A server-side trigger has no device line to anchor on.
	if [[ $line == *'Full reload:'* ]]; then
		after=$device
	else
		after=$(grep -a -A 1000000 -F -- "$line" <<<"$device" | tail -n +2)
	fi

	if grep -q '\[HotRefresh\] Connected' <<<"$after"; then
		echo "reloaded after $((SECONDS - start))s: $reason"
		exit 0
	fi

	sleep 0.5
done

if [[ -n $reason ]]; then
	echo "FAIL the app began a reload ($reason) but did not reconnect within ${timeout}s; run ready.sh, else relaunch"
	exit 1
fi

echo "FAIL no outcome within ${timeout}s. Server log since the mark:"
since "$server_log" "$server_mark" | grep -a -E 'Patching|Full reload|Build (completed|failed)' | tail -n 5
exit 1
