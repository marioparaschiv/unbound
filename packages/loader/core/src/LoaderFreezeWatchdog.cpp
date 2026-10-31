#include "LoaderFreezeWatchdog.h"

#include <atomic>
#include <condition_variable>
#include <memory>
#include <mutex>
#include <nlohmann/json.hpp>
#include <thread>

#include "HermesSampling.h"
#include "LoaderAddonActivity.h"
#include "LoaderCrashGuard.h"
#include "LoaderFiles.h"
#include "LoaderLog.h"
#include "NativeCallActivity.h"
#include "NativePluginRuntime.h"

namespace loader {
namespace jsi = facebook::jsi;

using Clock = std::chrono::steady_clock;

struct FreezeWatchdog::State {
    std::string             directory;
    FreezeHeartbeat         heartbeat;
    FreezeListener          listener;
    FreezeWatchdogOptions   options;
    std::mutex              mutex;
    std::condition_variable wake;
    bool                    stopping = false;
    std::atomic<int64_t>    answeredAt{0};
    std::atomic<uintptr_t>  runtimeThread{0};
    std::thread             thread;
};

static int64_t nowMilliseconds()
{
    return std::chrono::duration_cast<std::chrono::milliseconds>(Clock::now().time_since_epoch())
        .count();
}

static std::string frozenPath(const std::string &directory)
{
    return joinPath(directory, AddonCrashGuard::kFrozenFile);
}

static void watch(const std::shared_ptr<FreezeWatchdog::State> &state)
{
    int64_t      sentAt   = 0;
    bool         reported = false;
    std::string  frozenRecord;
    FreezeReport current;

    while (true)
    {
        {
            std::unique_lock<std::mutex> lock(state->mutex);
            state->wake.wait_for(lock, state->options.interval, [&] {
                return state->stopping;
            });
            if (state->stopping)
            {
                break;
            }
        }

        int64_t now      = nowMilliseconds();
        int64_t answered = state->answeredAt.load();
        if (sentAt == 0 || answered >= sentAt)
        {
            if (reported)
            {
                removeFile(frozenPath(state->directory));
                current.seconds  = static_cast<double>(answered - sentAt) / 1000.0;
                current.resolved = true;
                log(LogLevel::Warning, LOG_CATEGORY_PLUGINS,
                    current.name + " froze Discord for " + std::to_string(current.seconds) +
                        " seconds.");
                state->listener(current);
                reported = false;
            }
            std::weak_ptr<FreezeWatchdog::State> weak   = state;
            bool                                 posted = state->heartbeat([weak] {
                if (auto alive = weak.lock())
                {
                    alive->runtimeThread.store(currentActivityThread());
                    alive->answeredAt.store(nowMilliseconds());
                }
            });
            sentAt                                      = posted ? now : 0;
            continue;
        }

        if (reported || now - sentAt < state->options.threshold.count())
        {
            continue;
        }

        std::string record = addonRecord(addonOnThread(state->runtimeThread.load()));
        if (record.empty())
        {
            continue;
        }
        nlohmann::json parsed = nlohmann::json::parse(record, nullptr, false);
        if (!parsed.is_object())
        {
            continue;
        }
        auto textOf = [&parsed](const char *key) {
            auto field = parsed.find(key);
            return field != parsed.end() && field->is_string() ? field->get<std::string>()
                                                               : std::string();
        };
        current = {
            textOf("id"), textOf("name"), static_cast<double>(now - sentAt) / 1000.0, false, {}};
        if (current.id.empty())
        {
            continue;
        }
        createDirectories(state->directory);
        writeTextFileAtomically(frozenPath(state->directory), record);
        auto call                        = nativeCallOnThread(state->runtimeThread.load());
        current.detail                   = describeNativeCall(call, nativeCallClock());
        std::vector<std::string> frames  = native::sampleJavaScriptStack(state->options.sampling);
        std::string              sampled = native::describeSampledStack(frames, call.has_value());
        current.stack                    = native::formatSampledStack(frames);
        log(LogLevel::Error, LOG_CATEGORY_PLUGINS,
            "Discord's JavaScript thread has been frozen in " + current.name + " for " +
                std::to_string(now - sentAt) + " ms. " + current.detail +
                (sampled.empty() ? "" : " " + sampled));
        reported = true;
    }
}

FreezeWatchdog::FreezeWatchdog(std::string directory, FreezeHeartbeat heartbeat,
                               FreezeListener listener, FreezeWatchdogOptions options)
    : state_(std::make_shared<State>())
{
    state_->directory             = std::move(directory);
    state_->heartbeat             = std::move(heartbeat);
    state_->listener              = std::move(listener);
    state_->options               = options;
    std::shared_ptr<State> shared = state_;
    state_->thread                = std::thread([shared] {
        watch(shared);
    });
}

FreezeWatchdog::~FreezeWatchdog()
{
    {
        std::lock_guard<std::mutex> lock(state_->mutex);
        state_->stopping = true;
    }
    state_->wake.notify_all();
    if (state_->thread.joinable())
    {
        state_->thread.join();
    }
}

static constexpr const char *kFreezeListener = "__UnboundFreezeListener";

void startFreezeWatchdog(const std::string &directory)
{
    static std::once_flag once;
    std::call_once(once, [directory] {
        [[maybe_unused]] static auto *watchdog = new FreezeWatchdog(
            directory,
            [](std::function<void()> beat) {
                auto target = native::executor();
                if (!target)
                {
                    return false;
                }
                target->runOnRuntime([beat = std::move(beat)](jsi::Runtime &) {
                    beat();
                });
                return true;
            },
            [](const FreezeReport &report) {
                native::executeRuntimeAsynchronously([report](jsi::Runtime &runtime) {
                    jsi::Value listener = runtime.global().getProperty(runtime, kFreezeListener);
                    if (!listener.isObject() || !listener.asObject(runtime).isFunction(runtime))
                    {
                        return;
                    }
                    jsi::Object event(runtime);
                    event.setProperty(runtime, "id",
                                      jsi::String::createFromUtf8(runtime, report.id));
                    event.setProperty(runtime, "name",
                                      jsi::String::createFromUtf8(runtime, report.name));
                    event.setProperty(runtime, "seconds", report.seconds);
                    event.setProperty(runtime, "detail",
                                      jsi::String::createFromUtf8(runtime, report.detail));
                    if (!report.stack.empty())
                    {
                        event.setProperty(runtime, "stack",
                                          jsi::String::createFromUtf8(runtime, report.stack));
                    }
                    listener.asObject(runtime).asFunction(runtime).call(runtime, event);
                });
            });
    });
}
}
