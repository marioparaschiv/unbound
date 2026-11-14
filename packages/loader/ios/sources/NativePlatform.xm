#import "NativePlatform.h"

#import <CFNetwork/CFNetwork.h>
#import <Network/Network.h>
#import <UserNotifications/UserNotifications.h>
#include <arpa/inet.h>
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

static std::atomic<int> notificationStatus{-1};
static std::atomic<int> pushRegistered{-1};
static std::atomic<int> batteryPercent{-1};
static std::atomic<int> batteryCharging{-1};

static void readMainThreadState()
{
    UIDevice *device                = UIDevice.currentDevice;
    device.batteryMonitoringEnabled = YES;
    float level                     = device.batteryLevel;
    batteryPercent.store(level < 0 ? -1 : static_cast<int>(level * 100 + 0.5f));
    UIDeviceBatteryState battery = device.batteryState;
    batteryCharging.store(battery == UIDeviceBatteryStateUnknown
                              ? -1
                              : (battery == UIDeviceBatteryStateUnplugged ? 0 : 1));
    if (UIApplication *application = UIApplication.sharedApplication)
    {
        pushRegistered.store(application.isRegisteredForRemoteNotifications ? 1 : 0);
    }
}

static void refreshDeviceState()
{
    dispatch_async(dispatch_get_main_queue(), ^{ readMainThreadState(); });
    [UNUserNotificationCenter.currentNotificationCenter
        getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings) {
            notificationStatus.store(static_cast<int>(settings.authorizationStatus));
        }];
}

static void watchDeviceState()
{
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        [[NSNotificationCenter defaultCenter]
            addObserverForName:UIApplicationDidBecomeActiveNotification
                        object:nil
                         queue:nil
                    usingBlock:^(NSNotification *) { refreshDeviceState(); }];
    });
}

static nlohmann::json powerJSON()
{
    nlohmann::json power = {
        {"lowPower", static_cast<bool>(NSProcessInfo.processInfo.lowPowerModeEnabled)}};
    if (int percent = batteryPercent.load(); percent >= 0)
    {
        power["battery"] = percent;
    }
    if (int charging = batteryCharging.load(); charging >= 0)
    {
        power["charging"] = charging == 1;
    }
    return power;
}

static std::string notificationPermissionName(int status)
{
    switch (status)
    {
        case UNAuthorizationStatusNotDetermined:
            return "not asked";
        case UNAuthorizationStatusDenied:
            return "denied";
        case UNAuthorizationStatusProvisional:
            return "provisional";
        default:
            return "granted";
    }
}

static nlohmann::json pushJSON()
{
    int status = notificationStatus.load();
    if (status < 0)
    {
        return nullptr;
    }
    nlohmann::json push = {{"permission", notificationPermissionName(status)}};
    if (int registered = pushRegistered.load(); registered >= 0)
    {
        push["registered"] = registered == 1;
    }
    return push;
}

#pragma pack(push, 4)
struct UnboundDNSResolver {
    char             *domain;
    int32_t           nameserverCount;
    struct sockaddr **nameservers;
};

struct UnboundDNSConfig {
    int32_t                     resolverCount;
    struct UnboundDNSResolver **resolvers;
};
#pragma pack(pop)

extern "C" {
struct UnboundDNSConfig *dns_configuration_copy(void);
void                     dns_configuration_free(struct UnboundDNSConfig *config);
}

static std::string addressText(const struct sockaddr *address)
{
    char text[INET6_ADDRSTRLEN] = {0};
    if (address->sa_family == AF_INET)
    {
        inet_ntop(AF_INET, &reinterpret_cast<const sockaddr_in *>(address)->sin_addr, text,
                  sizeof(text));
    }
    else if (address->sa_family == AF_INET6)
    {
        inet_ntop(AF_INET6, &reinterpret_cast<const sockaddr_in6 *>(address)->sin6_addr, text,
                  sizeof(text));
    }
    return text;
}

static nlohmann::json dnsJSON()
{
    UnboundDNSConfig *config = dns_configuration_copy();
    if (!config)
    {
        return nullptr;
    }
    nlohmann::json servers = nlohmann::json::array();
    for (int32_t index = 0; index < config->resolverCount; index++)
    {
        UnboundDNSResolver *resolver = config->resolvers[index];
        if (!resolver || resolver->domain)
        {
            continue;
        }
        for (int32_t server = 0; server < resolver->nameserverCount; server++)
        {
            if (std::string text = addressText(resolver->nameservers[server]); !text.empty())
            {
                servers.push_back(text);
            }
        }
        break;
    }
    dns_configuration_free(config);
    return {{"servers", servers}};
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
    state["power"] = powerJSON();
    if (nlohmann::json push = pushJSON(); !push.is_null())
    {
        state["push"] = push;
    }
    if (nlohmann::json dns = dnsJSON(); !dns.is_null())
    {
        state["dns"] = dns;
    }
    refreshDeviceState();
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
    watchDeviceState();
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
