#!/usr/bin/env bash
# Brings Discord to the front with Unbound attached to avd-bridge, and blocks until it answers an eval.
# Usage: ready.sh [--fresh] [--relaunch] [--timeout <seconds>]
#   --fresh     also wait until Discord runs avd-dev's current build (its loader etag matches the bundle)
#   --relaunch  stop Discord first, for code that only runs at startup
#   --timeout   give up after this many seconds (default 60)
# Exit 0 ready, 1 not ready (prints the screen's text and Discord's last crash), 4 Discord is signed out.
set -uo pipefail
. "$(dirname "$0")/env.sh"

fresh=0
relaunch=0
timeout=60

while (($#)); do
	case $1 in
	--fresh) fresh=1 ;;
	--relaunch) relaunch=1 ;;
	--timeout) timeout=$2 && shift ;;
	*) sed -n '3,6s/^# //p' "$0" >&2 && exit 2 ;;
	esac
	shift
done

if ! with_timeout 10 "$ADB" -s "$AVD_SERIAL" get-state >/dev/null 2>&1; then
	echo "FAIL $AVD_SERIAL is not attached: scripts/up.sh emu" >&2
	exit 1
fi

if ! port_busy "$AVD_BRIDGE_PORT"; then
	echo "FAIL nothing listens on the bridge port $AVD_BRIDGE_PORT: scripts/up.sh bridge" >&2
	exit 1
fi

# Settings first: a Discord pointed elsewhere never reaches this bridge, however long we wait.
"$here/point.sh" --no-launch | sed 's/^/point: /' || exit 1

adb_avd shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1
adb_avd shell wm dismiss-keyguard >/dev/null 2>&1
((relaunch)) && adb_avd shell am force-stop com.discord

foreground() {
	adb_avd shell dumpsys activity activities 2>/dev/null | grep -m1 -E 'topResumedActivity|mResumedActivity' | grep -q 'com.discord/'
}

launch() {
	adb_avd shell monkey -p com.discord -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
}

# The visible text on screen, one label per line, from the accessibility tree.
screen_text() {
	adb_avd shell uiautomator dump /sdcard/ubd-avd-ui.xml >/dev/null 2>&1
	adb_avd shell cat /sdcard/ubd-avd-ui.xml 2>/dev/null | grep -oE 'text="[^"]+"' | cut -d'"' -f2 | awk '!seen[$0]++'
}

signed_out() {
	local text

	text=$(screen_text)
	grep -qx 'Log In' <<<"$text" && grep -qx 'Register' <<<"$text"
}

# The same hash the dev server sends as the bundle's ETag (packages/client/scripts/serve/hot-reload.ts).
served_etag() {
	local served

	served=$(tmux display -p -t '=avd-dev:' '#{pane_current_path}' 2>/dev/null) || return 0
	bun -e 'console.log(Bun.hash(require("fs").readFileSync(process.argv[1])).toString(16))' \
		"$served/packages/client/dist/unbound.js" 2>/dev/null
}

device_etag() {
	"$here/ubd" debug eval 'unbound.storage.getBucket("unbound").get("loader.update.etag")' 2>&1 | grep -o '[0-9a-f]\{8,\}' | tail -n 1
}

start=$SECONDS
state='Discord has not started'

while :; do
	foreground || launch
	result=$("$here/ubd" debug eval 'typeof unbound' 2>&1)

	if grep -q '^object' <<<"$result"; then
		if ((!fresh)); then
			break
		fi

		served=$(served_etag)
		[[ -n $served && $(device_etag) == "$served" ]] && break
		state="Unbound runs, but not avd-dev's current build (device $(device_etag), served ${served:-unknown})"
	else
		state=$(tail -n 1 <<<"$result")
	fi

	if ((SECONDS - start >= timeout)); then
		echo "FAIL not ready after ${timeout}s: $state" >&2
		echo "Screen text:" >&2
		screen_text | head -n 15 | sed 's/^/  /' >&2
		echo "Discord's last crash (empty if none):" >&2
		adb_avd logcat -b crash -d -t 30 2>/dev/null | grep -A8 'com.discord' | head -n 20 | sed 's/^/  /' >&2
		echo "Logs: scripts/ubd device logs --since 2m; /tmp/avd-dev.log for build errors" >&2
		exit 1
	fi

	sleep 1
done

if signed_out; then
	echo "SIGNED OUT Unbound runs, but Discord shows its sign-in screen. A human must sign in (preview.md); agents cannot." >&2
	exit 4
fi

echo "ready in $((SECONDS - start))s"
echo "route: $("$here/ubd" debug route 2>&1 | tail -n 1)"
served=$(tmux display -p -t '=avd-dev:' '#{pane_current_path}' 2>/dev/null)

if [[ -n $served && $served != "$root" ]]; then
	echo "WARN avd-dev serves $served, not this checkout ($root); up.sh --restart=dev takes it over"
fi
