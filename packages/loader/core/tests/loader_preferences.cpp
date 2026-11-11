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
        R"({"unbound":{"recovery":true,"font-states":{"*":"Ginto"}},"themes":{"applied":"adrian.theme"}})"));

    loader::SettingsStore settings(path);
    settings.load();
    assert(loaderEnabled(settings));
    assert(recoveryEnabled(settings));
    assert(recoveryActionLabel(recoveryEnabled(settings)) == "Disable Recovery Mode");
    assert(recoveryStatusText(recoveryEnabled(settings)) == "Recovery Mode enabled");
    assert(!developerMode(settings));
    assert(!devOverlayVisible(settings, false, false));
    assert(devOverlayVisible(settings, true, false));
    assert(devOverlayVisible(settings, false, true));
    assert(!hotReloadEnabled(settings));
    assert(appliedThemeId(settings) == std::optional<std::string>("adrian.theme"));
    assert(!activeThemeId(settings));
    assert(fontOverrides(settings)["*"] == "Ginto");

    assert(gestureEnabled(settings, ToolboxGesture::Shake));
    assert(setGestureEnabled(settings, ToolboxGesture::Shake, false));
    assert(!gestureEnabled(settings, ToolboxGesture::Shake));
    setGestureEnabled(settings, ToolboxGesture::ThreeFinger, false);
    assert(!gestureEnabled(settings, ToolboxGesture::ThreeFinger));
    assert(gestureEnabled(settings, ToolboxGesture::Shake));
    assert(setGestureEnabled(settings, ToolboxGesture::ThreeFinger, true));
    assert(gestureNamed("three-finger") == ToolboxGesture::ThreeFinger);
    assert(!gestureNamed("nope"));

    loader::SettingsStore reread(path);
    reread.load();
    assert(gestureEnabled(reread, ToolboxGesture::ThreeFinger));

    std::filesystem::remove_all(templatePath);
    return 0;
}
