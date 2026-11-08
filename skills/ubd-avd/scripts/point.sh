#!/usr/bin/env bash
# Points Unbound on the AVD at avd-dev and avd-bridge (loader URL, HMR, debugger), then relaunches Discord.
# Usage: point.sh [--no-launch]
#   --no-launch  leave Discord stopped after a change
# Creates settings.json when Unbound never ran, and moves an unreadable one to settings.json.broken first.
set -euo pipefail
. "$(dirname "$0")/env.sh"

launch=1
[[ ${1:-} == --no-launch ]] && launch=0
[[ -n ${1:-} && $launch == 1 ]] && sed -n '3,4s/^# //p' "$0" >&2 && exit 2

data=/data/data/com.discord
dir=$data/files/Unbound
file=$dir/settings.json

if ! with_timeout 10 "$ADB" -s "$AVD_SERIAL" get-state >/dev/null 2>&1; then
	echo "FAIL $AVD_SERIAL is not attached: scripts/up.sh emu" >&2
	exit 1
fi

if ! adb_avd shell pm path com.discord 2>/dev/null | grep -q '^package:'; then
	echo "FAIL Discord is not installed on $AVD_SERIAL. boot.md: Rebuilding from nothing" >&2
	exit 1
fi

# An empty read must mean "no file", never "no root", or the write below would replace real settings.
if ! root_shell id 2>/dev/null | grep -q 'uid=0'; then
	echo "FAIL no root shell on $AVD_SERIAL; settings.json is root-only. scripts/up.sh emu runs adb root" >&2
	exit 1
fi

current='{}'

if root_shell "test -f $file" >/dev/null 2>&1; then
	current=$(root_shell "cat $file" | tr -d '\r')
fi

# Sets only the keys the dev loop needs and keeps the rest; prints nothing when they already match, exits 3 on bad JSON.
transform='
	let settings;
	try { settings = JSON.parse(await Bun.stdin.text()); } catch { process.exit(3); }
	const before = JSON.stringify(settings);
	const unbound = (settings.unbound ??= {});
	unbound.loader ??= {};
	unbound.loader.update = { ...unbound.loader.update, url: process.env.DEV_URL, hmr: true };
	unbound.debugger = { ...unbound.debugger, address: process.env.BRIDGE, enabled: true };
	const after = JSON.stringify(settings);
	if (after !== before) process.stdout.write(after);
'
export DEV_URL=http://10.0.2.2:$AVD_DEV_PORT/ BRIDGE=10.0.2.2:$AVD_BRIDGE_PORT
status=0
updated=$(bun -e "$transform" <<<"$current") || status=$?

if ((status == 3)); then
	echo "WARN $file is not JSON; moving it to settings.json.broken and starting a fresh one" >&2
	root_shell "mv $file $file.broken"
	updated=$(bun -e "$transform" <<<'{}')
elif ((status)); then
	echo "FAIL could not rewrite $file (bun exited $status)" >&2
	exit 1
fi

if [[ -z $updated ]]; then
	echo "Unbound on $AVD_SERIAL already loads $DEV_URL and reports to $BRIDGE"
	exit 0
fi

# Discord rewrites settings.json from memory, so it must be stopped before the write. A file su creates is root's,
# so ownership and the SELinux label are copied from Discord's data folder afterwards.
adb_avd shell am force-stop com.discord
owner=$(root_shell "stat -c %u:%g $data" | tr -d '\r')
root_shell "mkdir -p $dir"
printf '%s' "$updated" | root_shell "cat > $file"
root_shell "chown $owner $dir $file && restorecon $dir $file" >/dev/null 2>&1 || true
echo "pointed Unbound on $AVD_SERIAL at $DEV_URL and $BRIDGE"

if ((launch)); then
	adb_avd shell monkey -p com.discord -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
	echo 'relaunched Discord'
fi
