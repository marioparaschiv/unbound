#!/usr/bin/env bash
# Blocks until Unbound runs on the device, then prints the time taken, the route and the last bundle fetch.
# Usage: ready.sh [--fresh] [--timeout <seconds>]
#   --fresh    also wait until the device fetched the bundle after the served checkout's build last changed it
#   --timeout  give up after this many seconds (default 30), exit 1
set -uo pipefail
. "$(dirname "$0")/env.sh"

fresh=0
timeout=30

while (($#)); do
	case $1 in
	--fresh) fresh=1 ;;
	--timeout) timeout=$2 && shift ;;
	*) sed -n '3,5s/^# //p' "$0" >&2 && exit 2 ;;
	esac
	shift
done

log=$UNBOUND_LOG_DIR/unbound-dev.log
serving=$(served_root)
dist=${serving:-$root}/packages/client/dist
start=$SECONDS

last_fetch() {
	grep -ao '([0-9:]*) GET /unbound\.[0-9]*\.bundle' "$log" 2>/dev/null | tail -n 1
}

# Idle rebuilds rewrite manifest.json but leave an unchanged bundle's mtime alone, so the bundle's mtime dates the build.
# The log stamps the time of day only, so a stamp later than now is from yesterday.
fetched_after_build() {
	local fetch at bundle

	fetch=$(last_fetch)
	[[ $fetch =~ \(([0-9:]{8})\)\ GET\ /(unbound\.[0-9]+\.bundle) ]] || return 1
	at=$(date -d "${BASH_REMATCH[1]}" +%s)
	bundle=$dist/${BASH_REMATCH[2]}

	if ((at > $(date +%s) + 60)); then
		((at -= 86400))
	fi

	((at >= $(stat -c %Y "$bundle")))
}

while :; do
	result=$("$here/ubd" eval 'typeof unbound' 2>&1)

	if grep -q '^object' <<<"$result"; then
		if ((!fresh)) || fetched_after_build; then
			break
		fi

		state="Unbound runs, but the last bundle fetch ($(last_fetch)) is older than the build in $dist"
	else
		state=$(tail -n 1 <<<"$result")
	fi

	if ((SECONDS - start >= timeout)); then
		echo "FAIL not ready after ${timeout}s: $state. Screenshot the device: an 'Unbound failed to initialize' alert means the build crashed." >&2
		exit 1
	fi

	sleep 1
done

echo "ready in $((SECONDS - start))s"
echo "route: $("$here/ubd" mcp route 2>&1 | tail -n 1)"
echo "last device bundle fetch: $(last_fetch)"

if [[ -n $serving && $serving != "$root" ]]; then
	echo "WARN unbound-dev serves $serving, not this checkout ($root)"
fi
