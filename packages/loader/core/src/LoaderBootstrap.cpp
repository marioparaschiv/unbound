#include "LoaderBootstrap.h"

#include <map>
#include <mutex>
#include <set>

#include "LoaderJSI.h"
#include "LoaderLog.h"

namespace loader::bootstrap {
namespace jsi = facebook::jsi;

struct Scripts {
    std::mutex                         mutex;
    ScriptSource                       source;
    std::map<std::string, std::string> loaded;
    std::set<std::string>              reported;
};

// Built on first use: iOS sets the source from a thread its %ctor starts while this file's static
// initializers may not have run yet, and a namespace-scope global would then be reset to empty.
static Scripts &scripts()
{
    static Scripts instance;
    return instance;
}

void setScriptSource(ScriptSource source)
{
    Scripts                    &state = scripts();
    std::lock_guard<std::mutex> lock(state.mutex);
    state.source = std::move(source);
    state.loaded.clear();
    state.reported.clear();
}

std::optional<std::string> script(const std::string &name)
{
    Scripts                    &state = scripts();
    std::lock_guard<std::mutex> lock(state.mutex);
    if (auto cached = state.loaded.find(name); cached != state.loaded.end())
    {
        return cached->second;
    }

    std::optional<std::string> loaded = state.source ? state.source(name) : std::nullopt;
    if (!loaded || loaded->empty())
    {
        // Not cached, so a later lookup reads it again instead of failing for the whole session;
        // logged once, as UI worklets can look it up every frame.
        if (state.reported.insert(name).second)
        {
            log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
                "Bootstrap script " + name + " is unavailable.");
        }
        return std::nullopt;
    }
    state.loaded[name] = *loaded;
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
