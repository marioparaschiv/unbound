#include "NativeHookStorm.h"

#include <mutex>
#include <nlohmann/json.hpp>
#include <unordered_map>

#include "LoaderLog.h"

namespace loader::native {
namespace {
    struct Window {
        std::chrono::steady_clock::time_point start;
        size_t count = 0;
        bool warned  = false;
    };

    std::mutex gMutex;
    std::unordered_map<uint64_t, Window> gWindows;

    std::string addonName(AddonSlot addon)
    {
        nlohmann::json record = nlohmann::json::parse(addonRecord(addon), nullptr, false);
        return record.is_object() && record["name"].is_string() ? record["name"].get<std::string>()
                                                                : "A plugin";
    }
}

bool admitHookEvent(uint64_t hook, AddonSlot addon, const HookTargetName &target,
                    std::chrono::steady_clock::time_point now)
{
    bool warn = false;
    {
        std::lock_guard<std::mutex> lock(gMutex);
        Window &window = gWindows[hook];
        if (window.count == 0 || now - window.start >= std::chrono::seconds(1))
        {
            window.start = now;
            window.count = 0;
        }

        if (++window.count <= kHookStormLimit)
        {
            return true;
        }

        warn          = !window.warned;
        window.warned = true;
    }

    if (warn)
    {
        log(LogLevel::Warning, LOG_CATEGORY_PLUGINS,
            addonName(addon) + "'s hook on " + (target ? target() : std::string("a method"))
                + " fired over " + std::to_string(kHookStormLimit)
                + " times in a second; Unbound skips its calls past that until it calms down.");
    }

    return false;
}

void forgetHookEvents(uint64_t hook)
{
    std::lock_guard<std::mutex> lock(gMutex);
    gWindows.erase(hook);
}
}
