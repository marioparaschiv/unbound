#import "NativePlatform.h"

#include <istream>
#include <ostream>
#include <streambuf>

#import "CoreConversions.h"
#import "FileSystem.h"
#include "JailbreakDetection.h"
#include "NativePlatformBridge.h"
#import "Utilities+CodeSignature.h"
#import "Utilities.h"

using unbound::ios::jsonFromObject;
using unbound::ios::toStdString;

static nlohmann::json entitlementsJSON()
{
    nlohmann::json converted = jsonFromObject([Utilities getApplicationEntitlements] ?: @{});
    return converted.is_object() ? converted : nlohmann::json::object();
}

namespace loader {

std::shared_ptr<NativePlatformProvider> makeNativePlatformProvider(void)
{
    auto provider         = std::make_shared<NativePlatformProvider>();
    provider->platform    = "ios";
    provider->deviceModel = []() {
        return toStdString([Utilities getDeviceModel]);
    };
    provider->osVersion = []() {
        return toStdString([Utilities getiOSVersionString]);
    };
    provider->isRooted = []() {
        return static_cast<bool>([Utilities isJailbroken]);
    };
    provider->jailbreak   = detectedJailbreak;
    provider->isSystemApp = []() {
        return static_cast<bool>([Utilities isSystemApp]);
    };
    provider->isVerifiedBuild = []() {
        return static_cast<bool>([Utilities isVerifiedBuild]);
    };
    provider->entitlements = []() {
        return entitlementsJSON();
    };
    provider->entitlementsAsPlist = []() {
        NSDictionary *entitlements = [Utilities getApplicationEntitlements];
        return toStdString([Utilities formatEntitlementsAsPlist:entitlements]);
    };
    provider->framework = []() {
        return toStdString([Utilities getInjectionFramework]);
    };
    provider->appSource = []() {
        return toStdString([Utilities getAppSource]);
    };
    provider->installDetails = []() {
        return toStdString([Utilities getInstallDetails]);
    };
    provider->isVirtualDevice = []() {
        return static_cast<bool>([Utilities isVPhone]);
    };
    provider->virtualDeviceHost = []() -> std::optional<std::string> {
        NSString *host = [Utilities getVirtualDeviceHostAddress];
        return host ? std::optional<std::string>(toStdString(host)) : std::nullopt;
    };
    return provider;
}

}
