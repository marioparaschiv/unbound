#pragma once

#include <functional>
#include <memory>
#include <string>

#include <jsi/jsi.h>

namespace loader
{
    class OwnedBuffer : public facebook::jsi::Buffer
    {
    public:
        explicit OwnedBuffer(std::string data);

        size_t size() const override;
        const uint8_t *data() const override;

    private:
        std::string data_;
    };

    bool evaluateScript(facebook::jsi::Runtime &runtime, const std::string &script,
                        const std::string &tag);
    facebook::jsi::Value evaluateSource(facebook::jsi::Runtime &runtime, const std::string &source,
                                        const std::string &tag);
    facebook::jsi::Value evaluateBytecode(facebook::jsi::Runtime &runtime, std::string bytecode,
                                          const std::string &tag);
    bool installMetroModuleCapture(facebook::jsi::Runtime &runtime);
    bool installRunApplicationGate(facebook::jsi::Runtime &runtime,
                                   std::function<void(facebook::jsi::Runtime &)> beforeRun);
    bool runtimeHasRequiredModules(facebook::jsi::Runtime &runtime);
    std::string runtimeModuleDiagnostics(facebook::jsi::Runtime &runtime);
}
