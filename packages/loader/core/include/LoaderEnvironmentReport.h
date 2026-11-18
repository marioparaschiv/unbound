#pragma once

#include <nlohmann/json.hpp>
#include <optional>
#include <string>
#include <vector>

namespace loader::environment_report {

struct AppleDeviceFacts {
    bool lockdownMode     = false;
    bool iPhoneAppOnIPad  = false;
    bool iOSAppOnMac      = false;
    bool managedApp       = false;
    bool jitEnabled       = false;
    bool debuggerAttached = false;
    bool trollFools       = false;
    bool appSync          = false;
};

struct AndroidDeviceFacts {
    std::optional<bool> selinuxEnforcing;
    std::string verifiedBootState;
    std::string buildTags;
    std::string customROM;
    long pageSize = 0;
    std::string webView;
    std::string host;
    std::string skin;
    bool batteryOptimized     = false;
    bool backgroundRestricted = false;
    int standbyBucket         = 0;
};

struct HttpsCheck {
    bool completed = false;
    std::vector<std::string> issuers;
    std::string failure;
};

bool isBetaBuild(const std::string &build);
std::vector<std::string> appleMarkers(const AppleDeviceFacts &facts);
std::vector<std::string> androidMarkers(const AndroidDeviceFacts &facts);
nlohmann::json httpsVerdict(const HttpsCheck &check);
std::string androidInstallLine(const nlohmann::json &facts);

void recordHttpsCheck(HttpsCheck check);
HttpsCheck currentHttpsCheck();
}
