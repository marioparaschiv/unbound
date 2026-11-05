# Sourced by the other scripts. Per-machine overrides go in the repo's gitignored .env.
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# UNBOUND_ROOT lets release.sh run these scripts against the checkout it hands the device back to.
root=${UNBOUND_ROOT:-$(git -C "$here" rev-parse --show-toplevel 2>/dev/null || git rev-parse --show-toplevel)} || exit 1

# A fresh worktree has no .env; fall back to the main checkout's, which every worktree shares.
env_file=$root/.env
[[ -f $env_file ]] || env_file=$(dirname "$(git -C "$root" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)")/.env

# Variables already in the environment win over .env.
if [[ -f $env_file ]]; then
	while IFS='=' read -r key value || [[ -n $key ]]; do
		if [[ $key =~ ^[A-Za-z_][A-Za-z0-9_]*$ && -z ${!key+x} ]]; then
			value=${value%\"}
			value=${value#\"}
			export "$key=$value"
		fi
	done <"$env_file"
fi

# The address the device reaches this machine at. Unset means the client's own LAN-IP guess.
: "${DEV_HOST:=$(cd "$root" && bun -e "import { resolveDevHost } from './packages/client/scripts/dev-host'; console.log(resolveDevHost())")}"
: "${UNBOUND_DEV_PORT:=3000}"
: "${UNBOUND_BRIDGE_PORT:=9090}"
: "${UNBOUND_CATALOG_PORT:=3200}"
: "${UNBOUND_LOG_DIR:=${TMPDIR:-/tmp}}"
# The tailnet MCP hub the vphone scripts call; unset means a hub on this machine's tailnet address.
[[ -n ${TAILNET_URL:-} ]] || TAILNET_URL=$(ip=$(tailscale ip -4 2>/dev/null | head -n 1) && [[ -n $ip ]] && echo "http://$ip:8790")
# The one-driver lock every agent and `bun run bench` share: a folder whose `owner` file names the holder.
VPHONE_LOCK=/tmp/unbound-vphone.lock
export DEV_HOST UNBOUND_DEV_PORT UNBOUND_BRIDGE_PORT UNBOUND_CATALOG_PORT UNBOUND_LOG_DIR TAILNET_URL VPHONE_LOCK
export UNBOUND_CHECKOUT=$root

# The checkout the unbound-dev tmux session serves. Worktrees share one device and one set of session names.
served_root() {
	local cwd

	cwd=$(tmux display -p -t '=unbound-dev:' '#{pane_current_path}' 2>/dev/null) || return 0
	git -C "$cwd" rev-parse --show-toplevel 2>/dev/null || echo "$cwd"
}
