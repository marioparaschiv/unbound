#pragma once

#include <atomic>
#include <chrono>
#include <exception>
#include <functional>
#include <jsi/jsi.h>
#include <memory>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>

namespace loader::native {
class NativePluginExecutor
{
public:
    virtual ~NativePluginExecutor() = default;

    virtual bool isMainThread()                                                   = 0;
    virtual void runOnMain(std::function<void()> work)                            = 0;
    virtual void runOnRuntime(std::function<void(facebook::jsi::Runtime &)> work) = 0;
    virtual void runAfter(double seconds, std::function<void()> work)             = 0;
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

inline constexpr const char *kNativeFailureEnvelopeKey = "__astralNativeFailure";
inline constexpr const char *kNativeFailureGuardName   = "__astralGuardNativeFunction";

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

facebook::jsi::Value
executeMainAsynchronously(facebook::jsi::Runtime &runtime, std::function<void()> operation,
                          std::function<facebook::jsi::Value(facebook::jsi::Runtime &)> result);

void executeRuntimeAsynchronously(std::function<void(facebook::jsi::Runtime &)> callback);
bool executeRuntimeSynchronously(
    std::function<void(facebook::jsi::Runtime &)> callback,
    std::chrono::milliseconds                     timeout = std::chrono::milliseconds(100));
}
