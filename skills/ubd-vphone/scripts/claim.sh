#!/usr/bin/env bash
# Takes the vphone for this checkout: the shared lock, the dev server, and the device's loader URL.
# Usage: claim.sh [--minutes <n>] [--wait]
#   --minutes  how long the claim lasts before another agent may take it (default 30); rerun to extend
#   --wait     wait for another agent's claim to end instead of exiting 3
# Exit 0: this checkout owns the vphone and the device runs its build. 1: a step failed. 3: another driver holds it.
# release.sh undoes it: it restores the previously served checkout and loader URL, then drops the lock.
set -uo pipefail
. "$(dirname "$0")/env.sh"

minutes=30
wait=0

while (($#)); do
	case $1 in
	--minutes) minutes=$2 && shift ;;
	--wait) wait=1 ;;
	*) sed -n '3,5s/^# //p' "$0" >&2 && exit 2 ;;
	esac
	shift
done

if [[ ! -d $root/node_modules ]]; then
	echo "FAIL $root has no node_modules: run bun install there first" >&2
	exit 1
fi

lock=$VPHONE_LOCK
owner="agent $root until=$(($(date +%s) + minutes * 60))"

# Prints the current holder when someone else holds a live claim; nothing when it is free, stale or ours.
other_holder() {
	local current until pid

	current=$(cat "$lock/owner" 2>/dev/null) || return 0
	[[ $current == "agent $root "* ]] && return 0

	until=$(grep -o 'until=[0-9]*' <<<"$current" | cut -d= -f2)
	pid=$(grep -o 'pid=[0-9]*' <<<"$current" | cut -d= -f2)

	if [[ -n $until ]] && ((until < $(date +%s))); then return 0; fi
	if [[ -n $pid ]] && ! kill -0 "$pid" 2>/dev/null; then return 0; fi

	echo "$current"
}

began=$SECONDS

while holder=$(other_holder) && [[ -n $holder ]]; do
	if ((!wait)); then
		echo "vphone is claimed by: $holder" >&2
		echo 'Wait with claim.sh --wait, or ask its owner to run release.sh.' >&2
		exit 3
	fi

	if ((SECONDS - began > 520)); then
		echo "still claimed after ${SECONDS}s by: $holder; rerun claim.sh --wait" >&2
		exit 3
	fi

	sleep 5
done

fresh_claim=0
[[ -f $lock/owner ]] && grep -q "^agent $root " "$lock/owner" || fresh_claim=1

mkdir -p "$lock"
echo "$owner" >"$lock/owner"

if ((fresh_claim)); then
	# Remember what to hand back. A stale claim's record is replaced, since its owner is gone.
	url=$("$here/ubd" debug eval 'unbound.storage.getBucket("unbound").get("loader.update.url", "")' 2>/dev/null | tail -n 1 | tr -d '"')
	printf 'served=%s\nurl=%s\n' "$(served_root)" "$url" >"$lock/previous"
fi

echo "claimed for $minutes min: $root"

# A failure past this point would leave the device without a working server: hand it back.
rollback() {
	echo 'FAIL claim did not finish; handing the vphone back' >&2
	"$here/release.sh" >&2
	exit 1
}

"$here/up.sh" $([[ $(served_root) != "$root" ]] && echo --restart=dev) || rollback

want="http://$DEV_HOST:$UNBOUND_DEV_PORT/unbound.bundle"
url=$("$here/ubd" debug eval 'unbound.storage.getBucket("unbound").get("loader.update.url", "")' 2>/dev/null | tail -n 1 | tr -d '"')

if [[ $url != "$want" ]]; then
	"$here/ubd" debug eval "unbound.storage.getBucket('unbound').set('loader.update.url', '$want')" >/dev/null || rollback
	echo "loader URL set to $want (was ${url:-unset})"
fi

if "$here/ready.sh" --fresh --timeout 5 >/dev/null 2>&1; then
	echo 'device already runs this build'
else
	"$here/relaunch" --force || rollback
fi
