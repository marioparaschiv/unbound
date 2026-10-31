#include <cassert>
#include <functional>
#include <memory>
#include <string>
#include <vector>

#include "LoaderFileWatcher.h"

using namespace loader;

struct RecordingBackend : FileWatchBackend {
    std::vector<std::string> calls;
    std::set<std::string>    missing;

    bool watchFile(const std::string &path) override
    {
        calls.push_back("file+" + path);
        return !missing.count(path);
    }
    void unwatchFile(const std::string &path) override
    {
        calls.push_back("file-" + path);
    }
    bool watchDirectory(const std::string &path) override
    {
        calls.push_back("dir+" + path);
        return true;
    }
    void unwatchDirectory(const std::string &path) override
    {
        calls.push_back("dir-" + path);
    }
};

struct ManualClock {
    std::vector<std::pair<double, std::function<void()>>> scheduled;

    FileWatchScheduler scheduler()
    {
        return [this](double seconds, std::function<void()> work) {
            scheduled.emplace_back(seconds, std::move(work));
        };
    }

    void runAll()
    {
        auto pending = std::move(scheduled);
        scheduled.clear();
        for (auto &[seconds, work] : pending)
        {
            work();
        }
    }
};

struct Fixture {
    std::shared_ptr<RecordingBackend> backend = std::make_shared<RecordingBackend>();
    ManualClock                       clock;
    std::shared_ptr<FileWatcher>      watcher =
        std::make_shared<FileWatcher>(backend, clock.scheduler(), 0.25);
};

static void splitsPaths()
{
    assert(parentDirectory("/var/mobile/Documents/Unbound/settings.json") ==
           "/var/mobile/Documents/Unbound");
    assert(parentDirectory("/settings.json") == "/");
    assert(parentDirectory("settings.json") == "");
    assert(lastPathComponent("/var/Unbound/settings.json") == "settings.json");
    assert(lastPathComponent("settings.json") == "settings.json");
}

static void watchesFileAndDirectoryOnce()
{
    Fixture fixture;
    assert(fixture.watcher->watch("/docs/settings.json", [] {}));
    assert(!fixture.watcher->watch("/docs/settings.json", [] {}));
    assert(fixture.watcher->watch("/docs/other.json", [] {}));
    assert(fixture.watcher->isWatching("/docs/other.json"));
    assert(
        (fixture.backend->calls == std::vector<std::string>{"dir+/docs", "file+/docs/settings.json",
                                                            "file+/docs/other.json"}));
}

static void coalescesBurstsIntoOneNotification()
{
    Fixture fixture;
    int     changes = 0;
    fixture.watcher->watch("/docs/settings.json", [&] {
        changes++;
    });
    fixture.watcher->fileChanged("/docs/settings.json", FileWatchEvent::Changed);
    fixture.watcher->fileChanged("/docs/settings.json", FileWatchEvent::Changed);
    fixture.watcher->directoryChanged("/docs");
    assert(fixture.clock.scheduled.size() == 3);
    for (const auto &[seconds, work] : fixture.clock.scheduled)
    {
        assert(seconds == 0.25);
    }
    fixture.clock.runAll();
    assert(changes == 1);

    fixture.watcher->fileChanged("/docs/settings.json", FileWatchEvent::Changed);
    fixture.clock.runAll();
    assert(changes == 2);
    fixture.clock.runAll();
    assert(changes == 2);
}

static void rearmsAfterRemoval()
{
    Fixture fixture;
    int     changes = 0;
    fixture.watcher->watch("/docs/settings.json", [&] {
        changes++;
    });
    fixture.backend->calls.clear();

    fixture.watcher->fileChanged("/docs/settings.json", FileWatchEvent::Removed);
    assert((fixture.backend->calls == std::vector<std::string>{"file-/docs/settings.json"}));
    fixture.watcher->fileChanged("/docs/settings.json", FileWatchEvent::Removed);
    assert(fixture.backend->calls.size() == 1);

    fixture.watcher->directoryChanged("/docs");
    assert(fixture.backend->calls.back() == "file+/docs/settings.json");
    fixture.watcher->directoryChanged("/docs");
    assert(fixture.backend->calls.size() == 2);
    fixture.clock.runAll();
    assert(changes == 1);
}

static void retriesFilesThatDidNotExist()
{
    Fixture fixture;
    fixture.backend->missing.insert("/docs/settings.json");
    int changes = 0;
    fixture.watcher->watch("/docs/settings.json", [&] {
        changes++;
    });
    fixture.watcher->directoryChanged("/docs");
    fixture.backend->missing.clear();
    fixture.watcher->directoryChanged("/docs");
    fixture.watcher->directoryChanged("/docs");
    assert((fixture.backend->calls ==
            std::vector<std::string>{"dir+/docs", "file+/docs/settings.json",
                                     "file+/docs/settings.json", "file+/docs/settings.json"}));
    fixture.clock.runAll();
    assert(changes == 1);
}

static void filtersNamedDirectoryEvents()
{
    Fixture fixture;
    int     settings = 0;
    int     other    = 0;
    fixture.watcher->watch("/docs/settings.json", [&] {
        settings++;
    });
    fixture.watcher->watch("/docs/other.json", [&] {
        other++;
    });
    fixture.watcher->directoryChanged("/docs", "settings.json");
    fixture.watcher->directoryChanged("/docs", "settings.json.tmp");
    fixture.watcher->directoryChanged("/elsewhere", "settings.json");
    fixture.clock.runAll();
    assert(settings == 1 && other == 0);
    fixture.watcher->directoryChanged("/docs");
    fixture.clock.runAll();
    assert(settings == 2 && other == 1);
}

static void unwatchCancelsAndReleasesTheDirectory()
{
    Fixture fixture;
    int     changes = 0;
    fixture.watcher->watch("/docs/settings.json", [&] {
        changes++;
    });
    fixture.watcher->watch("/docs/other.json", [] {});
    fixture.watcher->fileChanged("/docs/settings.json", FileWatchEvent::Changed);
    fixture.backend->calls.clear();

    fixture.watcher->unwatch("/docs/settings.json");
    fixture.clock.runAll();
    assert(changes == 0);
    assert((fixture.backend->calls == std::vector<std::string>{"file-/docs/settings.json"}));
    fixture.watcher->unwatch("/docs/settings.json");
    fixture.watcher->unwatch("/docs/other.json");
    assert(
        (fixture.backend->calls == std::vector<std::string>{"file-/docs/settings.json",
                                                            "file-/docs/other.json", "dir-/docs"}));
    fixture.watcher->fileChanged("/docs/other.json", FileWatchEvent::Changed);
    fixture.watcher->directoryChanged("/docs");
    assert(fixture.clock.scheduled.empty());

    assert(fixture.watcher->watch("/docs/settings.json", [&] {
        changes += 10;
    }));
    fixture.watcher->fileChanged("/docs/settings.json", FileWatchEvent::Changed);
    fixture.clock.runAll();
    assert(changes == 10);
}

static void ignoresWorkAfterTheWatcherIsGone()
{
    auto        backend = std::make_shared<RecordingBackend>();
    ManualClock clock;
    int         changes = 0;
    {
        auto watcher = std::make_shared<FileWatcher>(backend, clock.scheduler(), 0.3);
        watcher->watch("/docs/settings.json", [&] {
            changes++;
        });
        watcher->fileChanged("/docs/settings.json", FileWatchEvent::Changed);
    }
    clock.runAll();
    assert(changes == 0);
}

int main()
{
    splitsPaths();
    watchesFileAndDirectoryOnce();
    coalescesBurstsIntoOneNotification();
    rearmsAfterRemoval();
    retriesFilesThatDidNotExist();
    filtersNamedDirectoryEvents();
    unwatchCancelsAndReleasesTheDirectory();
    ignoresWorkAfterTheWatcherIsGone();
    return 0;
}
