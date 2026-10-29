#include "NativePluginRuntime.h"

#include <atomic>
#include <condition_variable>
#include <exception>
#include <mutex>
#include <thread>

#include "LoaderAddonActivity.h"
#include "LoaderBootstrap.h"
#include "LoaderLog.h"
#include "NativeCallActivity.h"
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
#if defined(__ANDROID__)
static std::atomic<NativeErrorDelivery> gErrorDelivery{NativeErrorDelivery::Envelope};
#else
static std::atomic<NativeErrorDelivery> gErrorDelivery{NativeErrorDelivery::Throw};
#endif
static std::atomic_uint64_t gNextInvocation{1};
static std::atomic_uint     gMainThreadRuntimeWaits{0};
static RuntimeStallGate     gMainThreadRuntimeStall;

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

void executeMainSynchronously(std::function<void()> operation, std::chrono::milliseconds timeout)
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

    struct State {
        std::mutex              mutex;
        std::condition_variable done;
        bool                    finished = false;
        std::exception_ptr      failure;
        NativeOperationGate     gate;
    };

    auto      state = std::make_shared<State>();
    AddonSlot addon = currentAddon();
    target->runOnMain([state, operation = std::move(operation), addon]() {
        if (!state->gate.start())
        {
            return;
        }
        try
        {
            AddonScope scope(addon);
            operation();
        }
        catch (...)
        {
            state->failure = std::current_exception();
        }
        state->gate.finish();
        std::lock_guard<std::mutex> lock(state->mutex);
        state->finished = true;
        state->done.notify_all();
    });

    std::unique_lock<std::mutex> lock(state->mutex);
    if (!state->done.wait_for(lock, timeout, [&] {
            return state->finished;
        }))
    {
        if (state->gate.expire())
        {
            throw NativeCodedError("NATIVE_MAIN_THREAD_TIMEOUT",
                                   "Native operation timed out before reaching the main thread");
        }
        state->done.wait(lock, [&] {
            return state->finished;
        });
    }

    if (state->failure)
    {
        std::rethrow_exception(state->failure);
    }
}

static void rejectPending(jsi::Runtime &runtime, const std::string &identifier, const char *code,
                          const std::string &message)
{
    jsi::Value pendingValue = runtime.global().getProperty(runtime, kPendingInvocations);
    if (!pendingValue.isObject())
    {
        return;
    }

    jsi::Object pending   = pendingValue.asObject(runtime);
    jsi::Value  pairValue = pending.getProperty(runtime, identifier.c_str());
    if (!pairValue.isObject())
    {
        return;
    }

    jsi::Object pair = pairValue.asObject(runtime);
    pending.deleteProperty(runtime, identifier.c_str());
    pair.getPropertyAsFunction(runtime, "reject").call(runtime, makeError(runtime, code, message));
}

jsi::Value executeMainAsynchronously(jsi::Runtime &runtime, std::function<void()> operation,
                                     std::function<jsi::Value(jsi::Runtime &)> result)
{
    auto target = executor();
    if (!target)
    {
        throwCoded(runtime, "NATIVE_PLUGIN_UNAVAILABLE", "Native executor is unavailable");
    }

    uint64_t    generation = gGenerations.generation();
    std::string identifier = std::to_string(gNextInvocation.fetch_add(1));
    auto        cancelled  = std::make_shared<std::atomic_bool>(false);
    auto        gate       = std::make_shared<NativeOperationGate>();
    AddonSlot   addon      = currentAddon();

    jsi::Object global       = runtime.global();
    jsi::Value  pendingValue = global.getProperty(runtime, kPendingInvocations);
    if (!pendingValue.isObject())
    {
        global.setProperty(runtime, kPendingInvocations, jsi::Object(runtime));
    }

    jsi::Function executorFunction = makeFunction(
        runtime, "nativeMainExecutor", 2,
        [target, operation = std::move(operation), result = std::move(result), identifier,
         cancelled, gate, generation,
         addon](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *callbacks,
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

            target->runOnMain([operation, result, identifier, cancelled, gate, generation,
                               addon]() {
                if (cancelled->load() || !gate->start() || generation != gGenerations.generation())
                {
                    return;
                }

                AddonScope                   scope(addon);
                std::optional<NativeFailure> failure;
                try
                {
                    operation();
                }
                catch (...)
                {
                    failure = describeFailure(std::current_exception());
                }
                gate->finish();

                executeRuntimeAsynchronously([identifier, cancelled, generation, result,
                                              failure](jsi::Runtime &completion) {
                    if (generation != gGenerations.generation())
                    {
                        return;
                    }

                    jsi::Object pending =
                        completion.global().getPropertyAsObject(completion, kPendingInvocations);
                    jsi::Value pairValue = pending.getProperty(completion, identifier.c_str());
                    if (!pairValue.isObject())
                    {
                        return;
                    }

                    jsi::Object pair = pairValue.asObject(completion);
                    pending.deleteProperty(completion, identifier.c_str());
                    if (cancelled->load())
                    {
                        return;
                    }

                    jsi::Function reject = pair.getPropertyAsFunction(completion, "reject");
                    if (failure)
                    {
                        reject.call(completion,
                                    makeError(completion, failure->code.c_str(), failure->message));
                        return;
                    }
                    try
                    {
                        jsi::Value value = result(completion);
                        pair.getPropertyAsFunction(completion, "resolve").call(completion, value);
                    }
                    catch (const jsi::JSError &error)
                    {
                        attachDefaultCode(completion, error);
                        reject.call(completion, error.value());
                    }
                    catch (...)
                    {
                        NativeFailure described = describeFailure(std::current_exception());
                        reject.call(completion, makeError(completion, described.code.c_str(),
                                                          described.message));
                    }
                });
            });

            target->runAfter(1.0, [identifier, cancelled, gate, generation]() {
                if (!gate->expire())
                {
                    return;
                }
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
                    std::string("Native plugin callback failed: ") + error.what());
            }
            catch (...)
            {
                log(LogLevel::Error, LOG_CATEGORY_PLUGINS, "Native plugin callback failed");
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
    target->runOnRuntime([state, callback = std::move(callback), expected, generation,
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

    if (mainThread)
    {
        gMainThreadRuntimeWaits.fetch_add(1);
    }
    std::unique_lock<std::mutex> lock(state->mutex);
    bool                         signaled = state->done.wait_for(lock, timeout, [&] {
        return state->signaled;
    });
    if (mainThread)
    {
        gMainThreadRuntimeWaits.fetch_sub(1);
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
