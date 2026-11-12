#!/usr/bin/env bash
set -uo pipefail

read -r -a packages <<< "$PACKAGES"
apt_options=(-o Acquire::Retries=5 -o Acquire::http::Timeout=30 -qq)

install() {
    sudo apt-get install -y "${apt_options[@]}" "${packages[@]}" > /dev/null
}

refresh() {
    sudo apt-get update "${apt_options[@]}"
}

use_archive_mirror() {
    echo "::warning::An Ubuntu mirror did not resolve; switching to azure.archive.ubuntu.com."
    sudo find /etc/apt -name '*.list' -o -name '*.sources' | while read -r file; do
        sudo sed -i -E 's#https?://(security|archive)\.ubuntu\.com#http://azure.archive.ubuntu.com#g' "$file"
    done
}

install && exit 0

for attempt in 1 2 3; do
    if refresh && install; then
        exit 0
    fi
    install && exit 0
    if [ "$attempt" = 1 ]; then
        use_archive_mirror
    fi
    sleep $((attempt * 10))
done

echo "::error::Could not install ${PACKAGES} after three attempts."
exit 1
