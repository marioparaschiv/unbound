#include <istream>
#include <ostream>
#include <streambuf>

#import "NativePlatform.h"

#import "FileSystem.h"
#import "Utilities.h"
#import "Utilities+CodeSignature.h"

#include "NativePlatformBridge.h"

static std::string toStdString(NSString *value)
{
    const char *utf8 = value.UTF8String;
    return utf8 ? std::string(utf8) : std::string();
}

static nlohmann::json entitlementsJSON()
{
    NSDictionary *entitlements = [Utilities getApplicationEntitlements] ?: @{};
    NSData       *data         = [NSJSONSerialization dataWithJSONObject:entitlements
                                                           options:0
                                                             error:nil];
    if (!data)
    {
        return nlohmann::json::object();
    }

    nlohmann::json parsed =
        nlohmann::json::parse(static_cast<const char *>(data.bytes),
                              static_cast<const char *>(data.bytes) + data.length, nullptr, false);
    return parsed.is_object() ? parsed : nlohmann::json::object();
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
