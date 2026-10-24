#include "NativePluginRuntime.h"

#include "LoaderLog.h"
#include "NativeOperationGate.h"

#include <atomic>
#include <condition_variable>
#include <exception>
#include <mutex>
#include <thread>

namespace loader::native
{
    namespace jsi = facebook::jsi;

    static constexpr const char *kPendingInvocations = "__NativePluginPendingInvocations";

    static std::mutex                            gStateMutex;
    static std::shared_ptr<NativePluginExecutor> gExecutor;
    static jsi::Runtime                         *gRuntime = nullptr;
    static std::thread::id                       gRuntimeThread;
    static std::atomic_uint64_t                  gGeneration{0};
    static std::atomic_uint64_t                  gNextInvocation{1};

    NativeCodedError::NativeCodedError(std::string code, const std::string &message)
        : std::runtime_error(message), code_(std::move(code))
    {
    }

    const std::string &NativeCodedError::code() const
    {
        return code_;
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

    uint64_t registerRuntime(jsi::Runtime &runtime)
    {
        std::lock_guard<std::mutex> lock(gStateMutex);
        if (gRuntime != &runtime)
        {
            gGeneration.fetch_add(1);
        }
        gRuntime       = &runtime;
        gRuntimeThread = std::this_thread::get_id();
        return gGeneration.load();
    }

    uint64_t runtimeGeneration()
    {
        return gGeneration.load();
    }

    bool isRuntimeThread()
    {
        std::lock_guard<std::mutex> lock(gStateMutex);
        return gRuntime && std::this_thread::get_id() == gRuntimeThread;
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

        object.setProperty(runtime, "code", jsi::String::createFromUtf8(runtime, "NATIVE_BRIDGE_ERROR"));
    }

    jsi::Function makeFunction(jsi::Runtime &runtime, const char *name, unsigned int argumentCount,
                               jsi::HostFunctionType handler)
    {
        jsi::HostFunctionType guarded = [handler = std::move(handler)](
                                            jsi::Runtime &rt, const jsi::Value &thisValue,
                                            const jsi::Value *args, size_t count) -> jsi::Value {
            try
            {
                return handler(rt, thisValue, args, count);
            }
            catch (const jsi::JSError &error)
            {
                attachDefaultCode(rt, error);
                throw;
            }
            catch (const NativeCodedError &error)
            {
                throwCoded(rt, error.code().c_str(), error.what());
            }
            catch (const std::exception &error)
            {
                throwCoded(rt, "NATIVE_BRIDGE_ERROR", error.what());
            }
            catch (...)
            {
                throwCoded(rt, "NATIVE_BRIDGE_ERROR", "Native bridge operation failed");
            }
        };

        return jsi::Function::createFromHostFunction(runtime, jsi::PropNameID::forUtf8(runtime, name),
                                                     argumentCount, std::move(guarded));
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

        struct State
        {
            std::mutex              mutex;
            std::condition_variable done;
            bool                    finished = false;
            std::exception_ptr      failure;
            NativeOperationGate     gate;
        };

        auto state = std::make_shared<State>();
        target->runOnMain([state, operation = std::move(operation)]() {
            if (!state->gate.start())
            {
                return;
            }
            try
            {
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
        if (!state->done.wait_for(lock, timeout, [&] { return state->finished; }))
        {
            if (state->gate.expire())
            {
                throw NativeCodedError("NATIVE_MAIN_THREAD_TIMEOUT",
                                       "Native operation timed out before reaching the main thread");
            }
            state->done.wait(lock, [&] { return state->finished; });
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

        uint64_t    generation = gGeneration.load();
        std::string identifier = std::to_string(gNextInvocation.fetch_add(1));
        auto        cancelled  = std::make_shared<std::atomic_bool>(false);
        auto        gate       = std::make_shared<NativeOperationGate>();

        jsi::Object global       = runtime.global();
        jsi::Value  pendingValue = global.getProperty(runtime, kPendingInvocations);
        if (!pendingValue.isObject())
        {
            global.setProperty(runtime, kPendingInvocations, jsi::Object(runtime));
        }

        jsi::Function executorFunction = jsi::Function::createFromHostFunction(
            runtime, jsi::PropNameID::forUtf8(runtime, "nativeMainExecutor"), 2,
            [target, operation = std::move(operation), result = std::move(result), identifier,
             cancelled, gate, generation](jsi::Runtime &rt, const jsi::Value &,
                                          const jsi::Value *callbacks, size_t count) -> jsi::Value {
                if (count < 2 || !callbacks[0].isObject() || !callbacks[1].isObject())
                {
                    throw jsi::JSError(rt, "Native asynchronous operation could not create its promise");
                }

                jsi::Object pair(rt);
                pair.setProperty(rt, "resolve", callbacks[0].asObject(rt));
                pair.setProperty(rt, "reject", callbacks[1].asObject(rt));
                rt.global()
                    .getPropertyAsObject(rt, kPendingInvocations)
                    .setProperty(rt, identifier.c_str(), pair);

                target->runOnMain([operation, result, identifier, cancelled, gate, generation]() {
                    if (cancelled->load() || !gate->start() || generation != gGeneration.load())
                    {
                        return;
                    }

                    std::string failure;
                    try
                    {
                        operation();
                    }
                    catch (const std::exception &error)
                    {
                        failure = error.what();
                        if (failure.empty())
                        {
                            failure = "Native operation failed";
                        }
                    }
                    catch (...)
                    {
                        failure = "Native operation failed";
                    }
                    gate->finish();

                    executeRuntimeAsynchronously([identifier, cancelled, generation, result,
                                                  failure](jsi::Runtime &completion) {
                        if (generation != gGeneration.load())
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

                        try
                        {
                            if (!failure.empty())
                            {
                                throw std::runtime_error(failure);
                            }
                            pair.getPropertyAsFunction(completion, "resolve")
                                .call(completion, result(completion));
                        }
                        catch (const std::exception &error)
                        {
                            pair.getPropertyAsFunction(completion, "reject")
                                .call(completion,
                                      makeError(completion, "NATIVE_BRIDGE_ERROR", error.what()));
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
                        if (generation != gGeneration.load())
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
            jsi::Function::createFromHostFunction(
                runtime, jsi::PropNameID::forUtf8(runtime, "cancel"), 0,
                [identifier, cancelled, gate](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *,
                                              size_t) -> jsi::Value {
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
        uint64_t      generation = gGeneration.load();
        target->runOnRuntime([callback = std::move(callback), expected, generation](jsi::Runtime &runtime) {
            if (expected != &runtime || generation != gGeneration.load())
            {
                return;
            }
            try
            {
                callback(runtime);
            }
            catch (const std::exception &error)
            {
                log(LogLevel::Error, "plugins", std::string("Native plugin callback failed: ") + error.what());
            }
        });
    }

    bool executeRuntimeSynchronously(std::function<void(jsi::Runtime &)> callback,
                                     std::chrono::milliseconds timeout)
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

        struct State
        {
            std::mutex              mutex;
            std::condition_variable done;
            bool                    signaled  = false;
            bool                    completed = false;
            std::atomic_bool        cancelled{false};
            std::exception_ptr      failure;
        };

        auto     state      = std::make_shared<State>();
        uint64_t generation = gGeneration.load();
        target->runOnRuntime([state, callback = std::move(callback), expected,
                              generation](jsi::Runtime &runtime) {
            bool completed = false;
            std::exception_ptr failure;
            if (!state->cancelled.load() && expected == &runtime && generation == gGeneration.load())
            {
                try
                {
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

        std::unique_lock<std::mutex> lock(state->mutex);
        if (!state->done.wait_for(lock, timeout, [&] { return state->signaled; }))
        {
            state->cancelled.store(true);
            return false;
        }

        if (state->failure)
        {
            std::rethrow_exception(state->failure);
        }
        return state->completed;
    }
}
