#include "LoaderJSI.h"

#include "HermesBytecodeHeader.h"
#include "LoaderBootstrap.h"
#include "LoaderLog.h"
#include "NativePluginRuntime.h"

namespace loader {
namespace jsi = facebook::jsi;

OwnedBuffer::OwnedBuffer(std::string data) : data_(std::move(data)) {}

size_t OwnedBuffer::size() const
{
    return data_.size();
}

const uint8_t *OwnedBuffer::data() const
{
    return reinterpret_cast<const uint8_t *>(data_.data());
}

bool evaluateScript(jsi::Runtime &runtime, const std::string &script, const std::string &tag)
{
    if (script.empty())
    {
        return false;
    }

    try
    {
        if (isHermesBytecode(script.data(), script.size()))
        {
            auto prepared = runtime.prepareJavaScript(std::make_shared<OwnedBuffer>(script), tag);
            runtime.evaluatePreparedJavaScript(prepared);
        }
        else
        {
            runtime.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(script), tag);
        }
        return true;
    }
    catch (const jsi::JSError &error)
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
            "JSI eval of '" + tag + "' threw JSError: " + error.what());
    }
    catch (const std::exception &error)
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
            "JSI eval of '" + tag + "' threw exception: " + error.what());
    }
    catch (...)
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
            "JSI eval of '" + tag + "' threw an unknown error");
    }
    return false;
}

jsi::Value evaluateSource(jsi::Runtime &runtime, const std::string &source, const std::string &tag)
{
    if (source.empty())
    {
        return jsi::Value();
    }

    try
    {
        return runtime.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(source), tag);
    }
    catch (const jsi::JSError &error)
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
            "JSI source eval of '" + tag + "' threw JSError: " + error.what());
    }
    catch (const std::exception &error)
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
            "JSI source eval of '" + tag + "' threw exception: " + error.what());
    }
    catch (...)
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
            "JSI source eval of '" + tag + "' threw an unknown error");
    }
    return jsi::Value();
}

jsi::Value evaluateBytecode(jsi::Runtime &runtime, std::string bytecode, const std::string &tag)
{
    if (bytecode.empty())
    {
        throw jsi::JSError(runtime, "evaluateBytecode: bytecode is empty");
    }

    if (!isHermesBytecode(bytecode.data(), bytecode.size()))
    {
        throw jsi::JSError(runtime, "evaluateBytecode: data is not Hermes bytecode");
    }

    auto prepared =
        runtime.prepareJavaScript(std::make_shared<OwnedBuffer>(std::move(bytecode)), tag);
    return runtime.evaluatePreparedJavaScript(prepared);
}

bool installMetroModuleCapture(jsi::Runtime &runtime)
{
    jsi::Value result = bootstrap::evaluate(runtime, bootstrap::kMetroModuleCapture);
    return result.isBool() && result.getBool();
}

bool installRunApplicationGate(jsi::Runtime &runtime, std::function<void(jsi::Runtime &)> beforeRun)
{
    auto gate = bootstrap::function(runtime, bootstrap::kRunApplicationGate);
    if (!gate)
    {
        return false;
    }

    auto hook = native::makeFunction(
        runtime, "beforeRunApplication", 0,
        [beforeRun = std::move(beforeRun)](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *,
                                           size_t) -> jsi::Value {
            beforeRun(rt);
            return jsi::Value::undefined();
        });

    try
    {
        jsi::Value result = gate->call(runtime, std::move(hook));
        return result.isBool() && result.getBool();
    }
    catch (const std::exception &error)
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
            std::string("The run-application gate failed: ") + error.what());
        return false;
    }
}

bool runtimeHasRequiredModules(jsi::Runtime &runtime)
{
    jsi::Value result = bootstrap::evaluate(runtime, bootstrap::kRuntimeReadiness);
    return result.isBool() && result.getBool();
}

std::string runtimeModuleDiagnostics(jsi::Runtime &runtime)
{
    jsi::Value result = bootstrap::evaluate(runtime, bootstrap::kRuntimeDiagnostics);
    return result.isString() ? result.getString(runtime).utf8(runtime) : "unavailable";
}
}
