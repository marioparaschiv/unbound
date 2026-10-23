#!/usr/bin/env bash
# Starts the dev loop's servers in tmux sessions, leaving running ones alone, then waits until the dev server is up.
# Usage: up.sh [--restart[=dev|debugger|catalog]] [catalog]
#   --restart      stop every session first, so they pick up new settings
#   --restart=dev  stop only that session; restarting dev or catalog keeps the device on the bridge
#   catalog        also serve catalog-stub.ts and point the dev build's API at it
set -euo pipefail
. "$(dirname "$0")/env.sh"

restart=
api=${UNBOUND_API_URL:-}
stub=

for arg; do
	case $arg in
	--restart) restart=all ;;
	--restart=dev | --restart=debugger | --restart=catalog) restart=${arg#--restart=} ;;
	catalog)
		api=http://$DEV_HOST:$UNBOUND_CATALOG_PORT
		stub="env PORT=$UNBOUND_CATALOG_PORT bun '$here/catalog-stub.ts'"
		;;
	*) sed -n '3,6s/^# //p' "$0" >&2 && exit 2 ;;
	esac
done

command -v tmux >/dev/null || { echo 'up.sh needs tmux' >&2; exit 1; }

previous=$(served_root)

start() {
	local name=unbound-$1 cmd=$2 log=$UNBOUND_LOG_DIR/unbound-$1.log

	if [[ $restart == all || $restart == "$1" ]]; then
		tmux kill-session -t "=$name" 2>/dev/null || true
	fi

	if tmux has-session -t "=$name" 2>/dev/null; then
		echo "running $name"
		return
	fi

	tmux new-session -d -s "$name" -c "$root" "$cmd 2>&1 | tee '$log'"
	echo "started $name, log $log"
}

start debugger "bun packages/debugger/src/index.ts --port $UNBOUND_BRIDGE_PORT"
[[ -n $stub ]] && start catalog "$stub"
start dev "env PORT=$UNBOUND_DEV_PORT DEV_HOST=$DEV_HOST DEBUGGER_PORT=$UNBOUND_BRIDGE_PORT ${api:+UNBOUND_API_URL=$api} bun run --filter @unbound-app/client dev"

log=$UNBOUND_LOG_DIR/unbound-dev.log
began=$SECONDS

until grep -aq 'Press Ctrl+C to stop' "$log" 2>/dev/null; do
	if grep -aq 'Build failed' "$log" 2>/dev/null || ((SECONDS - began > 180)); then
		echo "FAIL the dev server is not up; tail of $log:" >&2
		tail -n 15 "$log" >&2
		exit 1
	fi

	sleep 1
done

serving=$(served_root)
echo "unbound-dev is up, serving $serving"

if [[ -n $previous && $previous != "$serving" ]]; then
	echo "It served $previous before. The device still runs that build: relaunch, or ubd reload, then ready.sh --fresh."
fi
