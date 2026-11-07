#include "NativePluginRuntime.h"

#include <algorithm>
#include <atomic>
#include <condition_variable>
#include <cstdint>
#include <cstring>
#include <exception>
#include <jsi/instrumentation.h>
#include <mutex>
#include <string_view>
#include <thread>

#include "LoaderAddonActivity.h"
#include "LoaderBootstrap.h"
#include "LoaderLog.h"
#include "LoaderThreadWarnings.h"
#include "NativeCallActivity.h"
#include "NativeOperationGate.h"
#include "NativePlatformBridge.h"
#include "RuntimeStallGate.h"

namespace loader::native {
namespace jsi = facebook::jsi;

static constexpr const char *kPendingInvocations = "__NativePluginPendingInvocations";

static std::mutex                            gStateMutex;
static std::shared_ptr<NativePluginExecutor> gExecutor;
static jsi::Runtime                         *gRuntime = nullptr;
static std::thread::id                       gRuntimeThread;
static RuntimeGenerationTracker              gGenerations;
#if defined(__ANDROID__)
static std::atomic<NativeErrorDelivery> gErrorDelivery{NativeErrorDelivery::Envelope};
#else
static std::atomic<NativeErrorDelivery> gErrorDelivery{NativeErrorDelivery::Throw};
#endif
static std::atomic_uint64_t    gNextInvocation{1};
static std::atomic_uint        gMainThreadRuntimeWaits{0};
static RuntimeStallGate        gMainThreadRuntimeStall;
static std::mutex              gCrossingMutex;
static std::condition_variable gCrossingChanged;

enum class MainWorkKind : uint32_t
{
    Synchronous,
    Posted,
    Asynchronous,
};

static const char *mainWorkKindName(uint32_t kind)
{
    switch (static_cast<MainWorkKind>(kind))
    {
        case MainWorkKind::Synchronous:
            return "sync";
        case MainWorkKind::Posted:
            return "posted";
        case MainWorkKind::Asynchronous:
            return "async";
    }
    return "unknown";
}

struct MainWaitRecord {
    std::atomic_uint64_t key{0};
    std::atomic_bool     ready{false};
    AddonSlot            addon                      = kNoAddon;
    uint32_t             kind                       = 0;
    char                 label[kMainWaitLabelLimit] = {};
    std::atomic_uint64_t posted{0};
    std::atomic_uint64_t started{0};
    std::atomic_uint64_t finished{0};
    std::atomic_uint64_t expired{0};
    std::atomic_uint64_t queuedNanos{0};
    std::atomic_uint64_t maxQueuedNanos{0};
    std::atomic_uint64_t runNanos{0};
    std::atomic_uint64_t maxRunNanos{0};
};

static MainWaitRecord gMainWaits[kMainWaitRecordLimit];
static MainWaitRecord gOverflowMainWaits;

static std::atomic_uint64_t gMainDrains{0};
static std::atomic_uint64_t gMainDrainedItems{0};
static std::atomic_uint64_t gMainDrainNanos{0};
static std::atomic_uint64_t gMaxMainDrainNanos{0};
static std::atomic_uint64_t gMaxMainDrainItems{0};

static uint64_t monotonicNanos()
{
    return static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::nanoseconds>(
                                     std::chrono::steady_clock::now().time_since_epoch())
                                     .count());
}

static void raiseTo(std::atomic_uint64_t &maximum, uint64_t value)
{
    uint64_t current = maximum.load(std::memory_order_relaxed);
    while (value > current &&
           !maximum.compare_exchange_weak(current, value, std::memory_order_relaxed))
    {
    }
}

static uint64_t mainWaitKey(AddonSlot addon, MainWorkKind kind, std::string_view label)
{
    uint64_t hash = 14695981039346656037ull;
    auto     mix  = [&hash](uint64_t value) {
        hash ^= value;
        hash *= 1099511628211ull;
    };
    mix(addon);
    mix(static_cast<uint64_t>(kind));
    for (char character : label)
    {
        mix(static_cast<unsigned char>(character));
    }
    return hash == 0 ? 1 : hash;
}

static std::string_view boundedLabel(std::string_view label)
{
    return label.substr(0, kMainWaitLabelLimit - 1);
}

static MainWaitRecord &mainWaitRecord(AddonSlot addon, MainWorkKind kind, std::string_view label)
{
    label        = boundedLabel(label);
    uint64_t key = mainWaitKey(addon, kind, label);
    for (size_t probe = 0; probe < kMainWaitRecordLimit; probe++)
    {
        MainWaitRecord &record   = gMainWaits[(key + probe) % kMainWaitRecordLimit];
        uint64_t        existing = record.key.load(std::memory_order_acquire);
        if (existing == key)
        {
            return record;
        }
        if (existing != 0)
        {
            continue;
        }
        if (record.key.compare_exchange_strong(existing, key, std::memory_order_acq_rel))
        {
            record.addon = addon;
            record.kind  = static_cast<uint32_t>(kind);
            std::memcpy(record.label, label.data(), label.size());
            record.label[label.size()] = '\0';
            record.ready.store(true, std::memory_order_release);
            return record;
        }
        if (existing == key)
        {
            return record;
        }
    }
    return gOverflowMainWaits;
}

struct CachedMainWaitRecord {
    MainWaitRecord *record   = nullptr;
    uint32_t        sequence = 0;
    AddonSlot       addon    = kNoAddon;
    MainWorkKind    kind     = MainWorkKind::Synchronous;
};

static thread_local CachedMainWaitRecord tCachedMainWait;

static MainWaitRecord &currentCallRecord(AddonSlot addon, MainWorkKind kind)
{
    CurrentNativeCall     call   = currentNativeCall();
    CachedMainWaitRecord &cached = tCachedMainWait;
    if (cached.record && cached.sequence == call.sequence && cached.addon == addon &&
        cached.kind == kind)
    {
        return *cached.record;
    }
    MainWaitRecord &record = mainWaitRecord(addon, kind, call.label);
    cached                 = {&record, call.sequence, addon, kind};
    return record;
}

class MainWaitTiming
{
public:
    explicit MainWaitTiming(MainWaitRecord &record) : record_(&record), postedAt_(monotonicNanos())
    {
        record_->posted.fetch_add(1, std::memory_order_relaxed);
    }

    uint64_t started() const
    {
        uint64_t now    = monotonicNanos();
        uint64_t queued = now > postedAt_ ? now - postedAt_ : 0;
        record_->started.fetch_add(1, std::memory_order_relaxed);
        record_->queuedNanos.fetch_add(queued, std::memory_order_relaxed);
        raiseTo(record_->maxQueuedNanos, queued);
        return now;
    }

    void finished(uint64_t startedAt) const
    {
        uint64_t now = monotonicNanos();
        uint64_t ran = now > startedAt ? now - startedAt : 0;
        record_->finished.fetch_add(1, std::memory_order_relaxed);
        record_->runNanos.fetch_add(ran, std::memory_order_relaxed);
        raiseTo(record_->maxRunNanos, ran);
    }

    void expired() const
    {
        record_->expired.fetch_add(1, std::memory_order_relaxed);
    }

private:
    MainWaitRecord *record_;
    uint64_t        postedAt_;
};

static double milliseconds(uint64_t nanos)
{
    return static_cast<double>(nanos) / 1e6;
}

static nlohmann::json describeMainWaits(const MainWaitRecord &record, const std::string &label,
                                        const std::string &addon, const char *kind)
{
    return {{"addon", addon},
            {"kind", kind},
            {"label", label},
            {"posted", record.posted.load(std::memory_order_relaxed)},
            {"started", record.started.load(std::memory_order_relaxed)},
            {"finished", record.finished.load(std::memory_order_relaxed)},
            {"expired", record.expired.load(std::memory_order_relaxed)},
            {"queuedMs", milliseconds(record.queuedNanos.load(std::memory_order_relaxed))},
            {"maxQueuedMs", milliseconds(record.maxQueuedNanos.load(std::memory_order_relaxed))},
            {"runMs", milliseconds(record.runNanos.load(std::memory_order_relaxed))},
            {"maxRunMs", milliseconds(record.maxRunNanos.load(std::memory_order_relaxed))}};
}

static void resetMainWaits(MainWaitRecord &record)
{
    record.posted.store(0, std::memory_order_relaxed);
    record.started.store(0, std::memory_order_relaxed);
    record.finished.store(0, std::memory_order_relaxed);
    record.expired.store(0, std::memory_order_relaxed);
    record.queuedNanos.store(0, std::memory_order_relaxed);
    record.maxQueuedNanos.store(0, std::memory_order_relaxed);
    record.runNanos.store(0, std::memory_order_relaxed);
    record.maxRunNanos.store(0, std::memory_order_relaxed);
}

void recordMainDrain(size_t items, std::chrono::nanoseconds duration)
{
    uint64_t nanos = duration.count() > 0 ? static_cast<uint64_t>(duration.count()) : 0;
    gMainDrains.fetch_add(1, std::memory_order_relaxed);
    gMainDrainedItems.fetch_add(items, std::memory_order_relaxed);
    gMainDrainNanos.fetch_add(nanos, std::memory_order_relaxed);
    raiseTo(gMaxMainDrainNanos, nanos);
    raiseTo(gMaxMainDrainItems, items);
}

nlohmann::json mainWorkCounts()
{
    return {{"drains", gMainDrains.load(std::memory_order_relaxed)},
            {"items", gMainDrainedItems.load(std::memory_order_relaxed)},
            {"drainMs", milliseconds(gMainDrainNanos.load(std::memory_order_relaxed))},
            {"maxDrainMs", milliseconds(gMaxMainDrainNanos.load(std::memory_order_relaxed))},
            {"maxDrainItems", gMaxMainDrainItems.load(std::memory_order_relaxed)}};
}

nlohmann::json mainWaitCounts()
{
    nlohmann::json waits = nlohmann::json::array();
    for (const MainWaitRecord &record : gMainWaits)
    {
        if (!record.ready.load(std::memory_order_acquire) ||
            record.posted.load(std::memory_order_relaxed) == 0)
        {
            continue;
        }
        waits.push_back(describeMainWaits(record, record.label, threading::addonName(record.addon),
                                          mainWorkKindName(record.kind)));
    }
    if (gOverflowMainWaits.posted.load(std::memory_order_relaxed) > 0)
    {
        waits.push_back(describeMainWaits(gOverflowMainWaits, "(other)", "(other)", "unknown"));
    }
    std::sort(waits.begin(), waits.end(),
              [](const nlohmann::json &left, const nlohmann::json &right) {
                  return left["queuedMs"].get<double>() + left["runMs"].get<double>() >
                         right["queuedMs"].get<double>() + right["runMs"].get<double>();
              });
    return waits;
}

void resetMainWorkCounts()
{
    for (MainWaitRecord &record : gMainWaits)
    {
        resetMainWaits(record);
    }
    resetMainWaits(gOverflowMainWaits);
    gMainDrains.store(0, std::memory_order_relaxed);
    gMainDrainedItems.store(0, std::memory_order_relaxed);
    gMainDrainNanos.store(0, std::memory_order_relaxed);
    gMaxMainDrainNanos.store(0, std::memory_order_relaxed);
    gMaxMainDrainItems.store(0, std::memory_order_relaxed);
}

static std::mutex            gUIGarbageCollectorMutex;
static std::function<bool()> gUIGarbageCollector;

void setUIRuntimeGarbageCollector(std::function<bool()> collector)
{
    std::lock_guard<std::mutex> lock(gUIGarbageCollectorMutex);
    gUIGarbageCollector = std::move(collector);
}

static bool collectUIRuntimeGarbage()
{
    std::function<bool()> collector;
    {
        std::lock_guard<std::mutex> lock(gUIGarbageCollectorMutex);
        collector = gUIGarbageCollector;
    }
    if (!collector)
    {
        return false;
    }
    try
    {
        return collector();
    }
    catch (const std::exception &error)
    {
        log(LogLevel::Error, LOG_CATEGORY_PLUGINS,
            std::string("Collecting UI runtime garbage failed: ") + error.what());
    }
    catch (...)
    {
        log(LogLevel::Error, LOG_CATEGORY_PLUGINS, "Collecting UI runtime garbage failed");
    }
    return false;
}

static nlohmann::json collectGarbage(const std::function<void()> &collectRuntime)
{
    collectRuntime();
    return {{"runtime", true}, {"uiRuntime", collectUIRuntimeGarbage()}};
}

nlohmann::json collectGarbage(jsi::Runtime &runtime)
{
    return collectGarbage([&runtime] {
        runtime.instrumentation().collectGarbage("unbound debug");
    });
}

nlohmann::json debugEnvironmentSnapshot(const DebugEnvironmentOptions &options,
                                        const std::function<void()>   &collectRuntime)
{
    std::optional<nlohmann::json> collected;
    if (options.collectGarbage)
    {
        collected = collectGarbage(collectRuntime);
    }
    nlohmann::json environment = currentDebugEnvironment();
    if (collected)
    {
        environment["garbageCollection"] = std::move(*collected);
    }
    if (options.resetCounters)
    {
        resetMainWorkCounts();
    }
    return environment;
}

static bool optionEnabled(jsi::Runtime &runtime, const jsi::Object &options, const char *name)
{
    jsi::Value value = options.getProperty(runtime, name);
    return value.isBool() && value.getBool();
}

jsi::Value readDebugEnvironment(jsi::Runtime &runtime, const jsi::Value *args, size_t count)
{
    DebugEnvironmentOptions options;
    if (count > 0 && args[0].isObject())
    {
        jsi::Object requested  = args[0].asObject(runtime);
        options.collectGarbage = optionEnabled(runtime, requested, "collectGarbage");
        options.resetCounters  = optionEnabled(runtime, requested, "resetCounters");
    }
    return toJSIValue(runtime, debugEnvironmentSnapshot(options, [&runtime] {
                          runtime.instrumentation().collectGarbage("unbound debug");
                      }));
}

NativeCodedError::NativeCodedError(std::string code, const std::string &message)
    : std::runtime_error(message), code_(std::move(code))
{
}

const std::string &NativeCodedError::code() const
{
    return code_;
}

NativeFailure describeFailure(std::exception_ptr failure)
{
    try
    {
        if (failure)
        {
            std::rethrow_exception(failure);
        }
    }
    catch (const NativeCodedError &error)
    {
        return {error.code(), error.what()};
    }
    catch (const std::exception &error)
    {
        std::string message = error.what();
        return {kNativeBridgeErrorCode, message.empty() ? "Native operation failed" : message};
    }
    catch (...)
    {
    }
    return {kNativeBridgeErrorCode, "Native operation failed"};
}

NativeErrorDelivery nativeErrorDelivery()
{
    return gErrorDelivery.load();
}

void setNativeErrorDelivery(NativeErrorDelivery delivery)
{
    gErrorDelivery.store(delivery);
}

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

jsi::Object makeError(jsi::Runtime &runtime, const char *code, const std::string &message)
{
    jsi::Function constructor = runtime.global().getPropertyAsFunction(runtime, "Error");
    jsi::Object   error =
        constructor.callAsConstructor(runtime, jsi::String::createFromUtf8(runtime, message))
            .asObject(runtime);
    error.setProperty(runtime, "code", jsi::String::createFromUtf8(runtime, code));
    return error;
}

void throwCoded(jsi::Runtime &runtime, const char *code, const std::string &message)
{
    jsi::JSError failure(runtime, message);
    failure.value().asObject(runtime).setProperty(runtime, "code",
                                                  jsi::String::createFromUtf8(runtime, code));
    throw failure;
}

static void attachDefaultCode(jsi::Runtime &runtime, const jsi::JSError &error)
{
    const jsi::Value &value = error.value();
    if (!value.isObject())
    {
        return;
    }

    jsi::Object object = value.asObject(runtime);
    if (object.getProperty(runtime, "code").isString())
    {
        return;
    }

    object.setProperty(runtime, "code",
                       jsi::String::createFromUtf8(runtime, kNativeBridgeErrorCode));
}

static NativeFailure describeJSError(jsi::Runtime &runtime, const jsi::JSError &error)
{
    NativeFailure failure{kNativeBridgeErrorCode, error.getMessage()};
    try
    {
        const jsi::Value &value = error.value();
        if (value.isObject())
        {
            jsi::Value code = value.asObject(runtime).getProperty(runtime, "code");
            if (code.isString())
            {
                failure.code = code.getString(runtime).utf8(runtime);
            }
        }
    }
    catch (...)
    {
    }
    return failure;
}

static jsi::Value failureEnvelope(jsi::Runtime &runtime, const NativeFailure &failure)
{
    jsi::Object details(runtime);
    details.setProperty(runtime, "code", jsi::String::createFromUtf8(runtime, failure.code));
    details.setProperty(runtime, "message", jsi::String::createFromUtf8(runtime, failure.message));
    jsi::Object envelope(runtime);
    envelope.setProperty(runtime, kNativeFailureEnvelopeKey, std::move(details));
    return envelope;
}

static jsi::Value throwingGuard(jsi::Runtime &runtime, const std::function<jsi::Value()> &body)
{
    try
    {
        return body();
    }
    catch (const jsi::JSError &error)
    {
        attachDefaultCode(runtime, error);
        throw;
    }
    catch (...)
    {
        NativeFailure failure = describeFailure(std::current_exception());
        throwCoded(runtime, failure.code.c_str(), failure.message);
    }
}

static jsi::Value envelopingGuard(jsi::Runtime &runtime, const std::function<jsi::Value()> &body)
{
    try
    {
        return body();
    }
    catch (const jsi::JSError &error)
    {
        return failureEnvelope(runtime, describeJSError(runtime, error));
    }
    catch (const std::exception &)
    {
        return failureEnvelope(runtime, describeFailure(std::current_exception()));
    }
}

jsi::Value guard(jsi::Runtime &runtime, const std::function<jsi::Value()> &body)
{
    if (nativeErrorDelivery() == NativeErrorDelivery::Envelope)
    {
        return envelopingGuard(runtime, body);
    }
    return throwingGuard(runtime, body);
}

static std::optional<jsi::Function> failureGuard(jsi::Runtime &runtime)
{
    jsi::Value existing = runtime.global().getProperty(runtime, kNativeFailureGuardName);
    if (existing.isObject() && existing.asObject(runtime).isFunction(runtime))
    {
        return existing.asObject(runtime).asFunction(runtime);
    }
    jsi::Value created = bootstrap::evaluate(runtime, bootstrap::kNativeFailureGuard);
    if (!created.isObject() || !created.asObject(runtime).isFunction(runtime))
    {
        return std::nullopt;
    }
    return created.asObject(runtime).asFunction(runtime);
}

static constexpr size_t kLabelledArguments  = 3;
static constexpr size_t kArgumentLabelLimit = 64;

static std::string firstStringArgument(jsi::Runtime &runtime, const jsi::Value *args, size_t count)
{
    for (size_t index = 0; index < count && index < kLabelledArguments; index++)
    {
        if (args[index].isString())
        {
            std::string text = args[index].getString(runtime).utf8(runtime);
            return text.size() > kArgumentLabelLimit ? text.substr(0, kArgumentLabelLimit) : text;
        }
    }
    return {};
}

jsi::Function makeFunction(jsi::Runtime &runtime, const char *name, unsigned int argumentCount,
                           jsi::HostFunctionType handler)
{
    jsi::HostFunctionType guarded = [handler = std::move(handler), label = std::string(name)](
                                        jsi::Runtime &rt, const jsi::Value &thisValue,
                                        const jsi::Value *args, size_t count) -> jsi::Value {
        NativeCallScope scope(label, firstStringArgument(rt, args, count));
        return guard(rt, [&]() {
            return handler(rt, thisValue, args, count);
        });
    };

    jsi::Function native = jsi::Function::createFromHostFunction(
        runtime, jsi::PropNameID::forUtf8(runtime, name), argumentCount, std::move(guarded));
    if (nativeErrorDelivery() == NativeErrorDelivery::Throw)
    {
        return native;
    }
    auto wrap = failureGuard(runtime);
    if (!wrap)
    {
        return native;
    }
    return wrap->call(runtime, std::move(native)).asObject(runtime).asFunction(runtime);
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
                target->runOnMainNextFrame(std::move(runOperation));
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
