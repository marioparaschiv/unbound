#!/usr/bin/env bash
# Blocks until Unbound runs on the device, then prints the time taken, the route and the last bundle fetch.
# Usage: ready.sh [--fresh] [--timeout <seconds>]
#   --fresh    also wait until the device runs the served checkout's current build (its loader etag matches the bundle)
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

# The same hash the dev server sends as the bundle's ETag (packages/client/scripts/serve/hot-reload.ts).
served_etag() {
	bun -e 'console.log(Bun.hash(require("fs").readFileSync(process.argv[1])).toString(16))' "$dist/unbound.js" 2>/dev/null
}

# Compares content, not fetch times: an app already running the current build, or a restart that rebuilt it
# unchanged, fetches nothing new.
runs_served_build() {
	local device

	device=$("$here/ubd" eval 'unbound.storage.getBucket("unbound").get("loader.update.etag")' 2>&1 | grep -o '[0-9a-f]\{8,\}' | tail -n 1)
	[[ -n $device && $device == "$(served_etag)" ]]
}

while :; do
	result=$("$here/ubd" eval 'typeof unbound' 2>&1)

	if grep -q '^object' <<<"$result"; then
		if ((!fresh)) || runs_served_build; then
			break
		fi

		state="Unbound runs, but not the build in $dist (last bundle fetch: $(last_fetch))"
	else
		state=$(tail -n 1 <<<"$result")
	fi

	if ((SECONDS - start >= timeout)); then
		echo "FAIL not ready after ${timeout}s: $state. Screenshot the device: an 'Unbound failed to initialize' alert means the build crashed; a lock screen means Discord is not in front (scripts/relaunch unlocks it)." >&2
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
