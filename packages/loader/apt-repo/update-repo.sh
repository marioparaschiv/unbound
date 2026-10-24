#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR/repo"
CONFIG_DIR="$REPO_DIR/assets/repo"
CONFIG_FILE="$CONFIG_DIR/repo.conf"

echo "Creating directories..."
mkdir -p "$REPO_DIR/debs"

APT_FTPARCHIVE="apt-ftparchive"

key_id=""
if [[ -n "${GPG_KEY_ID:-}" ]]; then
    key_id="$GPG_KEY_ID"
fi

echo "Current directory: $(pwd)"
echo "Changing to repo directory: $REPO_DIR"
cd "$REPO_DIR" || exit 1

if [[ "$OSTYPE" == "linux"* ]]; then
    echo "Installing dependencies..."
    sudo apt-get update
    sudo apt-get install -y apt-utils xz-utils zstd bzip2 lz4 gzip apt-utils
fi

echo "Cleaning old files..."
rm -f Packages Packages.{xz,gz,bz2,zst} Release{,.gpg} InRelease

echo "Generating Packages file..."
$APT_FTPARCHIVE packages ./debs > Packages

echo "Compressing files..."
gzip -c9 Packages > Packages.gz
xz -c9 Packages > Packages.xz
zstd -c19 Packages > Packages.zst
bzip2 -c9 Packages > Packages.bz2

echo "Generating Contents file..."
$APT_FTPARCHIVE contents ./debs > Contents-iphoneos-arm

echo "Compressing Contents file..."
bzip2 -c9 Contents-iphoneos-arm > Contents-iphoneos-arm.bz2
xz -c9 Contents-iphoneos-arm > Contents-iphoneos-arm.xz
xz -5fkev --format=lzma Contents-iphoneos-arm > Contents-iphoneos-arm.lzma
lz4 -c9 Contents-iphoneos-arm > Contents-iphoneos-arm.lz4
gzip -c9 Contents-iphoneos-arm > Contents-iphoneos-arm.gz
zstd -c19 Contents-iphoneos-arm > Contents-iphoneos-arm.zst

echo "Generating Release file..."
$APT_FTPARCHIVE release -c "$CONFIG_FILE" . > Release

if [[ -n "$key_id" ]]; then
    echo "Signing Release file..."
    gpg -abs -u "$key_id" -o Release.gpg Release
    gpg -abs -u "$key_id" --clearsign -o InRelease Release
fi

echo "Repository Updated!"
