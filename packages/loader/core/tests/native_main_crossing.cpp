#include <cassert>
#include <chrono>
#include <condition_variable>
#include <deque>
#include <functional>
#include <future>
#include <mutex>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

#include "LoaderAddonActivity.h"
#include "LoaderLog.h"
#include "LoaderThreadWarnings.h"
#include "NativeCallActivity.h"
#include "NativePluginRuntime.h"

using namespace std::chrono_literals;

class QueueExecutor final : public loader::native::NativePluginExecutor
{
public:
    QueueExecutor()
        : main_([this] {
              serve();
          })
    {
    }

    ~QueueExecutor() override
    {
        runOnMain([this] {
            stopping_ = true;
        });
        main_.join();
    }

    bool isMainThread() override
    {
        return std::this_thread::get_id() == main_.get_id();
    }

    void runOnMain(std::function<void()> work) override
    {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            queue_.push_back(std::move(work));
        }
        ready_.notify_one();
    }

    void runOnRuntime(std::function<void(facebook::jsi::Runtime &)>) override {}

    void runAfter(double, std::function<void()>) override {}

    void drain()
    {
        std::promise<void> drained;
        runOnMain([&drained] {
            drained.set_value();
        });
        drained.get_future().wait();
    }

private:
    void serve()
    {
        while (!stopping_)
        {
            std::function<void()> work;
            {
                std::unique_lock<std::mutex> lock(mutex_);
                ready_.wait(lock, [this] {
                    return !queue_.empty();
                });
                work = std::move(queue_.front());
                queue_.pop_front();
            }
            work();
        }
    }

    std::mutex                        mutex_;
    std::condition_variable           ready_;
    std::deque<std::function<void()>> queue_;
    bool                              stopping_ = false;
    std::thread                       main_;
};

class MainBlocker
{
public:
    explicit MainBlocker(QueueExecutor &executor)
    {
        std::promise<void> entered;
        auto               started = entered.get_future();
        executor.runOnMain([this, &entered] {
            entered.set_value();
            release_.get_future().wait();
        });
        started.wait();
    }

    void release()
    {
        release_.set_value();
    }

private:
    std::promise<void> release_;
};

static std::string codeOf(const std::function<void()> &body)
{
    try
    {
        body();
    }
    catch (...)
    {
        return loader::native::describeFailure(std::current_exception()).code;
    }
    return "";
}

static void crossingWaitsForTheResult(QueueExecutor &executor)
{
    bool ran = false;
    loader::native::executeMainSynchronouslyUnlessMainWaits([&] {
        ran = executor.isMainThread();
    });
    assert(ran);

    std::string failure = codeOf([] {
        loader::native::executeMainSynchronouslyUnlessMainWaits([] {
            throw std::runtime_error("selector failed");
        });
    });
    assert(failure == "NATIVE_BRIDGE_ERROR");
}

static void crossingIsRefusedWhileMainWaits(QueueExecutor &executor)
{
    bool ran = false;
    {
        loader::native::MainThreadRuntimeWait waiting;
        assert(loader::native::mainThreadIsWaitingForRuntime());
        assert(codeOf([&] {
                   loader::native::executeMainSynchronouslyUnlessMainWaits([&] {
                       ran = true;
                   });
               }) == "NATIVE_WRONG_THREAD");
    }
    assert(!loader::native::mainThreadIsWaitingForRuntime());
    executor.drain();
    assert(!ran);
}

static void crossingNoticesMainStartingToWait(QueueExecutor &executor)
{
    MainBlocker        blocker(executor);
    std::promise<void> release;
    std::thread        main([&release] {
        std::this_thread::sleep_for(50ms);
        loader::native::MainThreadRuntimeWait waiting;
        release.get_future().wait();
    });

    bool ran     = false;
    auto started = std::chrono::steady_clock::now();
    assert(codeOf([&] {
               loader::native::executeMainSynchronouslyUnlessMainWaits([&] {
                   ran = true;
               });
           }) == "NATIVE_WRONG_THREAD");
    assert(std::chrono::steady_clock::now() - started < 900ms);

    release.set_value();
    main.join();
    blocker.release();
    executor.drain();
    assert(!ran);
}

static void unguardedCrossingKeepsWaiting(QueueExecutor &executor)
{
    loader::native::MainThreadRuntimeWait waiting;
    bool                                  ran = false;
    loader::native::executeMainSynchronously([&] {
        ran = true;
    });
    assert(ran);
    (void) executor;
}

static void crossingStillTimesOut(QueueExecutor &executor)
{
    MainBlocker blocker(executor);
    bool        ran = false;
    assert(codeOf([&] {
               loader::native::executeMainSynchronouslyUnlessMainWaits(
                   [&] {
                       ran = true;
                   },
                   50ms);
           }) == "NATIVE_MAIN_THREAD_TIMEOUT");
    blocker.release();
    executor.drain();
    assert(!ran);
}

static void postedCallsKeepMainQueueOrder(QueueExecutor &executor)
{
    std::vector<std::string> order;
    MainBlocker              blocker(executor);
    loader::native::postMainOperation(
        [&] {
            order.push_back("first");
        },
        "first");
    loader::native::postMainOperation(
        [&] {
            order.push_back("second");
        },
        "second");
    assert(order.empty());

    std::thread unblock([&blocker] {
        std::this_thread::sleep_for(20ms);
        blocker.release();
    });
    loader::native::executeMainSynchronously([&] {
        order.push_back("read");
    });
    unblock.join();
    assert((order == std::vector<std::string>{"first", "second", "read"}));
}

static void postedFailuresAreLoggedWithTheAddon(QueueExecutor &executor)
{
    std::mutex               mutex;
    std::vector<std::string> errors;
    loader::setLogSink([&](loader::LogLevel level, const std::string &, const std::string &text) {
        if (level == loader::LogLevel::Error)
        {
            std::lock_guard<std::mutex> lock(mutex);
            errors.push_back(text);
        }
    });

    loader::AddonSlot slot     = loader::registerAddonSlot("plugins:posted", "Posted Plugin");
    loader::AddonSlot observed = loader::kNoAddon;
    {
        loader::AddonScope scope(slot);
        loader::native::postMainOperation(
            [&] {
                observed = loader::currentAddon();
                throw std::runtime_error("selector failed");
            },
            "objc.invoke setHidden:");
    }
    executor.drain();
    loader::setLogSink(nullptr);

    assert(observed == slot);
    assert(errors.size() == 1);
    assert(errors[0] == loader::native::postedMainFailureMessage(
                            slot, "objc.invoke setHidden:", "selector failed"));
    assert(errors[0].find("Posted Plugin") != std::string::npos);
    assert(errors[0].find("setHidden:") != std::string::npos);
}

static void postingOnMainRunsInline(QueueExecutor &executor)
{
    std::promise<bool> inlineRun;
    executor.runOnMain([&] {
        bool ran = false;
        loader::native::postMainOperation(
            [&] {
                ran = true;
            },
            "inline");
        inlineRun.set_value(ran);
    });
    assert(inlineRun.get_future().get());
}

static const nlohmann::json *findWaits(const nlohmann::json &waits, const std::string &addon,
                                       const std::string &kind, const std::string &label)
{
    for (const nlohmann::json &entry : waits)
    {
        if (entry["addon"] == addon && entry["kind"] == kind && entry["label"] == label)
        {
            return &entry;
        }
    }
    return nullptr;
}

static void crossingsAreTimedPerAddonAndLabel(QueueExecutor &executor)
{
    loader::native::resetMainWorkCounts();
    loader::AddonSlot slot = loader::registerAddonSlot("plugins:timed", "Timed Plugin");
    {
        loader::AddonScope      addon(slot);
        loader::NativeCallScope call("invoke", "setHidden:");
        for (int index = 0; index < 3; index++)
        {
            loader::native::executeMainSynchronously([] {
                std::this_thread::sleep_for(2ms);
            });
        }
        loader::native::postMainOperation([] {}, "objc.invoke layoutIfNeeded");
    }
    executor.drain();

    nlohmann::json        waits = loader::native::mainWaitCounts();
    const nlohmann::json *sync  = findWaits(waits, "Timed Plugin", "sync", "invoke(setHidden:)");
    assert(sync);
    assert((*sync)["posted"] == 3 && (*sync)["started"] == 3 && (*sync)["finished"] == 3);
    assert((*sync)["expired"] == 0);
    assert((*sync)["runMs"].get<double>() >= 6.0);
    assert((*sync)["maxRunMs"].get<double>() >= 2.0);
    assert((*sync)["queuedMs"].get<double>() >= 0.0);

    const nlohmann::json *posted =
        findWaits(waits, "Timed Plugin", "posted", "objc.invoke layoutIfNeeded");
    assert(posted && (*posted)["posted"] == 1 && (*posted)["finished"] == 1);

    loader::native::resetMainWorkCounts();
    waits = loader::native::mainWaitCounts();
    assert(!findWaits(waits, "Timed Plugin", "sync", "invoke(setHidden:)"));
}

static void expiredCrossingsAreCounted(QueueExecutor &executor)
{
    loader::native::resetMainWorkCounts();
    {
        MainBlocker             blocker(executor);
        loader::NativeCallScope call("invoke", "slow");
        try
        {
            loader::native::executeMainSynchronously([] {}, 20ms);
        }
        catch (const loader::native::NativeCodedError &)
        {
        }
        blocker.release();
    }
    executor.drain();
    nlohmann::json        counts = loader::native::mainWaitCounts();
    const nlohmann::json *waits =
        findWaits(counts, loader::threading::addonName(loader::kNoAddon), "sync", "invoke(slow)");
    assert(waits && (*waits)["posted"] == 1 && (*waits)["expired"] == 1 &&
           (*waits)["started"] == 0);
}

static void mainDrainsAreCounted()
{
    loader::native::resetMainWorkCounts();
    loader::native::recordMainDrain(3, 4ms);
    loader::native::recordMainDrain(5, 1ms);
    nlohmann::json counts = loader::native::mainWorkCounts();
    assert(counts["drains"] == 2);
    assert(counts["items"] == 8);
    assert(counts["maxDrainItems"] == 5);
    assert(counts["drainMs"].get<double>() == 5.0);
    assert(counts["maxDrainMs"].get<double>() == 4.0);
    loader::native::resetMainWorkCounts();
    assert(loader::native::mainWorkCounts()["drains"] == 0);
}

static void cachedLabelsFollowTheCurrentCall(QueueExecutor &executor)
{
    loader::native::resetMainWorkCounts();
    {
        loader::NativeCallScope first("invoke", "first");
        loader::native::executeMainSynchronously([] {});
    }
    {
        loader::NativeCallScope second("invoke", "second");
        loader::native::executeMainSynchronously([] {});
        loader::native::postMainOperation([] {}, "");
    }
    loader::native::executeMainSynchronously([] {});
    executor.drain();

    nlohmann::json counts = loader::native::mainWaitCounts();
    std::string    none   = loader::threading::addonName(loader::kNoAddon);
    assert(findWaits(counts, none, "sync", "invoke(first)"));
    assert(findWaits(counts, none, "sync", "invoke(second)"));
    assert(findWaits(counts, none, "posted", "invoke(second)"));
    const nlohmann::json *outside = findWaits(counts, none, "sync", "");
    assert(outside && (*outside)["posted"] == 1);
}

static void debugEnvironmentCollectsGarbageAndResetsCounters()
{
    loader::native::resetMainWorkCounts();
    loader::native::recordMainDrain(2, 1ms);
    {
        loader::NativeCallScope call("invoke", "measured");
        loader::native::executeMainSynchronously([] {});
    }

    int runtimeCollections = 0;
    int uiCollections      = 0;
    loader::native::setUIRuntimeGarbageCollector([&uiCollections] {
        uiCollections++;
        return true;
    });
    nlohmann::json environment = loader::native::debugEnvironmentSnapshot(
        {.collectGarbage = true, .resetCounters = true}, [&runtimeCollections] {
            runtimeCollections++;
        });
    assert(runtimeCollections == 1 && uiCollections == 1);
    assert(environment["garbageCollection"]["runtime"] == true);
    assert(environment["garbageCollection"]["uiRuntime"] == true);
    assert(environment["resources"]["mainWork"]["drains"] == 1);
    assert(findWaits(environment["resources"]["mainWaits"],
                     loader::threading::addonName(loader::kNoAddon), "sync", "invoke(measured)"));
    assert(loader::native::mainWorkCounts()["drains"] == 0);
    assert(loader::native::mainWaitCounts().empty());

    loader::native::setUIRuntimeGarbageCollector([]() -> bool {
        throw std::runtime_error("collector failed");
    });
    environment = loader::native::debugEnvironmentSnapshot({.collectGarbage = true}, [] {});
    assert(environment["garbageCollection"]["uiRuntime"] == false);

    loader::native::setUIRuntimeGarbageCollector(nullptr);
    environment = loader::native::debugEnvironmentSnapshot({.collectGarbage = true}, [] {});
    assert(environment["garbageCollection"]["uiRuntime"] == false);

    environment = loader::native::debugEnvironmentSnapshot({}, [&runtimeCollections] {
        runtimeCollections++;
    });
    assert(runtimeCollections == 1);
    assert(!environment.contains("garbageCollection"));
}

int main()
{
    auto executor = std::make_shared<QueueExecutor>();
    loader::native::setExecutor(executor);

    crossingWaitsForTheResult(*executor);
    crossingIsRefusedWhileMainWaits(*executor);
    crossingNoticesMainStartingToWait(*executor);
    unguardedCrossingKeepsWaiting(*executor);
    crossingStillTimesOut(*executor);
    postedCallsKeepMainQueueOrder(*executor);
    postedFailuresAreLoggedWithTheAddon(*executor);
    postingOnMainRunsInline(*executor);
    crossingsAreTimedPerAddonAndLabel(*executor);
    expiredCrossingsAreCounted(*executor);
    mainDrainsAreCounted();
    cachedLabelsFollowTheCurrentCall(*executor);
    debugEnvironmentCollectsGarbageAndResetsCounters();

    loader::native::setExecutor(nullptr);
    return 0;
}
