#pragma once

#include <nlohmann/json.hpp>
#include <optional>
#include <string>
#include <vector>

namespace loader::environment_report {
constexpr const char *kDiscordBundleIdentifier = "com.hammerandchisel.discord";
constexpr const char *kDiscordAppGroup         = "group.com.hammerandchisel.discord";

struct ResignFacts {
    std::string              bundleIdentifier;
    bool                     push     = false;
    bool                     appGroup = false;
    std::vector<std::string> keychainGroups;
    std::vector<std::string> extensions;
    std::vector<std::string> expectedExtensions;
};

struct AppleDeviceFacts {
    std::optional<bool> developerMode;
    bool                lockdownMode = false;
    std::string         osBuild;
    bool                iPhoneAppOnIPad = false;
    bool                iOSAppOnMac     = false;
};

struct AndroidDeviceFacts {
    std::optional<bool> selinuxEnforcing;
    std::string         verifiedBootState;
    std::string         buildTags;
    std::string         customROM;
    long                pageSize = 0;
    std::string         webView;
};

struct HttpsCheck {
    bool                     completed = false;
    std::vector<std::string> issuers;
    std::string              failure;
};

std::vector<std::string> resignNotes(const ResignFacts &facts);
bool                     isBetaBuild(const std::string &build);
std::vector<std::string> appleMarkers(const AppleDeviceFacts &facts);
std::vector<std::string> androidMarkers(const AndroidDeviceFacts &facts);
nlohmann::json           httpsVerdict(const HttpsCheck &check);
std::string              androidInstallLine(const nlohmann::json &facts);

void       recordHttpsCheck(HttpsCheck check);
HttpsCheck currentHttpsCheck();
}
