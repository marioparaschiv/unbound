# Sourced by the other scripts. Per-machine overrides go in the repo's gitignored .env or the environment.
# Runs on Linux and macOS with bash 3.2 or newer.
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
root=$(git -C "$here" rev-parse --show-toplevel 2>/dev/null || git rev-parse --show-toplevel) || exit 1

# A fresh worktree has no .env; fall back to the main checkout's, which every worktree shares.
env_file=$root/.env
[[ -f $env_file ]] || env_file=$(dirname "$(git -C "$root" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)")/.env

# Variables already in the environment win over .env.
if [[ -f $env_file ]]; then
	while IFS='=' read -r key value || [[ -n $key ]]; do
		if [[ $key =~ ^AVD_[A-Z_]+$|^ANDROID_HOME$ && -z ${!key+x} ]]; then
			value=${value%\"}
			value=${value#\"}
			export "$key=$value"
		fi
	done <"$env_file"
fi

# The SDK whose emulator runs the AVD: ANDROID_HOME, ANDROID_SDK_ROOT, or the usual install folders.
: "${ANDROID_HOME:=${ANDROID_SDK_ROOT:-}}"

if [[ -z $ANDROID_HOME ]]; then
	for candidate in "$HOME/Library/Android/sdk" "$HOME/Android/Sdk" "$HOME/android-sdk"; do
		[[ -x $candidate/emulator/emulator ]] && ANDROID_HOME=$candidate && break
	done
fi

if [[ -z $ANDROID_HOME || ! -x $ANDROID_HOME/emulator/emulator || ! -x $ANDROID_HOME/platform-tools/adb ]]; then
	echo "FAIL no Android SDK with emulator and platform-tools found; set ANDROID_HOME in the repo's .env (boot.md: Setting up)" >&2
	exit 1
fi

ADB=$ANDROID_HOME/platform-tools/adb
EMULATOR=$ANDROID_HOME/emulator/emulator

# Runs a command with a time limit; macOS has no timeout(1) unless coreutils is installed.
with_timeout() {
	local seconds=$1
	shift

	if command -v timeout >/dev/null; then
		timeout "$seconds" "$@"
	elif command -v gtimeout >/dev/null; then
		gtimeout "$seconds" "$@"
	else
		perl -e 'alarm shift; exec @ARGV' "$seconds" "$@"
	fi
}

# The AVD to drive: AVD_NAME, else the loader's tracked profile names, else the only AVD there is.
if [[ -z ${AVD_NAME:-} ]]; then
	avds=$("$EMULATOR" -list-avds 2>/dev/null | grep -v '^INFO')

	for candidate in unbound_root unbound_root_x86; do
		grep -qx "$candidate" <<<"$avds" && AVD_NAME=$candidate && break
	done

	if [[ -z ${AVD_NAME:-} ]]; then
		case $(grep -c . <<<"$avds") in
		1) AVD_NAME=$avds ;;
		0)
			echo "FAIL no AVD exists yet (emulator -list-avds is empty); boot.md: Setting up" >&2
			exit 1
			;;
		*)
			echo "FAIL several AVDs exist; put AVD_NAME=<one of them> in the repo's .env:" >&2
			sed 's/^/  /' <<<"$avds" >&2
			exit 1
			;;
		esac
	fi
fi

# Where running emulators advertise their ports and gRPC token.
if [[ $(uname -s) == Darwin ]]; then
	: "${AVD_DISCOVERY_DIR:=$HOME/Library/Caches/TemporaryItems/avd/running}"
else
	: "${AVD_DISCOVERY_DIR:=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/avd/running}"
fi

# The discovery file of the running emulator for this AVD, if any; files of emulators that died are removed.
emulator_ini() {
	local file pid

	for file in "$AVD_DISCOVERY_DIR"/pid_*.ini; do
		[[ -f $file ]] && grep -qx "avd.name=$AVD_NAME" "$file" || continue
		pid=$(basename "$file" .ini)
		pid=${pid#pid_}

		if kill -0 "$pid" 2>/dev/null; then
			echo "$file"
			return
		fi

		rm -f "$file"
	done
}

# One key of a discovery file.
ini_value() {
	grep "^$2=" "$1" 2>/dev/null | head -n 1 | cut -d= -f2-
}

# The console port names the adb serial (emulator-<port>). An emulator already running, perhaps started by
# Android Studio on other ports, wins over the defaults so every script reaches the same one.
: "${AVD_CONSOLE_PORT:=5554}"
: "${AVD_GRPC_PORT:=8554}"
running_ini=$(emulator_ini)

if [[ -n $running_ini ]]; then
	AVD_CONSOLE_PORT=$(ini_value "$running_ini" port.serial)
	AVD_GRPC_PORT=$(ini_value "$running_ini" grpc.port)
fi

# Separate from the vphone's dev server and bridge, so both devices can run at once. 10.0.2.2 is the host's loopback.
: "${AVD_DEV_PORT:=3320}"
: "${AVD_BRIDGE_PORT:=9320}"
: "${AVD_PREVIEW_PORT:=8560}"
: "${AVD_LOG_DIR:=${TMPDIR:-/tmp}}"
AVD_LOG_DIR=${AVD_LOG_DIR%/}
# Apple Silicon renders with the host GPU; a Linux host may have none, so it renders in software unless told otherwise.
if [[ $(uname -s) == Darwin ]]; then
	: "${AVD_GPU:=host}"
else
	: "${AVD_GPU:=swiftshader_indirect}"
fi

AVD_SERIAL=emulator-$AVD_CONSOLE_PORT
AVD_ALLOWLIST=$here/emulator-access.json
export ANDROID_HOME AVD_NAME AVD_CONSOLE_PORT AVD_GRPC_PORT AVD_DEV_PORT AVD_BRIDGE_PORT AVD_PREVIEW_PORT AVD_LOG_DIR AVD_GPU
export AVD_SERIAL AVD_ALLOWLIST AVD_DISCOVERY_DIR ADB EMULATOR

adb_avd() {
	"$ADB" -s "$AVD_SERIAL" "$@"
}

# Runs a shell command as root: directly when adbd already runs as root (up.sh sets that), else through Magisk's su,
# which denies the shell user after a cold boot unless someone granted it in the Magisk app.
root_shell() {
	# </dev/null keeps the probe from swallowing stdin meant for the command, as in cat > file.
	if [[ $(with_timeout 10 "$ADB" -s "$AVD_SERIAL" shell id -u </dev/null 2>/dev/null | tr -d '\r') == 0 ]]; then
		with_timeout 30 "$ADB" -s "$AVD_SERIAL" shell "$1"
	else
		with_timeout 30 "$ADB" -s "$AVD_SERIAL" shell "su -c '$1'"
	fi
}

# Whether something listens on a local TCP port.
port_busy() {
	(exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

# The pid listening on a local TCP port, when this user may see it.
port_pid() {
	if command -v ss >/dev/null; then
		ss -Hltnp "sport = :$1" 2>/dev/null | grep -o 'pid=[0-9]*' | head -n 1 | cut -d= -f2
	elif command -v lsof >/dev/null; then
		lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -n 1
	fi
}
