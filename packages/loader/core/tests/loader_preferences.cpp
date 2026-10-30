#include <cassert>
#include <filesystem>
#include <string>
#include <unistd.h>

#include "LoaderFiles.h"
#include "LoaderPreferences.h"

using namespace loader::preferences;

int main()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-preferences-XXXXXX").string();
    assert(mkdtemp(templatePath.data()));
    const auto path = (std::filesystem::path(templatePath) / kSettingsFile).string();
    assert(loader::writeTextFileAtomically(
        path,
        R"({"astral":{"recovery":true,"font-states":{"*":"Ginto"}},"themes":{"applied":"adrian.theme"}})"));

    loader::SettingsStore settings(path);
    settings.load();
    assert(loaderEnabled(settings));
    assert(recoveryEnabled(settings));
    assert(perform(settings, "recovery-label", "") == "Disable Recovery Mode");
    assert(perform(settings, "recovery-status", "") == "Recovery Mode enabled");
    assert(!developerMode(settings));
    assert(!devOverlayVisible(settings, false, false));
    assert(perform(settings, "dev-overlay", "virtual-device") == "true");
    assert(perform(settings, "dev-overlay", "debug-build") == "true");
    assert(perform(settings, "dev-overlay", "") == "false");
    assert(!hotReloadEnabled(settings));
    assert(appliedThemeId(settings) == std::optional<std::string>("adrian.theme"));
    assert(!activeThemeId(settings));
    assert(fontOverrides(settings)["*"] == "Ginto");
    assert(perform(settings, "font-override", "Whitney") == "Ginto");

    assert(gestureEnabled(settings, ToolboxGesture::Shake));
    assert(setGestureEnabled(settings, ToolboxGesture::Shake, false));
    assert(!gestureEnabled(settings, ToolboxGesture::Shake));
    setGestureEnabled(settings, ToolboxGesture::ThreeFinger, false);
    assert(!gestureEnabled(settings, ToolboxGesture::ThreeFinger));
    assert(gestureEnabled(settings, ToolboxGesture::Shake));
    assert(perform(settings, "set-gesture", "three-finger=true") == "true");
    assert(perform(settings, "gesture", "nope").empty());

    assert(perform(settings, "message-bubbles", "").empty());
    assert(perform(settings, "avatar-radius", "").empty());

    loader::SettingsStore reread(path);
    reread.load();
    assert(gestureEnabled(reread, ToolboxGesture::ThreeFinger));

    std::filesystem::remove_all(templatePath);
    return 0;
}
