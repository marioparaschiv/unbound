# Sourced by the other scripts. Per-machine overrides go in the repo's gitignored .env or the environment.
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

# The SDK whose emulator runs the AVD; ~/android-sdk on the VPS, Android Studio's default elsewhere.
if [[ -z ${ANDROID_HOME:-} ]]; then
	for candidate in "$HOME/android-sdk" "$HOME/Android/Sdk" "$HOME/Library/Android/sdk"; do
		[[ -x $candidate/emulator/emulator ]] && ANDROID_HOME=$candidate && break
	done
fi

: "${ANDROID_HOME:?no Android SDK found; set ANDROID_HOME}"
: "${AVD_NAME:=unbound_root_x86}"
# The console port names the adb serial (emulator-<port>); adb itself takes the next port.
: "${AVD_CONSOLE_PORT:=5554}"
: "${AVD_GRPC_PORT:=8554}"
# Separate from the vphone's dev server and bridge, so both devices can run at once. 10.0.2.2 is the host's loopback.
: "${AVD_DEV_PORT:=3320}"
: "${AVD_BRIDGE_PORT:=9320}"
: "${AVD_PREVIEW_PORT:=8560}"
: "${AVD_LOG_DIR:=${TMPDIR:-/tmp}}"
# swiftshader renders without a host GPU; set host on a desktop with one.
: "${AVD_GPU:=swiftshader_indirect}"

AVD_SERIAL=emulator-$AVD_CONSOLE_PORT
AVD_ALLOWLIST=$here/emulator-access.json
ADB=$ANDROID_HOME/platform-tools/adb
EMULATOR=$ANDROID_HOME/emulator/emulator
export ANDROID_HOME AVD_NAME AVD_CONSOLE_PORT AVD_GRPC_PORT AVD_DEV_PORT AVD_BRIDGE_PORT AVD_PREVIEW_PORT AVD_LOG_DIR AVD_GPU
export AVD_SERIAL AVD_ALLOWLIST ADB EMULATOR

adb_avd() {
	"$ADB" -s "$AVD_SERIAL" "$@"
}

# Runs a shell command as root: directly when adbd already runs as root (up.sh sets that), else through Magisk's su,
# which denies the shell user after a cold boot unless someone granted it in the Magisk app.
root_shell() {
	if [[ $(timeout 10 "$ADB" -s "$AVD_SERIAL" shell id -u </dev/null 2>/dev/null | tr -d '\r') == 0 ]]; then
		# </dev/null above keeps the probe from swallowing stdin meant for the command, as in cat > file.
		timeout 30 "$ADB" -s "$AVD_SERIAL" shell "$1"
	else
		timeout 30 "$ADB" -s "$AVD_SERIAL" shell "su -c '$1'"
	fi
}
