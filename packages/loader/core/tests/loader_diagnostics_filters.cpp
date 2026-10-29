#include <cassert>
#include <string>

#include "LoaderDiagnostics.h"

using namespace loader::diagnostics;

static ErrorReport error(const std::string &domain, long long code)
{
    ErrorReport report;
    report.domain = domain;
    report.code   = code;
    return report;
}

static void checkKnownCodes()
{
    assert(isIgnoredError(error("NSURLErrorDomain", -999)));
    assert(!isIgnoredError(error("NSURLErrorDomain", -1001)));
    assert(isIgnoredError(error("NSCocoaErrorDomain", 4099)));
    assert(isIgnoredError(error("NSCocoaErrorDomain", 3840)));
    assert(isIgnoredError(error("kCFErrorDomainCFNetwork", -1004)));
    assert(isIgnoredError(error("com.apple.Gestures", 4)));
    assert(isIgnoredError(error("NSPOSIXErrorDomain", 57)));
    assert(!isIgnoredError(error("NSPOSIXErrorDomain", 1)));
    assert(!isIgnoredError(error("app.unbound", 1)));
    assert(!isIgnoredError(error("", 0)));
}

static void checkPOSIXInvalidArgument()
{
    ErrorReport invalid = error("NSPOSIXErrorDomain", 22);
    assert(isIgnoredError(invalid));
    invalid.userInfoCount = 1;
    assert(!isIgnoredError(invalid));
}

static void checkCocoaWrappedErrors()
{
    ErrorReport wrapped = error("NSCocoaErrorDomain", 256);
    assert(!isIgnoredError(wrapped));

    wrapped.underlyingError = UnderlyingError{"NSPOSIXErrorDomain", 22};
    assert(isIgnoredError(wrapped));
    wrapped.underlyingError = UnderlyingError{"NSPOSIXErrorDomain", 2};
    wrapped.underlyingText  = "Error Domain=NSPOSIXErrorDomain Code=22";
    assert(!isIgnoredError(wrapped));

    wrapped.underlyingError.reset();
    assert(isIgnoredError(wrapped));
    wrapped.underlyingText = "Error Domain=NSPOSIXErrorDomain Code=2";
    assert(!isIgnoredError(wrapped));

    wrapped.filePath = "/var/mobile/Library/appsflyer-v1/cache";
    assert(isIgnoredError(wrapped));
    wrapped.filePath.clear();
    wrapped.url = "file:///private/appsflyer-v1/";
    assert(isIgnoredError(wrapped));

    ErrorReport other = error("NSCocoaErrorDomain", 257);
    other.filePath    = "/appsflyer-v1";
    assert(!isIgnoredError(other));
}

static void checkGesturesAndViewServices()
{
    ErrorReport gesture          = error("com.apple.Gestures", 7);
    gesture.localizedDescription = "Custom";
    assert(isIgnoredError(gesture));
    gesture.code = 0;
    assert(!isIgnoredError(gesture));
    gesture.localizedDescription = "Excluded";
    assert(isIgnoredError(gesture));

    ErrorReport service = error("_UIViewServiceErrorDomain", 1);
    assert(!isIgnoredError(service));
    service.message = "Remote StoreKitUIService terminated";
    assert(isIgnoredError(service));
    service.message.clear();
    service.terminated = true;
    assert(isIgnoredError(service));
    service.code = 2;
    assert(!isIgnoredError(service));
}

static void checkStartupWarnings()
{
    assert(isIgnoredException("CHHapticErrorCodeServerInitFailedException"));
    assert(isIgnoredException("DownloadFailed"));
    assert(isIgnoredException("DownloadTimedOut"));
    assert(!isIgnoredException("NSInvalidArgumentException"));

    assert(needsExtensionCheck(false, false, false));
    assert(!needsExtensionCheck(true, false, false));
    assert(!needsExtensionCheck(false, true, false));
    assert(!needsExtensionCheck(false, false, true));

    assert(missingExtensionWarnings(true, true).empty());
    const auto both = missingExtensionWarnings(false, false);
    assert(both.size() == 2);
    assert(both[0].title == "Missing Safari Extension");
    assert(both[0].message.find("OpenInDiscord.appex") != std::string::npos);
    assert(both[1].title == "Missing Share Extension");
    assert(both[1].message.find("Share.appex") != std::string::npos);
    assert(both[0].logMessage == "OpenInDiscord extension missing, showing alert");
    assert(both[1].logMessage == "Share extension missing, showing alert");
    assert(missingExtensionWarnings(true, false).front().title == "Missing Share Extension");
    assert(std::string(kAttestationWarningTitle).find("SECURITY WARNING") != std::string::npos);
}

int main()
{
    checkKnownCodes();
    checkPOSIXInvalidArgument();
    checkCocoaWrappedErrors();
    checkGesturesAndViewServices();
    checkStartupWarnings();
    return 0;
}
