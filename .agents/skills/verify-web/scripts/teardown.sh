#!/usr/bin/env bash
# Usage: teardown.sh [--name N]
# Stops only what launch.sh started for this instance (its tmux session, its pane pid, its MinIO
# container) and deletes its state dir. Evidence lives elsewhere and is never touched.
set -uo pipefail

. "$(dirname "$(readlink -f "$0")")/lib.sh"

parse_name "$@"

load_instance || true

if tmux has-session -t "=$SESSION" 2>/dev/null; then
	tmux kill-session -t "=$SESSION"
	echo "killed tmux session $SESSION"
fi

# vite runs as a node child of the pane pid; match children by parent pid, never by name.
if [ -n "${PANE_PID:-}" ]; then
	for pid in $(pgrep -P "$PANE_PID") "$PANE_PID"; do
		kill -0 "$pid" 2>/dev/null || continue
		kill "$pid"
		timeout 5 tail --pid="$pid" -f /dev/null || kill -9 "$pid"
		echo "killed pid $pid"
	done
fi

if command -v podman >/dev/null && podman container exists "$MINIO" 2>/dev/null; then
	podman stop --time 0 "$MINIO" >/dev/null
	echo "stopped container $MINIO"
fi

case "$DIR" in
	"$STATE_ROOT"/?*) rm -rf "$DIR" && echo "removed $DIR" ;;
esac

if [ -n "${PORT:-}" ] && [ -n "$(ss -ltnH "sport = :$PORT")" ]; then
	echo "warning: port $PORT is still bound by something this script did not start" >&2
fi
