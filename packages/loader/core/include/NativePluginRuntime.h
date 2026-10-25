#pragma once

#include <chrono>
#include <functional>
#include <memory>
#include <stdexcept>
#include <string>

#include <jsi/jsi.h>

namespace loader::native
{
    class NativePluginExecutor
    {
    public:
        virtual ~NativePluginExecutor() = default;

        virtual bool isMainThread() = 0;
        virtual void runOnMain(std::function<void()> work) = 0;
        virtual void runOnRuntime(std::function<void(facebook::jsi::Runtime &)> work) = 0;
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

    void setExecutor(std::shared_ptr<NativePluginExecutor> executor);
    std::shared_ptr<NativePluginExecutor> executor();

    uint64_t registerRuntime(facebook::jsi::Runtime &runtime);
    uint64_t runtimeGeneration();
    bool isRuntimeThread();
    bool mainThreadIsWaitingForRuntime();

    facebook::jsi::Function makeFunction(facebook::jsi::Runtime &runtime, const char *name,
                                         unsigned int argumentCount,
                                         facebook::jsi::HostFunctionType handler);

    [[noreturn]] void throwCoded(facebook::jsi::Runtime &runtime, const char *code,
                                 const std::string &message);
    facebook::jsi::Object makeError(facebook::jsi::Runtime &runtime, const char *code,
                                    const std::string &message);

    void executeMainSynchronously(std::function<void()> operation,
                                  std::chrono::milliseconds timeout = std::chrono::seconds(1));

    facebook::jsi::Value executeMainAsynchronously(
        facebook::jsi::Runtime &runtime, std::function<void()> operation,
        std::function<facebook::jsi::Value(facebook::jsi::Runtime &)> result);

    void executeRuntimeAsynchronously(std::function<void(facebook::jsi::Runtime &)> callback);
    bool executeRuntimeSynchronously(std::function<void(facebook::jsi::Runtime &)> callback,
                                     std::chrono::milliseconds timeout = std::chrono::milliseconds(100));
}
