#include "LoaderBootstrap.h"

#include <map>
#include <mutex>

#include "LoaderJSI.h"
#include "LoaderLog.h"

namespace loader::bootstrap
{
    namespace jsi = facebook::jsi;

    static std::mutex                                        gMutex;
    static ScriptSource                                      gSource;
    static std::map<std::string, std::optional<std::string>> gScripts;

    void setScriptSource(ScriptSource source)
    {
        std::lock_guard<std::mutex> lock(gMutex);
        gSource = std::move(source);
        gScripts.clear();
    }

    std::optional<std::string> script(const std::string &name)
    {
        std::lock_guard<std::mutex> lock(gMutex);
        if (auto cached = gScripts.find(name); cached != gScripts.end())
        {
            return cached->second;
        }

        std::optional<std::string> loaded = gSource ? gSource(name) : std::nullopt;
        if (loaded && loaded->empty())
        {
            loaded.reset();
        }
        if (!loaded)
        {
            log(LogLevel::Error, "default", "Bootstrap script " + name + " is unavailable.");
        }
        gScripts[name] = loaded;
        return loaded;
    }

    jsi::Value evaluate(jsi::Runtime &runtime, const std::string &name)
    {
        const auto source = script(name);
        return source ? evaluateSource(runtime, *source, "unbound:" + name) : jsi::Value();
    }

    std::optional<jsi::Function> function(jsi::Runtime &runtime, const std::string &name)
    {
        jsi::Value value = evaluate(runtime, name);
        if (!value.isObject() || !value.asObject(runtime).isFunction(runtime))
        {
            return std::nullopt;
        }
        return value.asObject(runtime).asFunction(runtime);
    }
}
