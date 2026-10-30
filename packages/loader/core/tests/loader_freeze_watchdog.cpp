#include <atomic>
#include <cassert>
#include <chrono>
#include <condition_variable>
#include <deque>
#include <filesystem>
#include <functional>
#include <mutex>
#include <string>
#include <thread>
#include <unistd.h>
#include <vector>

#include "LoaderAddonActivity.h"
#include "LoaderCrashGuard.h"
#include "LoaderFiles.h"
#include "LoaderFreezeWatchdog.h"

using namespace std::chrono_literals;

class FakeRuntimeThread
{
public:
    FakeRuntimeThread()
    {
        thread_ = std::thread([this] {
            loop();
        });
    }

    ~FakeRuntimeThread()
    {
        post(nullptr);
        thread_.join();
    }

    void post(std::function<void()> work)
    {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            queue_.push_back(std::move(work));
        }
        wake_.notify_one();
    }

private:
    void loop()
    {
        while (true)
        {
            std::function<void()> work;
            {
                std::unique_lock<std::mutex> lock(mutex_);
                wake_.wait(lock, [this] {
                    return !queue_.empty();
                });
                work = std::move(queue_.front());
                queue_.pop_front();
            }
            if (!work)
            {
                return;
            }
            work();
        }
    }

    std::thread                       thread_;
    std::mutex                        mutex_;
    std::condition_variable           wake_;
    std::deque<std::function<void()>> queue_;
};

static std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-freeze-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

int main()
{
    std::filesystem::path root   = makeTemporaryDirectory();
    std::string           marker = (root / loader::AddonCrashGuard::kFrozenFile).string();
    loader::AddonSlot     slot   = loader::registerAddonSlot("astral.frozen", "Frozen Plugin");
    FakeRuntimeThread     runtime;
    std::mutex            reportsMutex;
    std::vector<loader::FreezeReport> reports;

    {
        loader::FreezeWatchdog watchdog(
            root.string(),
            [&runtime](std::function<void()> beat) {
                runtime.post(std::move(beat));
                return true;
            },
            [&](const loader::FreezeReport &report) {
                std::lock_guard<std::mutex> lock(reportsMutex);
                reports.push_back(report);
            },
            {20ms, 150ms});

        std::this_thread::sleep_for(100ms);
        assert(!loader::fileExists(marker));

        std::atomic_bool markerSeen{false};
        runtime.post([&] {
            loader::AddonScope scope(slot);
            for (int waited = 0; waited < 300 && !loader::fileExists(marker); waited++)
            {
                std::this_thread::sleep_for(10ms);
            }
            markerSeen = loader::fileExists(marker);
        });

        for (int waited = 0; waited < 300; waited++)
        {
            {
                std::lock_guard<std::mutex> lock(reportsMutex);
                if (!reports.empty())
                {
                    break;
                }
            }
            std::this_thread::sleep_for(10ms);
        }

        assert(markerSeen);
        std::lock_guard<std::mutex> lock(reportsMutex);
        assert(reports.size() == 1);
        assert(reports[0].id == "astral.frozen");
        assert(reports[0].name == "Frozen Plugin");
        assert(reports[0].resolved);
        assert(reports[0].seconds >= 0.15);
    }

    assert(!loader::fileExists(marker));

    std::vector<loader::FreezeReport> unattributed;
    {
        loader::FreezeWatchdog watchdog(
            root.string(),
            [&runtime](std::function<void()> beat) {
                runtime.post(std::move(beat));
                return true;
            },
            [&](const loader::FreezeReport &report) {
                unattributed.push_back(report);
            },
            {20ms, 100ms});
        std::this_thread::sleep_for(60ms);
        runtime.post([] {
            std::this_thread::sleep_for(300ms);
        });
        std::this_thread::sleep_for(500ms);
    }
    assert(unattributed.empty());
    assert(!loader::fileExists(marker));

    assert(loader::writeTextFileAtomically(marker,
                                           R"({"id":"astral.frozen","name":"Frozen Plugin"})"));
    assert(loader::AddonCrashGuard(root.string()).recoverFromPreviousLaunch().empty());
    assert(loader::writeTextFileAtomically(marker,
                                           R"({"id":"astral.frozen","name":"Frozen Plugin"})"));
    std::vector<loader::CrashedAddon> disabled =
        loader::AddonCrashGuard(root.string()).recoverFromPreviousLaunch();
    assert(disabled.size() == 1 && disabled[0].id == "astral.frozen");
    assert(disabled[0].phase == loader::CrashPhase::Frozen);
    assert(loader::crashDisabledNotice(disabled[0]) ==
           "Disabled Frozen Plugin because Discord froze in it and had to be closed.");

    std::filesystem::remove_all(root);
    return 0;
}
