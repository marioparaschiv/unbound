#pragma once

#include <atomic>
#include <chrono>
#include <exception>
#include <functional>
#include <jsi/jsi.h>
#include <memory>
#include <mutex>
#include <nlohmann/json.hpp>
#include <optional>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

#include "LoaderAddonActivity.h"

namespace loader::native {
class NativePluginExecutor
{
public:
    virtual ~NativePluginExecutor() = default;

    virtual bool isMainThread()                        = 0;
    virtual void runOnMain(std::function<void()> work) = 0;
    virtual void runOnMainNextFrame(std::function<void()> work)
    {
        runOnMain(std::move(work));
    }
    virtual void runOnRuntime(std::function<void(facebook::jsi::Runtime &)> work) = 0;
    virtual void runOnRuntimeCoalesced(std::string                                   key,
                                       std::function<void(facebook::jsi::Runtime &)> work)
    {
        (void) key;
        runOnRuntime(std::move(work));
    }
    virtual void runOnRuntimeCritical(std::function<void(facebook::jsi::Runtime &)> work)
    {
        runOnRuntime(std::move(work));
    }
    virtual void runAfter(double seconds, std::function<void()> work) = 0;
};

class NativeCodedError : public std::runtime_error
{
public:
    NativeCodedError(std::string code, const std::string &message);

    const std::string &code() const;

private:
    std::string code_;
};

inline constexpr const char *kNativeBridgeErrorCode = "NATIVE_BRIDGE_ERROR";

struct NativeFailure {
    std::string code;
    std::string message;
};

NativeFailure describeFailure(std::exception_ptr failure);

enum class NativeErrorDelivery
{
    Throw,
    Envelope,
};

inline constexpr const char *kNativeFailureEnvelopeKey = "__unboundNativeFailure";
inline constexpr const char *kNativeFailureGuardName   = "__unboundGuardNativeFunction";

NativeErrorDelivery nativeErrorDelivery();
void                setNativeErrorDelivery(NativeErrorDelivery delivery);

using RuntimeGenerationListener = std::function<void(uint64_t generation)>;

class RuntimeGenerationTracker
{
public:
    std::optional<uint64_t> advance(const void *runtime, bool alreadyRegistered = true);
    uint64_t                generation() const;
    void                    addListener(RuntimeGenerationListener listener);
    void                    notify(uint64_t generation) const;

private:
    const void                            *runtime_ = nullptr;
    std::atomic_uint64_t                   generation_{0};
    mutable std::mutex                     listenersMutex_;
    std::vector<RuntimeGenerationListener> listeners_;
};

void                                  setExecutor(std::shared_ptr<NativePluginExecutor> executor);
std::shared_ptr<NativePluginExecutor> executor();

uint64_t registerRuntime(facebook::jsi::Runtime &runtime);
uint64_t runtimeGeneration();
void     onRuntimeGenerationChanged(RuntimeGenerationListener listener);
bool     isRuntimeThread();
bool     mainThreadIsWaitingForRuntime();

class MainThreadRuntimeWait
{
public:
    MainThreadRuntimeWait();
    ~MainThreadRuntimeWait();

    MainThreadRuntimeWait(const MainThreadRuntimeWait &)            = delete;
    MainThreadRuntimeWait &operator=(const MainThreadRuntimeWait &) = delete;
};

facebook::jsi::Function makeFunction(facebook::jsi::Runtime &runtime, const char *name,
                                     unsigned int                    argumentCount,
                                     facebook::jsi::HostFunctionType handler);

facebook::jsi::Value guard(facebook::jsi::Runtime                      &runtime,
                           const std::function<facebook::jsi::Value()> &body);

[[noreturn]] void     throwCoded(facebook::jsi::Runtime &runtime, const char *code,
                                 const std::string &message);
facebook::jsi::Object makeError(facebook::jsi::Runtime &runtime, const char *code,
                                const std::string &message);

void executeMainSynchronously(std::function<void()>     operation,
                              std::chrono::milliseconds timeout = std::chrono::seconds(1));
void executeMainSynchronouslyUnlessMainWaits(
    std::function<void()> operation, std::chrono::milliseconds timeout = std::chrono::seconds(1));
void        postMainOperation(std::function<void()> operation, std::string description);
std::string postedMainFailureMessage(AddonSlot addon, const std::string &description,
                                     const std::string &reason);

inline constexpr const char *kMainWaitsForRuntimeMessage =
    "Native call cannot synchronously cross to a main thread that is waiting for JavaScript";

facebook::jsi::Value
executeMainAsynchronously(facebook::jsi::Runtime &runtime, std::function<void()> operation,
                          std::function<facebook::jsi::Value(facebook::jsi::Runtime &)> result,
                          bool nextFrame = false);

// Runs `operation` on its own thread, then settles the returned promise on the runtime thread with
// `result`, or rejects it with what `operation` threw.
facebook::jsi::Value executeBackgroundAsynchronously(
    facebook::jsi::Runtime &runtime, std::function<void()> operation,
    std::function<facebook::jsi::Value(facebook::jsi::Runtime &)> result);

void executeRuntimeAsynchronously(std::function<void(facebook::jsi::Runtime &)> callback);
void executeRuntimeCoalesced(std::string                                   key,
                             std::function<void(facebook::jsi::Runtime &)> callback);
bool runningAsynchronousMainOperation();
bool executeRuntimeSynchronously(
    std::function<void(facebook::jsi::Runtime &)> callback,
    std::chrono::milliseconds                     timeout = std::chrono::milliseconds(100));

inline constexpr size_t kMainWaitRecordLimit = 256;
inline constexpr size_t kMainWaitLabelLimit  = 64;

void           recordMainDrain(size_t items, std::chrono::nanoseconds duration);
nlohmann::json mainWorkCounts();
nlohmann::json mainWaitCounts();
void           resetMainWorkCounts();

struct DebugEnvironmentOptions {
    bool collectGarbage = false;
    bool resetCounters  = false;
};

void                 setUIRuntimeGarbageCollector(std::function<bool()> collector);
nlohmann::json       collectGarbage(facebook::jsi::Runtime &runtime);
nlohmann::json       debugEnvironmentSnapshot(const DebugEnvironmentOptions &options,
                                              const std::function<void()>   &collectRuntime);
facebook::jsi::Value readDebugEnvironment(facebook::jsi::Runtime     &runtime,
                                          const facebook::jsi::Value *args, size_t count);
}
