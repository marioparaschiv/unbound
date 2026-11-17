#include "NativeHookConflicts.h"

#include <map>
#include <mutex>
#include <nlohmann/json.hpp>
#include <set>
#include <unordered_map>

namespace loader::native {
namespace {
    std::mutex gMutex;
    std::unordered_map<std::string, RewritingHook> gHooks;
}

std::vector<std::string> conflictsAmong(const std::vector<RewritingHook> &hooks)
{
    std::map<std::string, std::set<std::string>> addonsByTarget;
    for (const RewritingHook &hook : hooks)
    {
        if (!hook.addon.empty())
        {
            addonsByTarget[hook.target].insert(hook.addon);
        }
    }

    std::vector<std::string> conflicts;
    for (const auto &[target, addons] : addonsByTarget)
    {
        if (addons.size() < 2)
        {
            continue;
        }

        std::string names;
        for (const std::string &addon : addons)
        {
            names += (names.empty() ? "" : " × ") + addon;
        }

        conflicts.push_back(names + " · " + target);
    }

    return conflicts;
}

std::string addonDisplayName(AddonSlot slot)
{
    nlohmann::json record = nlohmann::json::parse(addonRecord(slot), nullptr, false);
    return record.is_object() ? record.value("name", std::string()) : std::string();
}

void recordRewritingHook(const std::string &token, const std::string &target, AddonSlot addon)
{
    std::string name = addonDisplayName(addon);
    if (name.empty())
    {
        return;
    }

    std::lock_guard<std::mutex> lock(gMutex);
    gHooks[token] = {target, std::move(name)};
}

void forgetRewritingHook(const std::string &token)
{
    std::lock_guard<std::mutex> lock(gMutex);
    gHooks.erase(token);
}

void forgetAllRewritingHooks()
{
    std::lock_guard<std::mutex> lock(gMutex);
    gHooks.clear();
}

std::vector<RewritingHook> recordedRewritingHooks()
{
    std::lock_guard<std::mutex> lock(gMutex);
    std::vector<RewritingHook> hooks;
    hooks.reserve(gHooks.size());
    for (const auto &[token, hook] : gHooks)
    {
        hooks.push_back(hook);
    }

    return hooks;
}
}
