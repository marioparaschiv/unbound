#!/usr/bin/env bash
# Usage: session.sh <user|developer|moderator|admin> [--name N] [--field cookie|token|js]
# Prints a seeded session. `js` (default) is a preview_evaluate expression that signs the tab in.
set -euo pipefail

. "$(dirname "$(readlink -f "$0")")/lib.sh"

ROLE="${1:-}"
FIELD=js
ARGS=()
shift || true

while [ $# -gt 0 ]; do
	case "$1" in
		--field) FIELD="$2"; shift 2 ;;
		*) ARGS+=("$1"); shift ;;
	esac
done

parse_name "${ARGS[@]}"

case "$ROLE" in
	user | developer | moderator | admin) ;;
	*) echo "role must be user, developer, moderator or admin" >&2; exit 2 ;;
esac

[ -f "$DIR/sessions.json" ] || { echo "no $DIR/sessions.json; run launch.sh" >&2; exit 1; }

bun -e "
const session = require('$DIR/sessions.json')['$ROLE'];
const field = '$FIELD';

if (field === 'js') {
	console.log(\`document.cookie = \${JSON.stringify(session.cookie + '; path=/')}; location.reload(); 'signed in as $ROLE'\`);
} else {
	console.log(session[field]);
}
"
