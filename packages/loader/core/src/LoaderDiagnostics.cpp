#include "LoaderDiagnostics.h"

#include <map>
#include <set>

namespace loader::diagnostics {
static bool isContinuationByte(char byte)
{
    return (static_cast<unsigned char>(byte) & 0xC0) == 0x80;
}

static std::string known(const std::string &value)
{
    return value.empty() ? "unknown" : value;
}

std::string bannerSubject(const std::string &subject)
{
    if (subject.size() <= kBannerSubjectLength)
    {
        return subject;
    }
    size_t length = kBannerSubjectLength;
    while (length > 0 && isContinuationByte(subject[length]))
    {
        length--;
    }
    return subject.substr(0, length) + "...";
}

std::string developmentBuildBanner(const BuildInfo &info)
{
    return std::string(kDevelopmentBuildTitle) + "\n#" + known(info.commit) + " - " +
           bannerSubject(info.subject) + " - " + known(info.branch) +
           "\nBuilt: " + known(info.timestamp);
}

static const std::map<std::string, std::set<long long>> &ignoredErrorCodes()
{
    static const std::map<std::string, std::set<long long>> codes = {
        {"com.firebase.dynamicLinks", {1}},
        {"com.apple.AppSSO.AuthorizationError", {-1000}},
        {"RCTJavaScriptLoaderErrorDomain", {1000}},
        {"NSPOSIXErrorDomain", {2, 17, 57}},
        {"kCFErrorDomainCFNetwork", {-1005, -1004}},
        {"BSActionErrorDomain", {1}},
        {"BSServiceConnectionErrorDomain", {1}},
        {"NSOSStatusErrorDomain", {-10813}},
        {"NSCocoaErrorDomain", {258, 260, 516, 4864, 4, 4099, 3840}},
        {"com.appsflyer.sdk.network", {50}},
        {"AVFoundationErrorDomain", {-11800}},
        {"kAFAssistantErrorDomain", {400, 401}},
        {"com.apple.CoreHaptics", {4099}},
        {"com.apple.Gestures", {2, 4}},
        {"SDWebImageErrorDomain", {1000, 2002}},
        {"LLVideoPlayerCacheTask", {-999}},
        {"NSURLErrorDomain", {-999}},
    };
    return codes;
}

static bool contains(const std::string &text, const char *fragment)
{
    return text.find(fragment) != std::string::npos;
}

static bool isInvalidArgumentPOSIXError(const ErrorReport &report)
{
    if (report.underlyingError)
    {
        return report.underlyingError->domain == "NSPOSIXErrorDomain" &&
               report.underlyingError->code == 22;
    }
    return contains(report.underlyingText, "NSPOSIXErrorDomain") &&
           contains(report.underlyingText, "Code=22");
}

static bool isIgnoredCocoaError(const ErrorReport &report)
{
    return report.code == 256 &&
           (isInvalidArgumentPOSIXError(report) || contains(report.filePath, "appsflyer-v1") ||
            contains(report.url, "appsflyer-v1"));
}

static bool isIgnoredGestureError(const ErrorReport &report)
{
    return (report.code == 7 && report.localizedDescription == "Custom") ||
           (report.code == 0 && report.localizedDescription == "Excluded");
}

static bool isIgnoredViewServiceError(const ErrorReport &report)
{
    return report.code == 1 && (contains(report.message, "StoreKitUIService") || report.terminated);
}

bool isIgnoredError(const ErrorReport &report)
{
    const auto &codes = ignoredErrorCodes();
    const auto  entry = codes.find(report.domain);
    if (entry != codes.end() && entry->second.count(report.code))
    {
        return true;
    }
    if (report.domain == "NSPOSIXErrorDomain")
    {
        return report.code == 22 && report.userInfoCount == 0;
    }
    if (report.domain == "NSCocoaErrorDomain")
    {
        return isIgnoredCocoaError(report);
    }
    if (report.domain == "com.apple.Gestures")
    {
        return isIgnoredGestureError(report);
    }
    if (report.domain == "_UIViewServiceErrorDomain")
    {
        return isIgnoredViewServiceError(report);
    }
    return false;
}

bool isIgnoredException(const std::string &name)
{
    return name == "CHHapticErrorCodeServerInitFailedException";
}

bool needsExtensionCheck(bool appStore, bool testFlight, bool trollStore)
{
    return !appStore && !testFlight && !trollStore;
}

std::vector<StartupWarning> missingExtensionWarnings(bool hasSafariExtension,
                                                     bool hasShareExtension)
{
    std::vector<StartupWarning> warnings;
    if (!hasSafariExtension)
    {
        warnings.push_back({"Missing Safari Extension",
                            "The Safari extension (OpenInDiscord.appex) is missing. You won't be "
                            "able to open Discord links directly in the app.",
                            "OpenInDiscord extension missing, showing alert"});
    }
    if (!hasShareExtension)
    {
        warnings.push_back({"Missing Share Extension",
                            "The Share extension (Share.appex) is missing. You won't be able to "
                            "receive shared media and files from other apps through the share "
                            "sheet.",
                            "Share extension missing, showing alert"});
    }
    return warnings;
}
}
