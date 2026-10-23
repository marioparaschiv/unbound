#!/usr/bin/env bash
# Usage: launch.sh [--name N] [--port N] [--no-s3]
# Starts a throwaway apps/web instance: fake OAuth, temp SQLite, local MinIO, seeded users.
set -euo pipefail

. "$(dirname "$(readlink -f "$0")")/lib.sh"

PORT=""
S3=1
ARGS=("$@")

while [ $# -gt 0 ]; do
	case "$1" in
		--port) PORT="$2"; shift 2 ;;
		--no-s3) S3=0; shift ;;
		--name) shift 2 ;;
		*) echo "unknown argument: $1" >&2; exit 2 ;;
	esac
done

parse_name "${ARGS[@]}"

if [ -d "$DIR" ]; then
	if "$SKILL_DIR/scripts/doctor.sh" --name "$INSTANCE" >/dev/null 2>&1; then
		load_instance
		echo "already running: $URL"
		exit 0
	fi

	echo "instance '$INSTANCE' exists but is unhealthy; tearing it down first"
	"$SKILL_DIR/scripts/teardown.sh" --name "$INSTANCE"
fi

port_free() {
	[ -z "$(ss -ltnH "sport = :$1")" ]
}

if [ -z "$PORT" ]; then
	PORT=4310
	until port_free "$PORT"; do PORT=$((PORT + 1)); done
elif ! port_free "$PORT"; then
	echo "port $PORT is taken" >&2
	exit 1
fi

if [ "$S3" = 1 ] && ! command -v podman >/dev/null; then
	echo "podman not found; continuing with --no-s3 (submit and review approval will fail)" >&2
	S3=0
fi

mkdir -p "$DIR/db"
# Cookies ignore ports, so a per-instance *.localhost host keeps this session cookie from colliding
# with any other app on localhost.
URL="http://verify-web-$INSTANCE.localhost:$PORT"
MINIO_ADDR=""

fail() {
	echo "launch failed: $1" >&2

	if [ -f "$DIR/vite.log" ]; then
		cp "$DIR/vite.log" "$STATE_ROOT/$INSTANCE.failed.log"
		tail -n 40 "$DIR/vite.log" >&2
		echo "full log kept at $STATE_ROOT/$INSTANCE.failed.log" >&2
	fi

	"$SKILL_DIR/scripts/teardown.sh" --name "$INSTANCE" >&2
	exit 1
}

if [ "$S3" = 1 ]; then
	podman run --detach --rm --name "$MINIO" \
		--publish 127.0.0.1::9000 \
		--env MINIO_ROOT_USER=verify-web \
		--env MINIO_ROOT_PASSWORD=verify-web-password \
		--env MC_HOST_local=http://verify-web:verify-web-password@127.0.0.1:9000 \
		"${MINIO_IMAGE:-cgr.dev/chainguard/minio}" server /data >/dev/null || fail "minio did not start"
	podman exec "$MINIO" mc ready local >/dev/null || fail "minio not ready"
	podman exec "$MINIO" mc mb local/unbound-staging local/unbound-addons >/dev/null
	podman exec "$MINIO" mc anonymous set download local/unbound-addons >/dev/null
	MINIO_ADDR="$(podman port "$MINIO" 9000/tcp)"
	S3_ENDPOINT="http://$MINIO_ADDR"
else
	# Nothing listens on the discard port, so any storage call fails fast instead of hanging.
	S3_ENDPOINT="http://127.0.0.1:9"
fi

cat >"$DIR/web.env" <<EOF
PORT=$PORT
PUBLIC_URL=$URL
CDN_URL=$S3_ENDPOINT/unbound-addons
DATABASE_PATH=$DIR/db/unbound.db
BETTER_AUTH_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '/+=')
DISCORD_CLIENT_ID=verify-web-discord
DISCORD_CLIENT_SECRET=verify-web-discord-secret
GITHUB_CLIENT_ID=verify-web-github
GITHUB_CLIENT_SECRET=verify-web-github-secret
S3_ENDPOINT=$S3_ENDPOINT
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=verify-web
S3_SECRET_ACCESS_KEY=verify-web-password
S3_STAGING_BUCKET=unbound-staging
S3_PUBLIC_BUCKET=unbound-addons
EOF

(
	cd "$WEB_DIR"
	set -a
	. "$DIR/web.env"
	set +a
	bun scripts/migrate.ts >"$DIR/migrate.log" 2>&1 || { cat "$DIR/migrate.log" >&2; exit 1; }
	VERIFY_WEB_S3="$S3" bun "$SKILL_DIR/scripts/seed.ts" "$DIR/sessions.json"
) || fail "migrate or seed failed"

# An already-running tmux server keeps its own PATH, so pass ours or `bun` may not resolve.
tmux new-session -d -s "$SESSION" -e "PATH=$PATH" \
	"exec >'$DIR/vite.log' 2>&1; cd '$WEB_DIR' && set -a && . '$DIR/web.env' && set +a && exec bun --bun vite dev --port $PORT --strictPort"
PANE_PID="$(tmux list-panes -t "=$SESSION" -F '#{pane_pid}')"

cat >"$DIR/instance.env" <<EOF
PORT=$PORT
URL=$URL
PANE_PID=$PANE_PID
MINIO_ADDR=$MINIO_ADDR
EOF

for _ in $(seq 1 120); do
	kill -0 "$PANE_PID" 2>/dev/null || fail "vite exited"
	code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$URL/" || true)"
	[ "$code" = 200 ] && break
	sleep 1
done

[ "$code" = 200 ] || fail "GET / never returned 200 (last: $code)"
"$SKILL_DIR/scripts/doctor.sh" --name "$INSTANCE" || fail "doctor failed after boot"

echo "ready: $URL"
echo "sessions: $DIR/sessions.json (sign in with scripts/session.sh <role> --name $INSTANCE)"
