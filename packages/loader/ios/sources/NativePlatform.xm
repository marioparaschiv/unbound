#include <istream>
#include <ostream>
#include <streambuf>

#import "CoreConversions.h"
#import "NativePlatform.h"

#import "FileSystem.h"
#import "Utilities.h"
#import "Utilities+CodeSignature.h"

#include "NativePlatformBridge.h"

using unbound::ios::jsonFromObject;
using unbound::ios::toStdString;

static nlohmann::json entitlementsJSON()
{
    nlohmann::json converted = jsonFromObject([Utilities getApplicationEntitlements] ?: @{});
    return converted.is_object() ? converted : nlohmann::json::object();
}

namespace loader {

void registerNativePlatform(facebook::jsi::Runtime &runtime)
{
    auto provider          = std::make_shared<NativePlatformProvider>();
    provider->platform     = "ios";
    provider->deviceModel  = []() { return toStdString([Utilities getDeviceModel]); };
    provider->osVersion    = []() { return toStdString([Utilities getiOSVersionString]); };
    provider->isRooted = []() { return static_cast<bool>([Utilities isJailbroken]); };
    provider->isSystemApp  = []() { return static_cast<bool>([Utilities isSystemApp]); };
    provider->isVerifiedBuild = []() { return static_cast<bool>([Utilities isVerifiedBuild]); };
    provider->entitlements    = []() { return entitlementsJSON(); };
    provider->entitlementsAsPlist = []() {
        NSDictionary *entitlements = [Utilities getApplicationEntitlements];
        return toStdString([Utilities formatEntitlementsAsPlist:entitlements]);
    };
    provider->appSource = []() { return toStdString([Utilities getAppSource]); };
    provider->documents = toStdString(FileSystem.documents);

    installNativePlatform(runtime, provider);
}

}
