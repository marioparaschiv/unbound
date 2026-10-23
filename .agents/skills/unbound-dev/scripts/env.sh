# Sourced by the other scripts. Per-machine overrides go in the repo's gitignored .env.
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
root=$(git -C "$here" rev-parse --show-toplevel 2>/dev/null || git rev-parse --show-toplevel) || exit 1

# Variables already in the environment win over .env.
if [[ -f $root/.env ]]; then
	while IFS='=' read -r key value || [[ -n $key ]]; do
		if [[ $key =~ ^[A-Za-z_][A-Za-z0-9_]*$ && -z ${!key+x} ]]; then
			value=${value%\"}
			value=${value#\"}
			export "$key=$value"
		fi
	done <"$root/.env"
fi

# The address the device reaches this machine at. Unset means the client's own LAN-IP guess.
: "${DEV_HOST:=$(cd "$root" && bun -e "import { resolveDevHost } from './packages/client/scripts/dev-host'; console.log(resolveDevHost())")}"
: "${UNBOUND_DEV_PORT:=3000}"
: "${UNBOUND_BRIDGE_PORT:=9090}"
: "${UNBOUND_CATALOG_PORT:=3200}"
: "${UNBOUND_LOG_DIR:=${TMPDIR:-/tmp}}"
export DEV_HOST UNBOUND_DEV_PORT UNBOUND_BRIDGE_PORT UNBOUND_CATALOG_PORT UNBOUND_LOG_DIR

# The checkout the unbound-dev tmux session serves. Worktrees share one device and one set of session names.
served_root() {
	local cwd

	cwd=$(tmux display -p -t '=unbound-dev:' '#{pane_current_path}' 2>/dev/null) || return 0
	git -C "$cwd" rev-parse --show-toplevel 2>/dev/null || echo "$cwd"
}
