#!/usr/bin/env bash
# Prints the folder of Discord's decompiled JS for a version, decompiling it first when it is missing.
# Usage: source.sh [<version>]
#   <version>  such as 352.1; default: the version installed on the vphone, else the newest decompile present
# The folder holds main.js (the whole decompile) and mods/ (one file per source module). About 2 min to build.
set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
device=$here/../../ubd-vphone/scripts
cache=${XDG_CACHE_HOME:-$HOME/.cache}/unbound
ipas=${IPA_DIR:-$HOME/ipas}
bundle=com.hammerandchisel.discord
version=${1:-}

if [[ -z $version && -x $device/vphone ]]; then
	version=$("$device/vphone" app_info bundle_id=$bundle 2>/dev/null | grep -o '"version": "[^"]*"' | cut -d'"' -f4) || true
fi

if [[ -z $version ]]; then
	newest=$(ls -d "$cache"/discord-[0-9]* 2>/dev/null | sort -V | tail -n 1)
	[[ -n $newest ]] || { echo 'no version given, no vphone, and no decompile cached: pass <version>' >&2; exit 1; }
	echo "$newest"
	exit 0
fi

out=$cache/discord-$version

if [[ -f $out/mods/stores/UserStore.tsx ]]; then
	echo "$out"
	exit 0
fi

ipa=$(ls "$ipas"/$bundle-"$version"-*.ipa 2>/dev/null | grep -v -- '-ats\.ipa$' | head -n 1) || true

if [[ -z $ipa ]]; then
	[[ -x $device/fetch-ipa ]] || { echo "no IPA for $version in $ipas; download one (dkrypt) and rerun" >&2; exit 1; }
	echo "fetching Discord $version" >&2
	"$device/fetch-ipa" $bundle appstore >&2
	ipa=$(ls "$ipas"/$bundle-"$version"-*.ipa 2>/dev/null | grep -v -- '-ats\.ipa$' | head -n 1) ||
		{ echo "dkrypt's newest appstore build is not $version; pass a cached version or request a decrypt (setup.md)" >&2; exit 1; }
fi

echo "decompiling $ipa into $out (about 2 min)" >&2
python3 "$here/decompile.py" "$ipa" "$out" >&2

[[ -f $out/mods/stores/UserStore.tsx ]] || { echo "decompile finished without mods/stores/UserStore.tsx; see $out/dec.log" >&2; exit 1; }
echo "$out"
