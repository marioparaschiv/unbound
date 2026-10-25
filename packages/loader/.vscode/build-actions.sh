#!/bin/sh
set -euo pipefail

ACTION="${1:-Package}"
echo ">> action: ${ACTION}"

build_package() {
  rm -rf packages
  gmake clean package DEBUG=1
}

case "$ACTION" in
  "Install on vphone")
    if ! command -v sshpass >/dev/null 2>&1; then
      echo "sshpass is required for vphone action but was not found" >&2
      exit 1
    fi

    # Password-only auth: otherwise ssh-agent keys are tried first and can exhaust
    # the openssh server's MaxAuthTries ("Too many authentication failures").
    SSH_OPTS="-p 2222 -o ConnectTimeout=5 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o PubkeyAuthentication=no -o PreferredAuthentications=password"
    SSH_TARGET="mobile@127.0.0.1"

    if ! sshpass -p alpine ssh $SSH_OPTS "$SSH_TARGET" "exit" >/dev/null 2>&1; then
      echo "Virtual iPhone could not be reached" >&2
      exit 1
    fi

    build_package

    DEB=$(ls packages/*.deb 2>/dev/null | head -n1 || true)
    if [[ -z "$DEB" ]]; then
      echo "No .deb artifacts found" >&2
      exit 1
    fi

    REMOTE_DEB="/tmp/$(basename "$DEB")"

    # The vphone runs openssh-server (rootless JB, sftp-server under /var/jb), so
    # default SFTP-mode scp works. Do NOT add -O: legacy mode needs a remote scp binary
    # the device doesn't have ("bash: scp: command not found").
    sshpass -p alpine scp -P 2222 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o PubkeyAuthentication=no -o PreferredAuthentications=password "$DEB" "$SSH_TARGET:$REMOTE_DEB"
    # -tt forces a pty so the channel closes when the command exits: the Sileo dpkg
    # trigger can spawn children (uicache) that inherit the session's fds, and
    # openssh otherwise waits on them -> the task hangs after "Processing triggers".
    sshpass -p alpine ssh -tt $SSH_OPTS "$SSH_TARGET" "echo 'alpine' | sudo -S dpkg -i '$REMOTE_DEB' && echo 'alpine' | sudo -S killall -9 Discord; uiopen --bundleid com.hammerandchisel.discord </dev/null >/dev/null 2>&1"
    ;;
  Package)
    build_package
    ;;
  "AirDrop Tweak")
    build_package
    shortcuts run AirDrop -i ./packages/*.deb
    ;;
  "Build IPA")
    build_package
    chmod +x build-local.sh
    ./build-local.sh
    ;;
  *)
    echo "Unknown action: $ACTION" >&2
    exit 1
    ;;
esac
