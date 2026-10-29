#include "LoaderThreadWarnings.h"

#include <atomic>
#include <memory>
#include <mutex>
#include <nlohmann/json.hpp>
#include <unordered_set>

namespace loader::threading {
static constexpr auto kDeveloperModeRecheck = std::chrono::seconds(1);

struct OffMainViewWarnings::State {
    std::function<bool()>                 developerMode;
    Clock                                 clock;
    std::mutex                            mutex;
    std::chrono::steady_clock::time_point checkedAt{};
    bool                                  hasChecked = false;
    bool                                  enabled    = false;
    std::unordered_set<std::string>       warned;
};

OffMainViewWarnings::OffMainViewWarnings(std::function<bool()> developerMode, Clock clock)
    : state_(std::make_shared<State>())
{
    state_->developerMode = std::move(developerMode);
    state_->clock         = std::move(clock);
}

bool OffMainViewWarnings::enabled()
{
    std::lock_guard<std::mutex> lock(state_->mutex);
    const auto                  now = state_->clock();
    if (!state_->hasChecked || now - state_->checkedAt >= kDeveloperModeRecheck)
    {
        const bool wasEnabled = state_->enabled;
        state_->hasChecked    = true;
        state_->checkedAt     = now;
        state_->enabled       = state_->developerMode && state_->developerMode();
        if (state_->enabled && !wasEnabled)
        {
            state_->warned.clear();
        }
    }
    return state_->enabled;
}

std::optional<std::string> OffMainViewWarnings::warning(AddonSlot addon, const std::string &call)
{
    if (!enabled())
    {
        return std::nullopt;
    }
    {
        std::lock_guard<std::mutex> lock(state_->mutex);
        if (!state_->warned.insert(std::to_string(addon) + " " + call).second)
        {
            return std::nullopt;
        }
    }
    return addonName(addon) + " called " + call +
           " off the main thread. Views are only safe on the main thread; use invokeAsync "
           "instead.";
}

std::string hookFailureMessage(AddonSlot addon, const std::string &reason)
{
    return "Native plugin hook failed in " + addonName(addon) + ": " + reason;
}

std::string callbackFailureMessage(AddonSlot addon, const std::string &reason)
{
    return "Native plugin callback failed in " + addonName(addon) + ": " + reason;
}

std::string hookSkippedMessage(AddonSlot addon, const std::string &selector)
{
    return "Native plugin hook skipped in " + addonName(addon) +
           ": the JavaScript thread did not answer the " + selector +
           " hook within 100 ms, so it did not run";
}

std::string addonName(AddonSlot addon)
{
    nlohmann::json record = nlohmann::json::parse(addonRecord(addon), nullptr, false);
    return record.is_object() ? record.value("name", std::string("an unknown plugin"))
                              : std::string("an unknown plugin");
}
}
