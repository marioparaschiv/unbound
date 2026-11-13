#import "NativePlatform.h"

#import <CFNetwork/CFNetwork.h>
#import <Network/Network.h>
#include <atomic>
#include <istream>
#include <mach-o/dyld.h>
#include <os/proc.h>
#include <ostream>
#include <streambuf>

#import "CoreConversions.h"
#import "EnvironmentReport.h"
#import "FileSystem.h"
#include "JailbreakDetection.h"
#include "LoaderInjectedLibraries.h"
#include "NativePlatformBridge.h"
#import "Utilities+CodeSignature.h"
#import "Utilities.h"

using unbound::ios::jsonFromObject;
using unbound::ios::toStdString;

static std::atomic<int> memoryWarnings{0};

static void countMemoryWarnings()
{
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        [[NSNotificationCenter defaultCenter]
            addObserverForName:UIApplicationDidReceiveMemoryWarningNotification
                        object:nil
                         queue:nil
                    usingBlock:^(NSNotification *) { memoryWarnings.fetch_add(1); }];
    });
}

enum class NetworkType : int
{
    Unknown,
    Offline,
    Wifi,
    Cellular,
    Ethernet,
    Other,
};

static std::atomic<int>  networkType{static_cast<int>(NetworkType::Unknown)};
static std::atomic<bool> networkConstrained{false};
static std::atomic<bool> networkExpensive{false};

static NetworkType pathType(nw_path_t path)
{
    if (nw_path_get_status(path) != nw_path_status_satisfied)
    {
        return NetworkType::Offline;
    }
    if (nw_path_uses_interface_type(path, nw_interface_type_wifi))
    {
        return NetworkType::Wifi;
    }
    if (nw_path_uses_interface_type(path, nw_interface_type_cellular))
    {
        return NetworkType::Cellular;
    }
    if (nw_path_uses_interface_type(path, nw_interface_type_wired))
    {
        return NetworkType::Ethernet;
    }
    return NetworkType::Other;
}

static void watchNetwork()
{
    static nw_path_monitor_t monitor;
    static dispatch_once_t   once;
    dispatch_once(&once, ^{
        monitor = nw_path_monitor_create();
        nw_path_monitor_set_queue(monitor, dispatch_get_global_queue(QOS_CLASS_UTILITY, 0));
        nw_path_monitor_set_update_handler(monitor, ^(nw_path_t path) {
            networkType.store(static_cast<int>(pathType(path)));
            networkConstrained.store(nw_path_is_constrained(path));
            networkExpensive.store(nw_path_is_expensive(path));
        });
        nw_path_monitor_start(monitor);
    });
}

static std::string networkTypeName(NetworkType type)
{
    switch (type)
    {
        case NetworkType::Offline:
            return "offline";
        case NetworkType::Wifi:
            return "wifi";
        case NetworkType::Cellular:
            return "cellular";
        case NetworkType::Ethernet:
            return "ethernet";
        default:
            return "other";
    }
}

static nlohmann::json networkJSON()
{
    auto type = static_cast<NetworkType>(networkType.load());
    if (type == NetworkType::Unknown)
    {
        return nullptr;
    }
    NSDictionary *proxy = CFBridgingRelease(CFNetworkCopySystemProxySettings());
    NSDictionary *scoped =
        [proxy[@"__SCOPED__"] isKindOfClass:NSDictionary.class] ? proxy[@"__SCOPED__"] : @{};
    BOOL vpn = NO;
    for (NSString *interface in scoped)
    {
        for (NSString *prefix in @[ @"utun", @"ipsec", @"ppp", @"tap", @"tun" ])
        {
            vpn = vpn || [interface hasPrefix:prefix];
        }
    }
    BOOL proxied = [proxy[@"HTTPEnable"] boolValue] || [proxy[@"HTTPSEnable"] boolValue] ||
                   [proxy[@"ProxyAutoConfigEnable"] boolValue];
    return {{"type", networkTypeName(type)},
            {"metered", networkExpensive.load()},
            {"lowData", networkConstrained.load()},
            {"vpn", static_cast<bool>(vpn)},
            {"proxy", static_cast<bool>(proxied)}};
}

static std::string thermalName(NSProcessInfoThermalState state)
{
    switch (state)
    {
        case NSProcessInfoThermalStateFair:
            return "fair";
        case NSProcessInfoThermalStateSerious:
            return "serious";
        case NSProcessInfoThermalStateCritical:
            return "critical";
        default:
            return "nominal";
    }
}

static std::vector<std::string> loadedImagePaths()
{
    std::vector<std::string> paths;
    for (uint32_t index = 0, count = _dyld_image_count(); index < count; index++)
    {
        if (const char *name = _dyld_get_image_name(index))
        {
            paths.emplace_back(name);
        }
    }
    return paths;
}

static nlohmann::json deviceStateJSON()
{
    nlohmann::json state = {
        {"availableMB", static_cast<int64_t>(os_proc_available_memory() / (1024 * 1024))},
        {"memoryWarnings", memoryWarnings.load()},
        {"thermal", thermalName(NSProcessInfo.processInfo.thermalState)},
        {"injected", loader::injectedIOSLibraries(loadedImagePaths())}};
    if (nlohmann::json network = networkJSON(); !network.is_null())
    {
        state["network"] = network;
    }
    return state;
}

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
    provider->jailbreak = detectedJailbreak;
    countMemoryWarnings();
    watchNetwork();
    provider->deviceState = deviceStateJSON;
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
    provider->environment = []() {
        return UnboundEnvironmentReport();
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
