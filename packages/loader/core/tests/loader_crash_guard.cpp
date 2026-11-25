#include <cassert>
#include <climits>
#include <fcntl.h>
#include <filesystem>
#include <fstream>
#include <iterator>
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

// iOS's %ctor starts the loader on another thread while the image's static initializers still
// run, so a start marker can be written before LoaderCrashGuard.cpp's own globals are initialized.
// This test's initializer runs before the library's, which reproduces that order.
static const std::filesystem::path earlyRoot = makeTemporaryDirectory();

struct EarlyStart {
    EarlyStart()
    {
        assert(loader::AddonCrashGuard(earlyRoot.string()).beginStart("plugins:early", "Early"));
    }
};

static EarlyStart earlyStart;

static void crashWhileStarting(const loader::AddonCrashGuard &guard, const std::string &id)
{
    assert(guard.beginStart(id, "Plugin " + id));
}

static void crashWhileRunning(const std::filesystem::path &root, const std::string &id)
{
    nlohmann::json record = {{"id", id}, {"name", "Plugin " + id}};
    assert(loader::writeTextFileAtomically((root / loader::AddonCrashGuard::kRunningFile).string(),
                                           record.dump()));
}

static void cleanRunningLaunch(const std::filesystem::path &root)
{
    assert(loader::writeTextFileAtomically((root / loader::AddonCrashGuard::kRunningFile).string(),
                                           ""));
}

static bool markerExists(const std::filesystem::path &root)
{
    std::string marker = (root / loader::AddonCrashGuard::kStartingFile).string();
    return loader::fileExists(marker) && loader::fileSize(marker) > 0;
}

static void earlyStartSurvivesStaticInit()
{
    // A marker written before the library's static initializers is still cleared by its start.
    loader::AddonCrashGuard guard(earlyRoot.string());
    assert(markerExists(earlyRoot));
    assert(guard.finishStart("plugins:early"));
    assert(!markerExists(earlyRoot));
    std::filesystem::remove_all(earlyRoot);
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
    assert(loader::crashDisabledNotice(announced[0])
           == "Disabled Plugin themes:t because Discord crashed while starting it.");
    assert(loader::takeUnannouncedCrashDisabledAddons(root.string()).empty());

    nlohmann::json json = loader::crashedAddonsJSON(second);
    assert(json.is_array() && json.size() == 1);
    assert(json[0]["id"] == "themes:t");
    assert(json[0]["name"] == "Plugin themes:t");
}

static void secondCrashWhileRunningDisables(const std::filesystem::path &root)
{
    loader::AddonCrashGuard guard(root.string());
    crashWhileRunning(root, "plugins:hooky");
    assert(guard.recoverFromPreviousLaunch().empty());
    assert(!std::filesystem::exists(root / loader::AddonCrashGuard::kRunningFile));

    crashWhileRunning(root, "plugins:hooky");
    std::vector<loader::CrashedAddon> disabled = guard.recoverFromPreviousLaunch();
    assert(disabled.size() == 1 && disabled[0].id == "plugins:hooky");
    assert(disabled[0].phase == loader::CrashPhase::Running);
    assert(loader::crashDisabledNotice(disabled[0])
           == "Disabled Plugin plugins:hooky because Discord crashed while running it.");

    nlohmann::json json = loader::crashedAddonsJSON(disabled);
    assert(json[0]["phase"] == "running");
}

static void emptyRunningMarkerIsACleanLaunch(const std::filesystem::path &root)
{
    loader::AddonCrashGuard guard(root.string());
    crashWhileRunning(root, "plugins:once");
    assert(guard.recoverFromPreviousLaunch().empty());
    cleanRunningLaunch(root);
    assert(guard.recoverFromPreviousLaunch().empty());
    crashWhileRunning(root, "plugins:once");
    assert(guard.recoverFromPreviousLaunch().empty());
}

static void startAndRunCrashesCountTogether(const std::filesystem::path &root)
{
    loader::AddonCrashGuard guard(root.string());
    crashWhileStarting(guard, "plugins:both");
    assert(guard.recoverFromPreviousLaunch().empty());

    crashWhileRunning(root, "plugins:both");
    std::vector<loader::CrashedAddon> disabled = guard.recoverFromPreviousLaunch();
    assert(disabled.size() == 1 && disabled[0].phase == loader::CrashPhase::Running);
}

static void startingMarkerTakesPrecedence(const std::filesystem::path &root)
{
    loader::AddonCrashGuard guard(root.string());
    crashWhileStarting(guard, "plugins:starting");
    crashWhileRunning(root, "plugins:other");
    assert(guard.recoverFromPreviousLaunch().empty());
    assert(!std::filesystem::exists(root / loader::AddonCrashGuard::kRunningFile));

    crashWhileStarting(guard, "plugins:starting");
    crashWhileRunning(root, "plugins:other");
    std::vector<loader::CrashedAddon> disabled = guard.recoverFromPreviousLaunch();
    assert(disabled.size() == 1 && disabled[0].id == "plugins:starting");
    assert(disabled[0].phase == loader::CrashPhase::Starting);
    assert(loader::crashedAddonsJSON(disabled)[0]["phase"] == "starting");
}

static int descriptorFor(const std::filesystem::path &file)
{
    std::string wanted = std::filesystem::canonical(file).string();
    for (int descriptor = 3; descriptor < 1024; descriptor++)
    {
        char path[PATH_MAX] = {0};
        if (fcntl(descriptor, F_GETPATH, path) == 0 && std::filesystem::path(path) == wanted)
        {
            return descriptor;
        }
    }

    return -1;
}

static std::string contents(const std::filesystem::path &file)
{
    std::ifstream stream(file);
    return std::string(std::istreambuf_iterator<char>(stream), std::istreambuf_iterator<char>());
}

static void reusedDescriptorIsLeftAlone(const std::filesystem::path &root)
{
    loader::AddonCrashGuard guard(root.string());
    assert(guard.beginStart("plugins:a", "A"));
    std::filesystem::path marker;
    for (const auto &entry : std::filesystem::directory_iterator(root))
    {
        if (entry.path().filename().string().find("start") != std::string::npos)
        {
            marker = entry.path();
        }
    }

    int stolen = descriptorFor(marker);
    assert(stolen >= 0);
    close(stolen);
    std::filesystem::path other = root / "other.txt";
    int reused                  = open(other.c_str(), O_RDWR | O_CREAT, 0600);
    assert(reused == stolen);
    assert(write(reused, "keep", 4) == 4);

    assert(!guard.finishStart("plugins:a"));
    assert(guard.beginStart("plugins:b", "B"));
    assert(fcntl(reused, F_GETFD) != -1);
    assert(contents(other) == "keep");
    assert(guard.finishStart("plugins:b"));
    close(reused);
}

int main()
{
    const auto root = makeTemporaryDirectory();
    const auto run  = [&](const char *name, void (*test)(const std::filesystem::path &)) {
        std::filesystem::path directory = root / name;
        std::filesystem::create_directories(directory);
        test(directory);
    };

    earlyStartSurvivesStaticInit();
    run("clean", cleanLaunchClearsNothing);
    run("consecutive", secondConsecutiveCrashDisables);
    run("reset", cleanLaunchBetweenCrashesResets);
    run("different", differentAddonResetsCount);
    run("unreadable", unreadableMarkerIsIgnored);
    run("once", verdictIsComputedOncePerProcess);
    run("running", secondCrashWhileRunningDisables);
    run("running-clean", emptyRunningMarkerIsACleanLaunch);
    run("start-and-run", startAndRunCrashesCountTogether);
    run("precedence", startingMarkerTakesPrecedence);
    run("reused-descriptor", reusedDescriptorIsLeftAlone);

    std::filesystem::remove_all(root);
    return 0;
}
