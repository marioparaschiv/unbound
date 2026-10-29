#pragma once

#include <chrono>
#include <functional>
#include <memory>
#include <optional>
#include <string>

#include "LoaderAddonActivity.h"

namespace loader::threading {
class OffMainViewWarnings
{
public:
    using Clock = std::function<std::chrono::steady_clock::time_point()>;

    explicit OffMainViewWarnings(std::function<bool()> developerMode,
                                 Clock                 clock = std::chrono::steady_clock::now);

    bool                       enabled();
    std::optional<std::string> warning(AddonSlot addon, const std::string &call);

private:
    struct State;
    std::shared_ptr<State> state_;
};

std::string addonName(AddonSlot addon);
std::string hookFailureMessage(AddonSlot addon, const std::string &reason);
std::string hookSkippedMessage(AddonSlot addon, const std::string &selector);
}
