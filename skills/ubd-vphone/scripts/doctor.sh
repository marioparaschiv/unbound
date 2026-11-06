#!/usr/bin/env bash
# Health check for the device loop. Exits 0 only when every check passes.
# Usage: doctor.sh [--fix]
#   --fix  repair what failed: claim.sh for the servers, served checkout, loader URL and a dead device; the catalog
#          stub restarts on its own. Then checks again. Exit 3: another agent holds the vphone.
set -uo pipefail
. "$(dirname "$0")/env.sh"

if [[ ${1:-} == --fix ]]; then
	report=$("$0")

	if [[ $? == 0 ]]; then
		echo "$report"
		exit 0
	fi

	grep -q '^FAIL catalog' <<<"$report" && "$here/up.sh" --restart=catalog catalog >/dev/null

	if grep -v '^FAIL catalog' <<<"$report" | grep -q '^FAIL'; then
		"$here/claim.sh"
		claimed=$?
		((claimed == 3)) && exit 3
	fi

	exec "$0"
fi

fail=0

check() {
	local label=$1
	shift

	if "$@" >/dev/null 2>&1; then
		echo "ok   $label"
	else
		echo "FAIL $label"
		fail=1
	fi
}

listening() {
	(exec 3<>"/dev/tcp/$DEV_HOST/$1") 2>/dev/null
}

# Read before this script's own eval writes to the console log.
console_age=$(($(date +%s) - $(stat -c %Y "$UNBOUND_LOG_DIR/unbound-debugger.log" 2>/dev/null || date +%s)))

echo "config: DEV_HOST=$DEV_HOST dev :$UNBOUND_DEV_PORT bridge :$UNBOUND_BRIDGE_PORT catalog :$UNBOUND_CATALOG_PORT"
check "bundle server serves manifest.json on :$UNBOUND_DEV_PORT" curl -sf -m 3 "http://$DEV_HOST:$UNBOUND_DEV_PORT/manifest.json"
check "debugger bridge listens on :$UNBOUND_BRIDGE_PORT" listening "$UNBOUND_BRIDGE_PORT"

serving=$(served_root)

if [[ $serving == "$root" ]]; then
	echo "ok   unbound-dev serves this checkout ($root)"
else
	echo "FAIL unbound-dev serves ${serving:-nothing}, not this checkout ($root)"
	fail=1
fi

if listening "$UNBOUND_CATALOG_PORT"; then
	check "catalog answers /api/v1/catalog on :$UNBOUND_CATALOG_PORT" curl -sf -m 3 "http://$DEV_HOST:$UNBOUND_CATALOG_PORT/api/v1/catalog"
fi

result=$("$here/ubd" eval 'typeof unbound' 2>&1)

if grep -q '^object' <<<"$result"; then
	echo 'ok   device connected and Unbound running'

	# Another agent may have pointed the loader at its own server; the device then never runs this dev server's build.
	url=$("$here/ubd" eval 'unbound.storage.getBucket("unbound").get("loader.update.url", "")' 2>&1 | tail -n 1 | tr -d '"')

	if [[ $url == "http://$DEV_HOST:$UNBOUND_DEV_PORT/"* ]]; then
		echo "ok   device loads its bundle from this dev server ($url)"
	else
		echo "FAIL device loads its bundle from ${url:-the default URL}, not http://$DEV_HOST:$UNBOUND_DEV_PORT"
		fail=1
	fi
else
	echo "FAIL device eval: $(tail -n 1 <<<"$result")"
	fail=1
fi

log=$UNBOUND_LOG_DIR/unbound-dev.log

if [[ -f $log ]]; then
	echo "last device bundle fetch: $(grep -ao '([0-9:]*) GET /unbound\.[0-9]*\.bundle' "$log" | tail -n 1)"
fi

echo "last device console line before this check: ${console_age}s ago"
echo "vphone claim: $(cat "$VPHONE_LOCK/owner" 2>/dev/null || echo none)"

exit $fail
