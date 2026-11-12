#include "NativePluginRuntime.h"

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <cstring>
#include <exception>
#include <mutex>
#include <thread>

#include "LoaderLog.h"
#include "LoaderThreadWarnings.h"
#include "NativeErrors.h"
#include "NativeMainWaits.h"
#include "NativeOperationGate.h"
#include "RuntimeStallGate.h"

namespace loader::native {
namespace jsi = facebook::jsi;

static constexpr const char *kPendingInvocations = "__NativePluginPendingInvocations";

static std::mutex                            gStateMutex;
static std::shared_ptr<NativePluginExecutor> gExecutor;
static jsi::Runtime                         *gRuntime = nullptr;
static std::thread::id                       gRuntimeThread;
static RuntimeGenerationTracker              gGenerations;
static std::atomic_uint64_t                  gNextInvocation{1};
static std::atomic_uint                      gMainThreadRuntimeWaits{0};
static RuntimeStallGate                      gMainThreadRuntimeStall;
static std::mutex                            gCrossingMutex;
static std::condition_variable               gCrossingChanged;

std::optional<uint64_t> RuntimeGenerationTracker::advance(const void *runtime,
                                                          bool        alreadyRegistered)
{
    if (runtime_ == runtime && alreadyRegistered)
    {
        return std::nullopt;
    }
    runtime_ = runtime;
    return generation_.fetch_add(1) + 1;
}

uint64_t RuntimeGenerationTracker::generation() const
{
    return generation_.load();
}

void RuntimeGenerationTracker::addListener(RuntimeGenerationListener listener)
{
    std::lock_guard<std::mutex> lock(listenersMutex_);
    listeners_.push_back(std::move(listener));
}

void RuntimeGenerationTracker::notify(uint64_t generation) const
{
    std::vector<RuntimeGenerationListener> listeners;
    {
        std::lock_guard<std::mutex> lock(listenersMutex_);
        listeners = listeners_;
    }
    for (const RuntimeGenerationListener &listener : listeners)
    {
        try
        {
            listener(generation);
        }
        catch (const std::exception &error)
        {
            log(LogLevel::Error, LOG_CATEGORY_PLUGINS,
                std::string("Runtime generation listener failed: ") + error.what());
        }
        catch (...)
        {
            log(LogLevel::Error, LOG_CATEGORY_PLUGINS, "Runtime generation listener failed");
        }
    }
}

void setExecutor(std::shared_ptr<NativePluginExecutor> value)
{
    std::lock_guard<std::mutex> lock(gStateMutex);
    gExecutor = std::move(value);
}

std::shared_ptr<NativePluginExecutor> executor()
{
    std::lock_guard<std::mutex> lock(gStateMutex);
    return gExecutor;
}

static constexpr const char *kRuntimeGenerationMarker = "__unboundRuntimeGeneration";

static bool carriesGeneration(jsi::Runtime &runtime, uint64_t generation)
{
    jsi::Value marker = runtime.global().getProperty(runtime, kRuntimeGenerationMarker);
    return marker.isNumber() && marker.getNumber() == static_cast<double>(generation);
}

uint64_t registerRuntime(jsi::Runtime &runtime)
{
    bool alreadyRegistered = carriesGeneration(runtime, gGenerations.generation());
    std::optional<uint64_t> advanced;
    {
        std::lock_guard<std::mutex> lock(gStateMutex);
        advanced       = gGenerations.advance(&runtime, alreadyRegistered);
        gRuntime       = &runtime;
        gRuntimeThread = std::this_thread::get_id();
    }
    uint64_t generation = gGenerations.generation();
    runtime.global().setProperty(runtime, kRuntimeGenerationMarker,
                                 jsi::Value(static_cast<double>(generation)));
    if (advanced)
    {
        gGenerations.notify(*advanced);
    }
    return generation;
}

uint64_t runtimeGeneration()
{
    return gGenerations.generation();
}

void onRuntimeGenerationChanged(RuntimeGenerationListener listener)
{
    gGenerations.addListener(std::move(listener));
}

bool isRuntimeThread()
{
    std::lock_guard<std::mutex> lock(gStateMutex);
    return gRuntime && std::this_thread::get_id() == gRuntimeThread;
}

bool mainThreadIsWaitingForRuntime()
{
    return gMainThreadRuntimeWaits.load() > 0;
}

static jsi::Runtime *currentRuntime()
{
    std::lock_guard<std::mutex> lock(gStateMutex);
    return gRuntime;
}

struct MainCrossing {
    bool                finished = false;
    std::exception_ptr  failure;
    NativeOperationGate gate;
};

MainThreadRuntimeWait::MainThreadRuntimeWait()
{
    {
        std::lock_guard<std::mutex> lock(gCrossingMutex);
        gMainThreadRuntimeWaits.fetch_add(1);
    }
    gCrossingChanged.notify_all();
}

MainThreadRuntimeWait::~MainThreadRuntimeWait()
{
    std::lock_guard<std::mutex> lock(gCrossingMutex);
    gMainThreadRuntimeWaits.fetch_sub(1);
}

[[noreturn]] static void refuseCrossingWhileMainWaits()
{
    throw NativeCodedError("NATIVE_WRONG_THREAD", kMainWaitsForRuntimeMessage);
}

static void crossToMain(std::function<void()> operation, std::chrono::milliseconds timeout,
                        bool refuseWhileMainWaits)
{
    auto target = executor();
    if (!target)
    {
        throw NativeCodedError("NATIVE_PLUGIN_UNAVAILABLE", "Native executor is unavailable");
    }

    if (target->isMainThread())
    {
        operation();
        return;
    }

    if (refuseWhileMainWaits && mainThreadIsWaitingForRuntime())
    {
        refuseCrossingWhileMainWaits();
    }

    auto           crossing = std::make_shared<MainCrossing>();
    AddonSlot      addon    = currentAddon();
    auto           deadline = std::chrono::steady_clock::now() + timeout;
    MainWaitTiming timing(currentCallRecord(addon, MainWorkKind::Synchronous));
    target->runOnMain([crossing, operation = std::move(operation), addon, timing]() {
        if (!crossing->gate.start())
        {
            return;
        }
        uint64_t startedAt = timing.started();
        try
        {
            AddonScope scope(addon);
            operation();
        }
        catch (...)
        {
            crossing->failure = std::current_exception();
        }
        timing.finished(startedAt);
        crossing->gate.finish();
        {
            std::lock_guard<std::mutex> lock(gCrossingMutex);
            crossing->finished = true;
        }
        gCrossingChanged.notify_all();
    });

    std::unique_lock<std::mutex> lock(gCrossingMutex);
    bool                         pastDeadline = false;
    while (!crossing->finished)
    {
        if (refuseWhileMainWaits && mainThreadIsWaitingForRuntime() && crossing->gate.expire())
        {
            timing.expired();
            refuseCrossingWhileMainWaits();
        }
        if (pastDeadline)
        {
            gCrossingChanged.wait(lock);
            continue;
        }
        if (gCrossingChanged.wait_until(lock, deadline) == std::cv_status::timeout)
        {
            pastDeadline = true;
            if (!crossing->finished && crossing->gate.expire())
            {
                timing.expired();
                throw NativeCodedError(
                    "NATIVE_MAIN_THREAD_TIMEOUT",
                    "Native operation timed out before reaching the main thread");
            }
        }
    }

    if (crossing->failure)
    {
        std::rethrow_exception(crossing->failure);
    }
}

void executeMainSynchronously(std::function<void()> operation, std::chrono::milliseconds timeout)
{
    crossToMain(std::move(operation), timeout, false);
}

void executeMainSynchronouslyUnlessMainWaits(std::function<void()>     operation,
                                             std::chrono::milliseconds timeout)
{
    crossToMain(std::move(operation), timeout, true);
}

std::string postedMainFailureMessage(AddonSlot addon, const std::string &description,
                                     const std::string &reason)
{
    return "Posted native call " + description + " failed in " + threading::addonName(addon) +
           ": " + reason;
}

void postMainOperation(std::function<void()> operation, std::string description)
{
    auto target = executor();
    if (!target)
    {
        throw NativeCodedError("NATIVE_PLUGIN_UNAVAILABLE", "Native executor is unavailable");
    }

    if (target->isMainThread())
    {
        operation();
        return;
    }

    AddonSlot      addon = currentAddon();
    MainWaitTiming timing(description.empty()
                              ? currentCallRecord(addon, MainWorkKind::Posted)
                              : mainWaitRecord(addon, MainWorkKind::Posted, description));
    target->runOnMain(
        [operation = std::move(operation), description = std::move(description), addon, timing]() {
            uint64_t   startedAt = timing.started();
            AddonScope scope(addon);
            try
            {
                operation();
            }
            catch (...)
            {
                NativeFailure failure = describeFailure(std::current_exception());
                log(LogLevel::Error, LOG_CATEGORY_PLUGINS,
                    postedMainFailureMessage(addon, description, failure.message));
            }
            timing.finished(startedAt);
        });
}

static std::optional<jsi::Object> takePending(jsi::Runtime &runtime, const std::string &identifier)
{
    jsi::Value pendingValue = runtime.global().getProperty(runtime, kPendingInvocations);
    if (!pendingValue.isObject())
    {
        return std::nullopt;
    }

    jsi::Object pending   = pendingValue.asObject(runtime);
    jsi::Value  pairValue = pending.getProperty(runtime, identifier.c_str());
    if (!pairValue.isObject())
    {
        return std::nullopt;
    }

    pending.deleteProperty(runtime, identifier.c_str());
    return pairValue.asObject(runtime);
}

static void settlePending(jsi::Runtime &runtime, const jsi::Object &pair,
                          const std::optional<NativeFailure>              &failure,
                          const std::function<jsi::Value(jsi::Runtime &)> &result)
{
    jsi::Function reject = pair.getPropertyAsFunction(runtime, "reject");
    if (failure)
    {
        reject.call(runtime, makeError(runtime, failure->code.c_str(), failure->message));
        return;
    }
    try
    {
        jsi::Value value = result(runtime);
        pair.getPropertyAsFunction(runtime, "resolve").call(runtime, value);
    }
    catch (const jsi::JSError &error)
    {
        attachDefaultCode(runtime, error);
        reject.call(runtime, error.value());
    }
    catch (...)
    {
        NativeFailure described = describeFailure(std::current_exception());
        reject.call(runtime, makeError(runtime, described.code.c_str(), described.message));
    }
}

static void rejectPending(jsi::Runtime &runtime, const std::string &identifier, const char *code,
                          const std::string &message)
{
    std::optional<jsi::Object> pair = takePending(runtime, identifier);
    if (!pair)
    {
        return;
    }

    pair->getPropertyAsFunction(runtime, "reject").call(runtime, makeError(runtime, code, message));
}

static thread_local bool tRunningAsynchronousMainOperation = false;

class AsynchronousMainOperation
{
public:
    AsynchronousMainOperation() : previous_(tRunningAsynchronousMainOperation)
    {
        tRunningAsynchronousMainOperation = true;
    }

    ~AsynchronousMainOperation()
    {
        tRunningAsynchronousMainOperation = previous_;
    }

private:
    bool previous_;
};

bool runningAsynchronousMainOperation()
{
    return tRunningAsynchronousMainOperation;
}

jsi::Value executeMainAsynchronously(jsi::Runtime &runtime, std::function<void()> operation,
                                     std::function<jsi::Value(jsi::Runtime &)> result,
                                     bool                                      nextFrame)
{
    auto target = executor();
    if (!target)
    {
        throwCoded(runtime, "NATIVE_PLUGIN_UNAVAILABLE", "Native executor is unavailable");
    }

    uint64_t        generation = gGenerations.generation();
    std::string     identifier = std::to_string(gNextInvocation.fetch_add(1));
    auto            cancelled  = std::make_shared<std::atomic_bool>(false);
    auto            gate       = std::make_shared<NativeOperationGate>();
    AddonSlot       addon      = currentAddon();
    MainWaitRecord *waits      = &currentCallRecord(addon, MainWorkKind::Asynchronous);

    jsi::Object global       = runtime.global();
    jsi::Value  pendingValue = global.getProperty(runtime, kPendingInvocations);
    if (!pendingValue.isObject())
    {
        global.setProperty(runtime, kPendingInvocations, jsi::Object(runtime));
    }

    jsi::Function executorFunction = makeFunction(
        runtime, "nativeMainExecutor", 2,
        [target, operation = std::move(operation), result = std::move(result), identifier,
         cancelled, gate, generation, addon, nextFrame,
         waits](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *callbacks,
                size_t count) -> jsi::Value {
            if (count < 2 || !callbacks[0].isObject() || !callbacks[1].isObject())
            {
                throw NativeCodedError(
                    kNativeBridgeErrorCode,
                    "Native asynchronous operation could not create its promise");
            }

            jsi::Object pair(rt);
            pair.setProperty(rt, "resolve", callbacks[0].asObject(rt));
            pair.setProperty(rt, "reject", callbacks[1].asObject(rt));
            rt.global()
                .getPropertyAsObject(rt, kPendingInvocations)
                .setProperty(rt, identifier.c_str(), pair);

            MainWaitTiming timing(*waits);
            auto runOperation = [operation, result, identifier, cancelled, gate, generation, addon,
                                 timing]() {
                if (cancelled->load() || !gate->start() || generation != gGenerations.generation())
                {
                    return;
                }

                uint64_t                     startedAt = timing.started();
                AddonScope                   scope(addon);
                std::optional<NativeFailure> failure;
                try
                {
                    AsynchronousMainOperation running;
                    operation();
                }
                catch (...)
                {
                    failure = describeFailure(std::current_exception());
                }
                timing.finished(startedAt);
                gate->finish();

                executeRuntimeAsynchronously(
                    [identifier, cancelled, generation, result, failure](jsi::Runtime &completion) {
                        if (generation != gGenerations.generation())
                        {
                            return;
                        }

                        std::optional<jsi::Object> pair = takePending(completion, identifier);
                        if (!pair || cancelled->load())
                        {
                            return;
                        }
                        settlePending(completion, *pair, failure, result);
                    });
            };
            if (nextFrame)
            {
                if (!target->runOnMainNextFrame(std::move(runOperation)))
                {
                    gate->expire();
                    cancelled->store(true);
                    rejectPending(rt, identifier, "NATIVE_FRAME_SCHEDULING_FAILED",
                                  "Native frame work could not be scheduled");
                    return jsi::Value::undefined();
                }
            }
            else
            {
                target->runOnMain(std::move(runOperation));
            }

            target->runAfter(1.0, [identifier, cancelled, gate, generation, timing]() {
                if (!gate->expire())
                {
                    return;
                }
                timing.expired();
                cancelled->store(true);
                executeRuntimeAsynchronously([identifier, generation](jsi::Runtime &completion) {
                    if (generation != gGenerations.generation())
                    {
                        return;
                    }
                    rejectPending(completion, identifier, "NATIVE_MAIN_THREAD_TIMEOUT",
                                  "Native operation timed out before reaching the main thread");
                });
            });

            return jsi::Value::undefined();
        });

    jsi::Function constructor = global.getPropertyAsFunction(runtime, "Promise");
    jsi::Object   promise =
        constructor.callAsConstructor(runtime, std::move(executorFunction)).asObject(runtime);

    promise.setProperty(
        runtime, "cancel",
        makeFunction(runtime, "cancel", 0,
                     [identifier, cancelled, gate](jsi::Runtime &rt, const jsi::Value &,
                                                   const jsi::Value *, size_t) -> jsi::Value {
                         gate->expire();
                         if (cancelled->exchange(true))
                         {
                             return jsi::Value::undefined();
                         }
                         rejectPending(rt, identifier, "NATIVE_PLUGIN_SCOPE_DISPOSED",
                                       "Native async invocation was cancelled");
                         return jsi::Value::undefined();
                     }));

    return promise;
}

jsi::Value executeBackgroundAsynchronously(jsi::Runtime &runtime, std::function<void()> operation,
                                           std::function<jsi::Value(jsi::Runtime &)> result)
{
    if (!executor())
    {
        throwCoded(runtime, "NATIVE_PLUGIN_UNAVAILABLE", "Native executor is unavailable");
    }

    uint64_t    generation = gGenerations.generation();
    std::string identifier = std::to_string(gNextInvocation.fetch_add(1));
    jsi::Object global     = runtime.global();
    if (!global.getProperty(runtime, kPendingInvocations).isObject())
    {
        global.setProperty(runtime, kPendingInvocations, jsi::Object(runtime));
    }

    jsi::Function executorFunction = makeFunction(
        runtime, "nativeBackgroundExecutor", 2,
        [operation = std::move(operation), result = std::move(result), identifier,
         generation](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *callbacks,
                     size_t count) -> jsi::Value {
            if (count < 2 || !callbacks[0].isObject() || !callbacks[1].isObject())
            {
                throw NativeCodedError(
                    kNativeBridgeErrorCode,
                    "Native asynchronous operation could not create its promise");
            }

            jsi::Object pair(rt);
            pair.setProperty(rt, "resolve", callbacks[0].asObject(rt));
            pair.setProperty(rt, "reject", callbacks[1].asObject(rt));
            rt.global()
                .getPropertyAsObject(rt, kPendingInvocations)
                .setProperty(rt, identifier.c_str(), pair);

            std::thread([operation, result, identifier, generation] {
                std::optional<NativeFailure> failure;
                try
                {
                    operation();
                }
                catch (...)
                {
                    failure = describeFailure(std::current_exception());
                }
                executeRuntimeAsynchronously(
                    [identifier, generation, result, failure](jsi::Runtime &completion) {
                        if (generation != gGenerations.generation())
                        {
                            return;
                        }
                        std::optional<jsi::Object> pair = takePending(completion, identifier);
                        if (pair)
                        {
                            settlePending(completion, *pair, failure, result);
                        }
                    });
            }).detach();

            return jsi::Value::undefined();
        });

    jsi::Function constructor = global.getPropertyAsFunction(runtime, "Promise");
    return constructor.callAsConstructor(runtime, std::move(executorFunction));
}

void executeRuntimeAsynchronously(std::function<void(jsi::Runtime &)> callback)
{
    auto target = executor();
    if (!target)
    {
        return;
    }

    jsi::Runtime *expected   = currentRuntime();
    uint64_t      generation = gGenerations.generation();
    AddonSlot     addon      = currentAddon();
    target->runOnRuntime(
        [callback = std::move(callback), expected, generation, addon](jsi::Runtime &runtime) {
            if (expected != &runtime || generation != gGenerations.generation())
            {
                return;
            }
            AddonScope scope(addon);
            try
            {
                callback(runtime);
            }
            catch (const std::exception &error)
            {
                log(LogLevel::Error, LOG_CATEGORY_PLUGINS,
                    threading::callbackFailureMessage(addon, error.what()));
            }
            catch (...)
            {
                log(LogLevel::Error, LOG_CATEGORY_PLUGINS,
                    threading::callbackFailureMessage(addon, "an unknown error"));
            }
        });
}

void executeRuntimeCoalesced(std::string key, std::function<void(jsi::Runtime &)> callback)
{
    auto target = executor();
    if (!target)
    {
        return;
    }

    jsi::Runtime *expected   = currentRuntime();
    uint64_t      generation = gGenerations.generation();
    AddonSlot     addon      = currentAddon();
    key = std::to_string(reinterpret_cast<uintptr_t>(expected)) + ":" + std::to_string(generation) +
          ":" + std::to_string(addon) + ":" + key;
    target->runOnRuntimeCoalesced(std::move(key), [callback = std::move(callback), expected,
                                                   generation, addon](jsi::Runtime &runtime) {
        if (expected != &runtime || generation != gGenerations.generation())
        {
            return;
        }
        AddonScope scope(addon);
        try
        {
            callback(runtime);
        }
        catch (const std::exception &error)
        {
            log(LogLevel::Error, LOG_CATEGORY_PLUGINS,
                threading::callbackFailureMessage(addon, error.what()));
        }
        catch (...)
        {
            log(LogLevel::Error, LOG_CATEGORY_PLUGINS,
                threading::callbackFailureMessage(addon, "an unknown error"));
        }
    });
}

bool executeRuntimeSynchronously(std::function<void(jsi::Runtime &)> callback,
                                 std::chrono::milliseconds           timeout)
{
    jsi::Runtime *expected = currentRuntime();
    if (expected && isRuntimeThread())
    {
        callback(*expected);
        return true;
    }

    auto target = executor();
    if (!target || !expected)
    {
        return false;
    }

    bool mainThread = target->isMainThread();
    if (mainThread && gMainThreadRuntimeStall.stalled())
    {
        return false;
    }

    struct State {
        std::mutex              mutex;
        std::condition_variable done;
        bool                    signaled  = false;
        bool                    completed = false;
        std::atomic_bool        cancelled{false};
        std::exception_ptr      failure;
    };

    auto      state      = std::make_shared<State>();
    uint64_t  generation = gGenerations.generation();
    AddonSlot addon      = currentAddon();
    target->runOnRuntimeCritical([state, callback = std::move(callback), expected, generation,
                                  addon](jsi::Runtime &runtime) {
        gMainThreadRuntimeStall.answered();
        bool               completed = false;
        std::exception_ptr failure;
        if (!state->cancelled.load() && expected == &runtime &&
            generation == gGenerations.generation())
        {
            try
            {
                AddonScope scope(addon);
                callback(runtime);
                completed = true;
            }
            catch (...)
            {
                failure = std::current_exception();
            }
        }
        std::lock_guard<std::mutex> lock(state->mutex);
        state->completed = completed;
        state->failure   = failure;
        state->signaled  = true;
        state->done.notify_all();
    });

    bool signaled = false;
    {
        std::optional<MainThreadRuntimeWait> waiting;
        if (mainThread)
        {
            waiting.emplace();
        }
        std::unique_lock<std::mutex> lock(state->mutex);
        signaled = state->done.wait_for(lock, timeout, [&] {
            return state->signaled;
        });
    }
    if (!signaled)
    {
        state->cancelled.store(true);
        if (mainThread)
        {
            gMainThreadRuntimeStall.timedOut();
        }
        return false;
    }

    if (state->failure)
    {
        std::rethrow_exception(state->failure);
    }
    return state->completed;
}
}
