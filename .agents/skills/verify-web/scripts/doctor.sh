#!/usr/bin/env bash
# Usage: doctor.sh [--name N]
# Read-only: is this instance up, ours, serving this checkout, and are its seeded sessions valid?
set -uo pipefail

. "$(dirname "$(readlink -f "$0")")/lib.sh"

parse_name "$@"

failed=0

check() {
	if [ "$2" = ok ]; then
		echo "PASS $1"
	else
		echo "FAIL $1: $2"
		failed=1
	fi
}

if ! load_instance; then
	check "instance $INSTANCE" "no $DIR/instance.env; run launch.sh"
	exit 1
fi

tmux has-session -t "=$SESSION" 2>/dev/null && r=ok || r="tmux session $SESSION missing"
check "tmux session $SESSION" "$r"

kill -0 "$PANE_PID" 2>/dev/null && r=ok || r="pid $PANE_PID is gone"
check "vite pid $PANE_PID alive" "$r"

# `bun --bun vite` still runs vite as a node child of the pane process, so check the parent chain.
owned() {
	local pid="$1"

	while [ -n "$pid" ] && [ "$pid" -gt 1 ]; do
		[ "$pid" = "$PANE_PID" ] && return 0
		pid="$(ps -o ppid= -p "$pid" | tr -d ' ')"
	done

	return 1
}

holders="$(ss -ltnpH "sport = :$PORT" | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u)"
r="port $PORT held by '${holders:-nothing}', not pid $PANE_PID or its children"

for pid in $holders; do
	owned "$pid" && r=ok
done
check "port $PORT owned by our pid" "$r"

cwd="$(readlink "/proc/$PANE_PID/cwd" 2>/dev/null)"
[ "$cwd" = "$WEB_DIR" ] && r=ok || r="serving '$cwd', not $WEB_DIR"
check "serving this checkout" "$r"

code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$URL/")"
[ "$code" = 200 ] && r=ok || r="HTTP $code"
check "GET $URL/" "$r"

addons="$(curl -s --max-time 30 "$URL/api/v1/addons")"
grep -q '"verify.hello"' <<<"$addons" && r=ok || r="seeded addon verify.hello missing: ${addons:0:200}"
check "GET /api/v1/addons lists the seed" "$r"

token="$(bun -e "console.log(require('$DIR/sessions.json').admin.token)" 2>/dev/null)"
me="$(curl -s --max-time 30 -H "authorization: Bearer $token" "$URL/api/v1/me")"
grep -q '"admin"' <<<"$me" && r=ok || r="admin session rejected: ${me:0:200}"
check "admin session valid" "$r"

if [ -n "$MINIO_ADDR" ]; then
	code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://$MINIO_ADDR/minio/health/live")"
	[ "$code" = 200 ] && r=ok || r="HTTP $code"
	check "minio $MINIO_ADDR live" "$r"
else
	echo "SKIP minio (launched with --no-s3)"
fi

exit "$failed"
