#include <cassert>
#include <filesystem>
#include <string>
#include <unistd.h>

#include "LoaderCrashGuard.h"
#include "LoaderFiles.h"

static std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-crash-guard-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

static void crashWhileStarting(const loader::AddonCrashGuard &guard, const std::string &id)
{
    assert(guard.beginStart(id, "Plugin " + id));
}

static bool markerExists(const std::filesystem::path &root)
{
    return loader::fileExists((root / loader::AddonCrashGuard::kStartingFile).string());
}

static void cleanLaunchClearsNothing(const std::filesystem::path &root)
{
    loader::AddonCrashGuard guard(root.string());
    assert(guard.recoverFromPreviousLaunch().empty());
    assert(guard.beginStart("plugins:a", "A"));
    assert(markerExists(root));
    assert(!guard.finishStart("plugins:b"));
    assert(markerExists(root));
    assert(guard.finishStart("plugins:a"));
    assert(!markerExists(root));
    assert(guard.recoverFromPreviousLaunch().empty());
}

static void secondConsecutiveCrashDisables(const std::filesystem::path &root)
{
    loader::AddonCrashGuard guard(root.string());
    crashWhileStarting(guard, "plugins:crashy");
    assert(guard.recoverFromPreviousLaunch().empty());
    assert(!markerExists(root));

    crashWhileStarting(guard, "plugins:crashy");
    std::vector<loader::CrashedAddon> disabled = guard.recoverFromPreviousLaunch();
    assert(disabled.size() == 1);
    assert(disabled[0].id == "plugins:crashy");
    assert(disabled[0].name == "Plugin plugins:crashy");

    assert(guard.recoverFromPreviousLaunch().empty());
    crashWhileStarting(guard, "plugins:crashy");
    assert(guard.recoverFromPreviousLaunch().empty());
}

static void cleanLaunchBetweenCrashesResets(const std::filesystem::path &root)
{
    loader::AddonCrashGuard guard(root.string());
    crashWhileStarting(guard, "plugins:flaky");
    assert(guard.recoverFromPreviousLaunch().empty());
    assert(guard.recoverFromPreviousLaunch().empty());
    crashWhileStarting(guard, "plugins:flaky");
    assert(guard.recoverFromPreviousLaunch().empty());
}

static void differentAddonResetsCount(const std::filesystem::path &root)
{
    loader::AddonCrashGuard guard(root.string());
    crashWhileStarting(guard, "plugins:one");
    assert(guard.recoverFromPreviousLaunch().empty());
    crashWhileStarting(guard, "plugins:two");
    assert(guard.recoverFromPreviousLaunch().empty());
    crashWhileStarting(guard, "plugins:two");
    std::vector<loader::CrashedAddon> disabled = guard.recoverFromPreviousLaunch();
    assert(disabled.size() == 1 && disabled[0].id == "plugins:two");
}

static void unreadableMarkerIsIgnored(const std::filesystem::path &root)
{
    loader::AddonCrashGuard guard(root.string());
    crashWhileStarting(guard, "plugins:x");
    assert(guard.recoverFromPreviousLaunch().empty());
    assert(loader::writeTextFileAtomically((root / loader::AddonCrashGuard::kStartingFile).string(),
                                           "not json"));
    assert(guard.recoverFromPreviousLaunch().empty());
    assert(!markerExists(root));
    crashWhileStarting(guard, "plugins:x");
    assert(guard.recoverFromPreviousLaunch().empty());
}

static void verdictIsComputedOncePerProcess(const std::filesystem::path &root)
{
    loader::AddonCrashGuard guard(root.string());
    crashWhileStarting(guard, "themes:t");
    assert(guard.recoverFromPreviousLaunch().empty());
    crashWhileStarting(guard, "themes:t");

    std::vector<loader::CrashedAddon> first = loader::crashDisabledAddons(root.string());
    assert(first.size() == 1 && first[0].id == "themes:t");

    crashWhileStarting(guard, "themes:t");
    std::vector<loader::CrashedAddon> second = loader::crashDisabledAddons(root.string());
    assert(second.size() == 1 && second[0].id == "themes:t");
    assert(markerExists(root));

    std::vector<loader::CrashedAddon> announced =
        loader::takeUnannouncedCrashDisabledAddons(root.string());
    assert(announced.size() == 1);
    assert(loader::crashDisabledNotice(announced[0]) ==
           "Disabled Plugin themes:t because Discord crashed while starting it.");
    assert(loader::takeUnannouncedCrashDisabledAddons(root.string()).empty());

    nlohmann::json json = loader::crashedAddonsJSON(second);
    assert(json.is_array() && json.size() == 1);
    assert(json[0]["id"] == "themes:t");
    assert(json[0]["name"] == "Plugin themes:t");
}

int main()
{
    const auto root = makeTemporaryDirectory();
    const auto run  = [&](const char *name, void (*test)(const std::filesystem::path &)) {
        std::filesystem::path directory = root / name;
        std::filesystem::create_directories(directory);
        test(directory);
    };

    run("clean", cleanLaunchClearsNothing);
    run("consecutive", secondConsecutiveCrashDisables);
    run("reset", cleanLaunchBetweenCrashesResets);
    run("different", differentAddonResetsCount);
    run("unreadable", unreadableMarkerIsIgnored);
    run("once", verdictIsComputedOncePerProcess);

    std::filesystem::remove_all(root);
    return 0;
}
