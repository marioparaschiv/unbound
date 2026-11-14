#!/usr/bin/env sh
set -eu
core="$(cd "$(dirname "$0")/.." && pwd)"
vendor="$core/../vendor"
out="${1:?usage: build-bundle-patch-check.sh <output binary>}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
for source in "$vendor"/brotli/c/common/*.c "$vendor"/brotli/c/dec/*.c; do
    cc -O2 -w -I"$vendor/brotli/c/include" -c "$source" -o "$work/$(basename "$source").o"
done
c++ -std=c++20 -O2 -I"$core/include" -I"$vendor/brotli/c/include" \
    "$core/src/LoaderBundlePatch.cpp" "$core/tools/bundle_patch_check.cpp" "$work"/*.o -o "$out"
