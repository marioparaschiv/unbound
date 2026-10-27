#include <cassert>
#include <csignal>
#include <cstdlib>
#include <fcntl.h>
#include <filesystem>
#include <fstream>
#include <nlohmann/json.hpp>
#include <sstream>
#include <string>
#include <sys/wait.h>
#include <thread>
#include <unistd.h>

#include "LoaderAddonActivity.h"
#include "LoaderCrashHandler.h"
#include "NativePluginRuntime.h"

static constexpr int kPreviousHandlerExit = 42;

static std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-addon-activity-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

static std::string readFile(const std::filesystem::path &path)
{
    std::ifstream     stream(path);
    std::stringstream contents;
    contents << stream.rdbuf();
    return contents.str();
}

static void slotsAreStablePerAddon()
{
    loader::AddonSlot first  = loader::registerAddonSlot("plugins:first", "First");
    loader::AddonSlot second = loader::registerAddonSlot("plugins:second", "");
    assert(first != loader::kNoAddon && second != loader::kNoAddon && first != second);
    assert(loader::registerAddonSlot("plugins:first", "Renamed") == first);
    assert(loader::registerAddonSlot("", "Nameless") == loader::kNoAddon);

    nlohmann::json record = nlohmann::json::parse(loader::addonRecord(first));
    assert(record == nlohmann::json({{"id", "plugins:first"}, {"name", "First"}}));
    assert(nlohmann::json::parse(loader::addonRecord(second))["name"] == "plugins:second");
    assert(loader::addonRecord(loader::kNoAddon).empty());

    loader::AddonSlot quoted = loader::registerAddonSlot("plugins:\"quoted\"", "Line\nbreak");
    nlohmann::json    parsed = nlohmann::json::parse(loader::addonRecord(quoted));
    assert(parsed["id"] == "plugins:\"quoted\"" && parsed["name"] == "Line\nbreak");

    loader::AddonSlot verbose = loader::registerAddonSlot(
        "plugins:verbose", std::string(loader::kAddonRecordByteLimit, 'x'));
    assert(nlohmann::json::parse(loader::addonRecord(verbose))["name"] == "plugins:verbose");
}

static void scopesNestAndRestore()
{
    loader::AddonSlot outer = loader::registerAddonSlot("plugins:outer", "Outer");
    loader::AddonSlot inner = loader::registerAddonSlot("plugins:inner", "Inner");
    assert(loader::currentAddon() == loader::kNoAddon);
    {
        loader::AddonScope outerScope(outer);
        assert(loader::currentAddon() == outer);
        {
            loader::AddonScope innerScope(inner);
            assert(loader::currentAddon() == inner);
            {
                loader::AddonScope unattributed(loader::kNoAddon);
                assert(loader::currentAddon() == inner);
            }
        }
        assert(loader::currentAddon() == outer);
    }
    assert(loader::currentAddon() == loader::kNoAddon);
}

static void threadsTrackTheirOwnAddon()
{
    loader::AddonSlot here  = loader::registerAddonSlot("plugins:here", "Here");
    loader::AddonSlot there = loader::registerAddonSlot("plugins:there", "There");

    loader::AddonScope scope(here);
    std::thread        worker([there]() {
        assert(loader::currentAddon() == loader::kNoAddon);
        loader::AddonScope workerScope(there);
        assert(loader::currentAddon() == there);
    });
    worker.join();
    assert(loader::currentAddon() == here);
}

static void activityCellIsTheThreadsCell()
{
    loader::AddonSlot slot = loader::registerAddonSlot("plugins:cell", "Cell");
    uint32_t         *cell = loader::claimActivityCell();
    assert(cell && cell == loader::claimActivityCell());

    *cell = slot;
    assert(loader::currentAddon() == slot);
    {
        loader::AddonScope nested(loader::registerAddonSlot("plugins:nested", "Nested"));
        assert(*cell != slot);
    }
    assert(*cell == slot);
    *cell = loader::kNoAddon;
    assert(loader::currentAddon() == loader::kNoAddon);
}

static void recordIsWrittenOnlyInsideAScope(const std::filesystem::path &root)
{
    std::filesystem::path path       = root / "record.json";
    int                   descriptor = open(path.c_str(), O_WRONLY | O_CREAT | O_TRUNC, 0600);
    assert(descriptor >= 0);

    assert(!loader::writeCrashingAddonRecord(descriptor));
    assert(readFile(path).empty());

    loader::AddonSlot slot = loader::registerAddonSlot("plugins:record", "Record");
    {
        loader::AddonScope scope(slot);
        assert(loader::writeCrashingAddonRecord(descriptor));
    }
    close(descriptor);
    assert(readFile(path) == loader::addonRecord(slot));
}

class ThreadedExecutor final : public loader::native::NativePluginExecutor
{
public:
    bool isMainThread() override
    {
        return false;
    }

    void runOnMain(std::function<void()> work) override
    {
        std::thread(std::move(work)).join();
    }

    void runOnRuntime(std::function<void(facebook::jsi::Runtime &)>) override {}

    void runAfter(double, std::function<void()>) override {}
};

static void mainThreadWorkKeepsTheCallersAddon()
{
    loader::native::setExecutor(std::make_shared<ThreadedExecutor>());
    loader::AddonSlot slot     = loader::registerAddonSlot("plugins:main", "Main");
    loader::AddonSlot observed = loader::kNoAddon;
    {
        loader::AddonScope scope(slot);
        loader::native::executeMainSynchronously([&observed]() {
            observed = loader::currentAddon();
        });
    }
    assert(observed == slot);

    loader::native::executeMainSynchronously([&observed]() {
        observed = loader::currentAddon();
    });
    assert(observed == loader::kNoAddon);
    loader::native::setExecutor(nullptr);
}

__attribute__((noinline)) static int overflowStack(int depth)
{
    volatile char frame[4096];
    frame[0] = static_cast<char>(depth);
    return overflowStack(depth + 1) + frame[0];
}

static void stackOverflowIsAttributed(const std::filesystem::path &root)
{
    std::filesystem::path marker = root / "overflow.json";
    pid_t                 child  = fork();
    assert(child >= 0);
    if (child == 0)
    {
        loader::AddonSlot slot = loader::registerAddonSlot("plugins:deep", "Deep");
        if (!loader::installAddonCrashHandler(marker.string()))
        {
            _exit(3);
        }
        loader::AddonScope scope(slot);
        _exit(overflowStack(0) == 0 ? 4 : 5);
    }

    int status = 0;
    assert(waitpid(child, &status, 0) == child);
    assert(!WIFEXITED(status) || (WEXITSTATUS(status) != 0 && WEXITSTATUS(status) < 3));
    assert(nlohmann::json::parse(readFile(marker))["id"] == "plugins:deep");
}

static void exitFromPreviousHandler(int)
{
    _exit(kPreviousHandlerExit);
}

static int crashInChild(const std::filesystem::path &marker, const std::string &id, int signal,
                        bool withPreviousHandler, bool attributed)
{
    pid_t child = fork();
    assert(child >= 0);
    if (child == 0)
    {
        if (withPreviousHandler)
        {
            struct sigaction previous = {};
            previous.sa_handler       = exitFromPreviousHandler;
            sigemptyset(&previous.sa_mask);
            sigaction(signal, &previous, nullptr);
        }
        loader::AddonSlot slot = loader::registerAddonSlot(id, "Crashy " + id);
        if (!loader::installAddonCrashHandler(marker.string()))
        {
            _exit(3);
        }
        loader::AddonScope scope(attributed ? slot : loader::kNoAddon);
        if (signal == SIGABRT)
        {
            abort();
        }
        raise(signal);
        _exit(4);
    }

    int status = 0;
    assert(waitpid(child, &status, 0) == child);
    return status;
}

static void crashChainsToThePreviousHandler(const std::filesystem::path &root)
{
    std::filesystem::path marker = root / "chained.json";
    int                   status = crashInChild(marker, "plugins:chained", SIGABRT, true, true);
    assert(WIFEXITED(status) && WEXITSTATUS(status) == kPreviousHandlerExit);

    nlohmann::json record = nlohmann::json::parse(readFile(marker));
    assert(record ==
           nlohmann::json({{"id", "plugins:chained"}, {"name", "Crashy plugins:chained"}}));
}

static void crashFallsBackToTheDefaultAction(const std::filesystem::path &root)
{
    std::filesystem::path marker = root / "default.json";
    int                   status = crashInChild(marker, "plugins:default", SIGILL, false, true);
    assert(WIFSIGNALED(status) && WTERMSIG(status) == SIGILL);
    assert(nlohmann::json::parse(readFile(marker))["id"] == "plugins:default");
}

static void unattributedCrashLeavesTheMarkerEmpty(const std::filesystem::path &root)
{
    std::filesystem::path marker = root / "unattributed.json";
    int                   status = crashInChild(marker, "plugins:idle", SIGTRAP, true, false);
    assert(WIFEXITED(status) && WEXITSTATUS(status) == kPreviousHandlerExit);
    assert(std::filesystem::exists(marker) && readFile(marker).empty());
}

int main()
{
    const auto root = makeTemporaryDirectory();

    crashChainsToThePreviousHandler(root);
    crashFallsBackToTheDefaultAction(root);
    unattributedCrashLeavesTheMarkerEmpty(root);
    stackOverflowIsAttributed(root);

    slotsAreStablePerAddon();
    scopesNestAndRestore();
    threadsTrackTheirOwnAddon();
    activityCellIsTheThreadsCell();
    mainThreadWorkKeepsTheCallersAddon();
    recordIsWrittenOnlyInsideAScope(root);

    std::filesystem::remove_all(root);
    return 0;
}
