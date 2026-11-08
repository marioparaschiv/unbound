#!/usr/bin/env bash
# Starts the AVD dev loop in tmux sessions, leaving healthy running ones alone: emulator, bridge, dev server, preview.
# Usage: up.sh [--restart[=emu|bridge|dev|preview]] [emu|bridge|dev|preview ...]
#   --restart        stop the named sessions first (all of them without a name)
#   --restart=<name> stop only that session; --restart=dev serves this checkout instead of another one
#   <name> ...       start only these; default all four
# Repairs on its own: sessions whose checkout was deleted, ports held by such sessions, a stale emulator discovery
# file, missing node_modules, and a screen that sleeps or locks. Exit 1 names what it could not repair.
set -euo pipefail
. "$(dirname "$0")/env.sh"

restart=
only=()

for arg; do
	case $arg in
	--restart) restart=all ;;
	--restart=emu | --restart=bridge | --restart=dev | --restart=preview) restart=${arg#--restart=} ;;
	emu | bridge | dev | preview) only+=("$arg") ;;
	*) sed -n '3,6s/^# //p' "$0" >&2 && exit 2 ;;
	esac
done

((${#only[@]})) || only=(emu bridge dev preview)
command -v tmux >/dev/null || { echo 'FAIL up.sh needs tmux' >&2; exit 1; }
[[ -x $EMULATOR && -x $ADB ]] || { echo "FAIL no emulator or adb under ANDROID_HOME=$ANDROID_HOME" >&2; exit 1; }

wanted() {
	[[ " ${only[*]} " == *" $1 "* ]]
}

restarting() {
	[[ $restart == all || $restart == "$1" ]]
}

# The checkout a tmux session runs in, or nothing when there is no such session.
session_path() {
	tmux display -p -t "=$1:" '#{pane_current_path}' 2>/dev/null || true
}

# A session whose checkout was deleted runs files that no longer exist; it is dead work, so it goes.
reap_if_orphaned() {
	local path

	path=$(session_path "$1")
	[[ -z $path ]] && return 0
	# A removed worktree shows as "<path> (deleted)"; a trashed one follows the move into the trash.
	[[ $path == *' (deleted)' || $path == */.local/share/Trash/* || $path == */.Trash/* || ! -d $path ]] || return 0
	echo "stopping $1: its checkout ${path% (deleted)} is gone"
	tmux kill-session -t "=$1" 2>/dev/null || true
}

# The pid of the emulator running this AVD, from its discovery file (env.sh: emulator_ini).
emulator_pid() {
	local file

	file=$(emulator_ini)
	[[ -n $file ]] || return 0
	file=$(basename "$file" .ini)
	echo "${file#pid_}"
}

# Waits up to 5 s for a port to free. A port held inside a tmux session from a deleted checkout is reclaimed;
# any other holder is named and the script stops.
port_free() {
	local port=$1 name=$2 variable=$3 pid session= tries=5

	while port_busy "$port" && ((tries--)); do
		sleep 1
	done

	port_busy "$port" || return 0
	pid=$(port_pid "$port")
	local holder="pid ${pid:-unknown}${pid:+ ($(ps -o comm= -p "$pid" 2>/dev/null))}"

	# Climb from the holder to the tmux pane that started it.
	while [[ -n $pid && $pid != 1 ]]; do
		session=$(tmux list-panes -a -F '#{pane_pid} #{session_name}' 2>/dev/null | awk -v p="$pid" '$1 == p { print $2 }')
		[[ -n $session ]] && break
		pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
	done

	if [[ -n $session ]]; then
		reap_if_orphaned "$session"

		if ! tmux has-session -t "=$session" 2>/dev/null; then
			port_free "$port" "$name" "$variable"
			return
		fi

		echo "FAIL port $port is taken by tmux session $session ($(session_path "$session")), so avd-$name cannot start." >&2
	else
		echo "FAIL port $port is taken, so avd-$name cannot start: $holder" >&2
	fi

	echo "     Stop it, or set AVD_${variable}_PORT to a free port." >&2
	exit 1
}

# Clears the way for a session: stops it when restarting or orphaned, then checks its port when it must start.
prepare() {
	local name=avd-$1

	if restarting "$1"; then
		tmux kill-session -t "=$name" 2>/dev/null || true
	fi

	reap_if_orphaned "$name"
	tmux has-session -t "=$name" 2>/dev/null || port_free "$2" "$1" "$3"
}

start() {
	local name=avd-$1 cmd=$2 log=$AVD_LOG_DIR/avd-$1.log

	if tmux has-session -t "=$name" 2>/dev/null; then
		echo "running $name"
		return 1
	fi

	tmux new-session -d -s "$name" -c "$root" "$cmd 2>&1 | tee '$log'"
	echo "started $name, log $log"
}

# Keeps the screen on and unlocked, so taps, screenshots and the preview never meet a black or locked screen.
keep_awake() {
	adb_avd shell svc power stayon true >/dev/null 2>&1 || true
	adb_avd shell settings put system screen_off_timeout 2147483647 >/dev/null 2>&1 || true
	adb_avd shell locksettings set-disable true >/dev/null 2>&1 || true
	adb_avd shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1 || true
	adb_avd shell wm dismiss-keyguard >/dev/null 2>&1 || true
}

if wanted emu; then
	pid=$(emulator_pid)

	if [[ -n $pid ]] && restarting emu; then
		echo "stopping $AVD_NAME (pid $pid)"
		with_timeout 10 "$ADB" -s "$AVD_SERIAL" emu kill >/dev/null 2>&1 || kill "$pid"

		for _ in {1..30}; do
			kill -0 "$pid" 2>/dev/null || break
			sleep 1
		done

		kill -0 "$pid" 2>/dev/null && kill -9 "$pid"
		tmux kill-session -t '=avd-emu' 2>/dev/null || true
		pid=
	fi

	if [[ -n $pid ]]; then
		# Any copy of emulator-access.json grants the preview's Rtc calls; the SDK default does not.
		grep -q '^grpc.allowlist=.*/emulator-access.json$' "$AVD_DISCOVERY_DIR/pid_$pid.ini" ||
			echo "WARN $AVD_NAME runs without the preview's gRPC access; the preview needs up.sh --restart=emu" >&2
		echo "running $AVD_NAME as $AVD_SERIAL"
	else
		tmux kill-session -t '=avd-emu' 2>/dev/null || true

		if [[ $(uname -s) == Linux && ! -w /dev/kvm ]]; then
			echo "FAIL /dev/kvm is not writable, so the emulator would crawl or refuse to start: sudo usermod -aG kvm $USER, then log in again" >&2
			exit 1
		fi

		port_free "$AVD_CONSOLE_PORT" emu CONSOLE
		port_free "$AVD_GRPC_PORT" emu GRPC
		# -no-snapshot cold boots from the disk: loading the old default_boot snapshot would roll the disk back to it,
		# losing the Discord login and everything installed since. AVD_WINDOW=1 shows the emulator's own window.
		window=-no-window
		[[ ${AVD_WINDOW:-0} == 1 ]] && window=
		start emu "'$EMULATOR' -avd '$AVD_NAME' -port $AVD_CONSOLE_PORT -grpc $AVD_GRPC_PORT -grpc-use-token -grpc-allowlist '$AVD_ALLOWLIST' $window -no-audio -no-boot-anim -gpu $AVD_GPU -no-snapshot" || true
	fi

	"$ADB" start-server >/dev/null 2>&1
	began=$SECONDS

	until [[ $(with_timeout 10 "$ADB" -s "$AVD_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r') == 1 ]]; do
		if [[ -z $(emulator_pid) ]] && ((SECONDS - began > 10)); then
			echo "FAIL the emulator exited while booting; tail of $AVD_LOG_DIR/avd-emu.log:" >&2
			tail -n 15 "$AVD_LOG_DIR/avd-emu.log" >&2 || true
			exit 1
		fi

		if ((SECONDS - began > 240)); then
			echo "FAIL $AVD_NAME did not finish booting in 240 s; tail of $AVD_LOG_DIR/avd-emu.log:" >&2
			tail -n 15 "$AVD_LOG_DIR/avd-emu.log" >&2 || true
			exit 1
		fi

		sleep 2
	done

	# Root adbd: Magisk's su denies the shell user after a cold boot, and ubd install, ubd device and point.sh
	# all use a root adb shell when they get one. adbd restarts, so wait for it to come back.
	if [[ $(with_timeout 10 "$ADB" -s "$AVD_SERIAL" shell id -u 2>/dev/null | tr -d '\r') != 0 ]]; then
		with_timeout 20 "$ADB" -s "$AVD_SERIAL" root >/dev/null 2>&1 || true
		with_timeout 30 "$ADB" -s "$AVD_SERIAL" wait-for-device || true
	fi

	if ! root_shell id 2>/dev/null | grep -q 'uid=0'; then
		echo "WARN $AVD_SERIAL has no root shell; ubd install and point.sh need it. boot.md: Rebuilding from nothing" >&2
	fi

	keep_awake

	echo "$AVD_SERIAL booted"
fi

if wanted bridge; then
	prepare bridge "$AVD_BRIDGE_PORT" BRIDGE
	start bridge "bun packages/debugger/src/index.ts --port $AVD_BRIDGE_PORT" || true
fi

if wanted dev; then
	if [[ ! -d $root/node_modules ]]; then
		echo "installing $root/node_modules"
		(cd "$root" && bun install --frozen-lockfile >/dev/null)
	fi

	prepare dev "$AVD_DEV_PORT" DEV

	# DEV_HOST=10.0.2.2 bakes the emulator's view of this machine into the bundle's dev server and debugger addresses.
	if start dev "env PORT=$AVD_DEV_PORT DEV_HOST=10.0.2.2 DEBUGGER_PORT=$AVD_BRIDGE_PORT bun run --filter @unbound-app/client dev"; then
		log=$AVD_LOG_DIR/avd-dev.log
		began=$SECONDS

		until grep -aq 'Press Ctrl+C to stop' "$log" 2>/dev/null; do
			if grep -aq 'Build failed' "$log" 2>/dev/null || ((SECONDS - began > 180)) || ! tmux has-session -t '=avd-dev' 2>/dev/null; then
				echo "FAIL the dev server is not up; tail of $log:" >&2
				tail -n 15 "$log" >&2
				exit 1
			fi

			sleep 1
		done
	fi

	serving=$(session_path avd-dev)

	if [[ $serving != "$root" ]]; then
		echo "WARN avd-dev serves $serving, not this checkout; up.sh --restart=dev takes it over" >&2
	else
		echo "avd-dev serves this checkout on :$AVD_DEV_PORT"
	fi
fi

if wanted preview; then
	if [[ ! -d $here/preview/node_modules ]]; then
		(cd "$here/preview" && bun install --frozen-lockfile >/dev/null)
	fi

	prepare preview "$AVD_PREVIEW_PORT" PREVIEW

	# tmux sessions start with the tmux server's environment, so the settings go on the command line.
	start preview "env ANDROID_HOME='$ANDROID_HOME' AVD_SERIAL=$AVD_SERIAL AVD_GRPC_PORT=$AVD_GRPC_PORT AVD_DISCOVERY_DIR='$AVD_DISCOVERY_DIR' AVD_PREVIEW_PORT=$AVD_PREVIEW_PORT bun '$here/preview/server.ts'" || true

	for _ in {1..20}; do
		curl -fs -o /dev/null "http://127.0.0.1:$AVD_PREVIEW_PORT/" && break
		sleep 0.5
	done

	if ! curl -fs -o /dev/null "http://127.0.0.1:$AVD_PREVIEW_PORT/"; then
		echo "FAIL the preview is not up; tail of $AVD_LOG_DIR/avd-preview.log:" >&2
		tail -n 15 "$AVD_LOG_DIR/avd-preview.log" >&2
		exit 1
	fi

	echo "preview on http://127.0.0.1:$AVD_PREVIEW_PORT; open it in any browser on this machine (preview.md)"
fi
