#pragma once

#include <cstddef>
#include <optional>
#include <string>
#include <vector>

namespace loader::diagnostics {
struct BuildInfo {
    std::string commit;
    std::string subject;
    std::string branch;
    std::string timestamp;
};

constexpr const char *kIncompatibleHostMessage =
    "This version of Discord is incompatible with this version of astral.";
constexpr const char *kDevelopmentBuildTitle = "DEVELOPMENT BUILD - DO NOT USE";
constexpr size_t      kBannerSubjectLength   = 36;
constexpr unsigned    kBannerSeconds         = 10;

struct UnderlyingError {
    std::string domain;
    long long   code = 0;
};

struct ErrorReport {
    std::string                    domain;
    long long                      code          = 0;
    size_t                         userInfoCount = 0;
    std::optional<UnderlyingError> underlyingError;
    std::string                    underlyingText;
    std::string                    filePath;
    std::string                    url;
    std::string                    localizedDescription;
    std::string                    message;
    bool                           terminated = false;
};

struct StartupWarning {
    std::string title;
    std::string message;
    std::string logMessage;
};

constexpr const char *kAttestationWarningTitle = "⚠️ SECURITY WARNING";
constexpr const char *kAttestationWarningMessage =
    "The injected tweak failed astral's embedded integrity verification. "
    "You cannot be sure that this is free of malware. "
    "If this app was obtained via 'cypwn' or similar sources "
    "we heavily recommend you uninstall it immediately.";
constexpr unsigned    kAttestationWarningSeconds = 15;
constexpr const char *kElleKitWarningTitle       = "Runtime Detection";
constexpr const char *kElleKitWarningMessage =
    "Warning: Tweak is not loaded through ElleKit. Functionality is not guaranteed.";
constexpr const char *kSafariExtensionName = "OpenInDiscord";
constexpr const char *kShareExtensionName  = "Share";

std::string bannerSubject(const std::string &subject);
std::string developmentBuildBanner(const BuildInfo &info);

bool isIgnoredError(const ErrorReport &report);
bool isIgnoredException(const std::string &name);

bool                        needsExtensionCheck(bool appStore, bool testFlight, bool trollStore);
std::vector<StartupWarning> missingExtensionWarnings(bool hasSafariExtension,
                                                     bool hasShareExtension);
}
