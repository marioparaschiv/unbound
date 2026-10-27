#pragma once

#include <nlohmann/json.hpp>
#include <string>
#include <vector>

namespace loader {
struct CrashedAddon {
    std::string id;
    std::string name;
};

class AddonCrashGuard
{
public:
    static constexpr const char *kStartingFile = "addon-starting.json";
    static constexpr const char *kCrashesFile  = "addon-crashes.json";
    static constexpr int         kCrashLimit   = 2;

    explicit AddonCrashGuard(std::string directory);

    std::vector<CrashedAddon> recoverFromPreviousLaunch() const;
    bool                      beginStart(const std::string &id, const std::string &name) const;
    bool                      finishStart(const std::string &id) const;

private:
    std::string startingPath() const;
    std::string crashesPath() const;

    std::string directory_;
};

std::vector<CrashedAddon> crashDisabledAddons(const std::string &directory);
std::vector<CrashedAddon> takeUnannouncedCrashDisabledAddons(const std::string &directory);
std::string               crashDisabledNotice(const CrashedAddon &addon);
nlohmann::json            crashedAddonsJSON(const std::vector<CrashedAddon> &addons);
}
