#include "LoaderJSI.h"

#include "HermesBytecodeHeader.h"
#include "LoaderLog.h"

namespace loader
{
    namespace jsi = facebook::jsi;

    static const char *const kMetroModuleCaptureSource =
        "(()=>{if(globalThis.__unboundModuleCaptureInstalled)return true;let define=globalThis.__d;"
        "Object.defineProperty(globalThis,'__d',{configurable:true,get(){if(!globalThis.modules&&"
        "typeof globalThis.__c==='function'){const modules=globalThis.__c();if(modules&&typeof "
        "modules.values==='function')globalThis.modules=modules;}return define;},set(value){define="
        "value;}});globalThis.__unboundModuleCaptureInstalled=true;return true;})()";

    static const char *const kRunApplicationGateSource =
        "(()=>{if(globalThis.__unboundRunGateInstalled)return true;const gate=(registry)=>{if(!"
        "registry||typeof registry!=='object'||registry.__unboundGated)return registry;const run="
        "registry.runApplication;if(typeof run!=='function')return registry;registry.runApplication="
        "function(){try{const before=globalThis.__unboundBeforeRunApplication;if(typeof before==="
        "'function')before();}catch(error){}return run.apply(this,arguments);};try{Object."
        "defineProperty(registry,'__unboundGated',{value:true});}catch(error){}return registry;};"
        "let current=gate(globalThis.RN$AppRegistry);Object.defineProperty(globalThis,"
        "'RN$AppRegistry',{configurable:true,enumerable:true,get(){return current;},set(value){"
        "current=gate(value);}});globalThis.__unboundRunGateInstalled=true;return true;})()";

    static const char *const kRuntimeReadinessSource =
        "(()=>{const map=globalThis.modules;if(!map||typeof map.values!=='function')"
        "return false;let rn=false;"
        "let react=false;for(const m of map.values()){const e=m?.publicModule?.exports??m?.exports??m;"
        "const values=[e,e?.default,e?.default?.default];for(const value of values){if(!value)"
        "continue;if(!rn&&value.AppState&&value.NativeModules)rn=true;if(!react&&typeof "
        "value.createElement==='function')react=true;}}return rn&&react;})()";

    static const char *const kRuntimeDiagnosticsSource =
        "(()=>{const map=globalThis.modules;const names=['modules','__c','__d','__r','React',"
        "'NativeModules','__fbBatchedBridge'];const globals={};for(const name of names)"
        "globals[name]=typeof globalThis[name];return JSON.stringify({globals,"
        "moduleMap:!!map&&typeof map.values==='function',moduleCount:map?.size??null,"
        "defineName:globalThis.__d?.name??null,"
        "requireName:globalThis.__r?.name??null,registryKeys:map&&typeof map.keys==='function'?"
        "[...map.keys()].slice(0,10):[]})})()";

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
                auto prepared =
                    runtime.prepareJavaScript(std::make_shared<OwnedBuffer>(script), tag);
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
            log(LogLevel::Error, "default",
                "JSI eval of '" + tag + "' threw JSError: " + error.what());
        }
        catch (const std::exception &error)
        {
            log(LogLevel::Error, "default",
                "JSI eval of '" + tag + "' threw exception: " + error.what());
        }
        catch (...)
        {
            log(LogLevel::Error, "default", "JSI eval of '" + tag + "' threw an unknown error");
        }
        return false;
    }

    jsi::Value evaluateSource(jsi::Runtime &runtime, const std::string &source,
                              const std::string &tag)
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
            log(LogLevel::Error, "default",
                "JSI source eval of '" + tag + "' threw JSError: " + error.what());
        }
        catch (const std::exception &error)
        {
            log(LogLevel::Error, "default",
                "JSI source eval of '" + tag + "' threw exception: " + error.what());
        }
        catch (...)
        {
            log(LogLevel::Error, "default",
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
        jsi::Value result = evaluateSource(runtime, kMetroModuleCaptureSource,
                                           "unbound:metro-module-capture");
        return result.isBool() && result.getBool();
    }

    bool installRunApplicationGate(jsi::Runtime &runtime,
                                   std::function<void(jsi::Runtime &)> beforeRun)
    {
        auto name = jsi::PropNameID::forAscii(runtime, "__unboundBeforeRunApplication");
        auto hook = jsi::Function::createFromHostFunction(
            runtime, name, 0,
            [beforeRun = std::move(beforeRun)](jsi::Runtime &rt, const jsi::Value &,
                                               const jsi::Value *, size_t) -> jsi::Value {
                beforeRun(rt);
                return jsi::Value::undefined();
            });

        runtime.global().setProperty(runtime, name, std::move(hook));

        jsi::Value result =
            evaluateSource(runtime, kRunApplicationGateSource, "unbound:run-application-gate");
        return result.isBool() && result.getBool();
    }

    bool runtimeHasRequiredModules(jsi::Runtime &runtime)
    {
        jsi::Value result = evaluateSource(runtime, kRuntimeReadinessSource, "unbound:runtime-readiness");
        return result.isBool() && result.getBool();
    }

    std::string runtimeModuleDiagnostics(jsi::Runtime &runtime)
    {
        jsi::Value result = evaluateSource(runtime, kRuntimeDiagnosticsSource,
                                           "unbound:runtime-diagnostics");
        return result.isString() ? result.getString(runtime).utf8(runtime) : "unavailable";
    }
}
