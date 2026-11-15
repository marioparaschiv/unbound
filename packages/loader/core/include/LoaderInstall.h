#pragma once

namespace loader {
// What the user installs to get a newer loader. An Xposed module and an LSPatch-patched Discord are
// both an APK; a jailbroken store install runs the loader as a tweak; any other iOS install is an
// IPA.
enum class LoaderInstall
{
    Unknown,
    Apk,
    Ipa,
    Tweak,
};
}
