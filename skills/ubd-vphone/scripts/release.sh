#!/usr/bin/env bash
# Hands the vphone back after claim.sh: restores the checkout the dev server served before and the device's
# loader URL, relaunches Discord onto that build, and drops the lock. Does nothing when this checkout holds no claim.
# Usage: release.sh [--keep-running]
#   --keep-running  restore the server and URL but leave Discord running the current build
set -uo pipefail
. "$(dirname "$0")/env.sh"

relaunch=1
[[ ${1:-} == --keep-running ]] && relaunch=0

lock=$VPHONE_LOCK

if ! grep -q "^agent $root " "$lock/owner" 2>/dev/null; then
	echo "no claim by $root to release (holder: $(cat "$lock/owner" 2>/dev/null || echo none))"
	exit 0
fi

served=$(sed -n 's/^served=//p' "$lock/previous" 2>/dev/null)
url=$(sed -n 's/^url=//p' "$lock/previous" 2>/dev/null)

if [[ -n $served && $served != "$root" && -d $served ]]; then
	# The tmux session runs from its checkout, so restart it from there with this script set.
	UNBOUND_ROOT=$served "$here/up.sh" --restart=dev || echo "WARN could not restore the dev server to $served" >&2
fi

if [[ -n $url ]]; then
	"$here/ubd" eval "unbound.storage.getBucket('unbound').set('loader.update.url', '$url')" >/dev/null ||
		echo "WARN could not restore the loader URL to $url" >&2
fi

((relaunch)) && { "$here/relaunch" --stale --force >/dev/null || echo 'WARN Discord did not come back up; run relaunch' >&2; }

rm -rf "$lock"
echo "released; serving ${served:-unchanged}, loader URL ${url:-unchanged}"
