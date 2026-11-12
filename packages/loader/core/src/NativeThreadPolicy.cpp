#include "NativeThreadPolicy.h"

namespace jsi = facebook::jsi;

namespace loader::native {
std::string threadPolicy(const nlohmann::json &options)
{
    if (options.is_object())
    {
        auto thread = options.find("thread");
        if (thread != options.end() && thread->is_string())
        {
            return thread->get<std::string>();
        }
    }
    return kCurrentThreadPolicy;
}

std::string threadPolicy(jsi::Runtime &runtime, const jsi::Value *options)
{
    if (options && options->isObject())
    {
        jsi::Value thread = options->asObject(runtime).getProperty(runtime, "thread");
        if (thread.isString())
        {
            return thread.asString(runtime).utf8(runtime);
        }
    }
    return kCurrentThreadPolicy;
}

bool crossesToMain(std::string_view policy)
{
    return policy == "main" || policy == "main-post";
}

bool runsInPlace(std::string_view policy, bool onMainThread)
{
    return policy == kCurrentThreadPolicy || (onMainThread && crossesToMain(policy));
}

bool postsToMain(std::string_view policy, bool returnsVoid)
{
    return policy == "main-post" && returnsVoid;
}
}
