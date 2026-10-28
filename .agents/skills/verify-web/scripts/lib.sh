# Shared paths for the verify-web scripts. Sourced, not run.
# shellcheck shell=bash

SKILL_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
REPO_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"
WEB_DIR="$REPO_ROOT/apps/web"
STATE_ROOT="${VERIFY_WEB_STATE:-/tmp/verify-web}"

INSTANCE="default"

parse_name() {
	while [ $# -gt 0 ]; do
		case "$1" in
			--name) INSTANCE="$2"; shift 2 ;;
			*) shift ;;
		esac
	done

	if ! [[ "$INSTANCE" =~ ^[a-z0-9-]+$ ]]; then
		echo "instance name must match [a-z0-9-]+, got '$INSTANCE'" >&2
		exit 2
	fi

	DIR="$STATE_ROOT/$INSTANCE"
	SESSION="verify-web-$INSTANCE"
	MINIO="verify-web-minio-$INSTANCE"
	DATABASE="unbound_web_verify_${INSTANCE//-/_}"
}

# instance.env holds PORT, URL, PANE_PID, GITHUB_PID, GITHUB_URL, GITHUB_TOKEN, DISCORD_PID,
# DISCORD_URL, MINIO_ADDR (empty when S3 is off).
load_instance() {
	[ -f "$DIR/instance.env" ] || return 1
	# shellcheck disable=SC1091
	. "$DIR/instance.env"
}
