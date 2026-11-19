#include "LoaderNetworkStack.h"

#include <algorithm>
#include <arpa/inet.h>
#include <ifaddrs.h>
#include <net/if.h>
#include <netinet/in.h>

namespace loader::environment_report {
static bool isLoopback(const InterfaceAddress &entry)
{
    return entry.interface.starts_with("lo") || entry.address == "127.0.0.1"
           || entry.address == "::1";
}

static bool isTranslatedIPv4(const InterfaceAddress &entry)
{
    return !entry.ipv6
           && (entry.interface.starts_with("v4-") || entry.address.starts_with("192.0.0."));
}

static bool isGlobalIPv6(const InterfaceAddress &entry)
{
    return entry.ipv6 && !entry.address.starts_with("fe80") && !entry.address.starts_with("fd")
           && !entry.address.starts_with("fc");
}

std::string networkStackMarker(const std::vector<InterfaceAddress> &addresses)
{
    std::vector<InterfaceAddress> external;
    std::copy_if(addresses.begin(), addresses.end(), std::back_inserter(external),
                 [](const InterfaceAddress &entry) {
                     return !isLoopback(entry);
                 });

    bool nativeIPv4 = std::any_of(external.begin(), external.end(), [](const auto &entry) {
        return !entry.ipv6 && !isTranslatedIPv4(entry);
    });
    bool globalIPv6 = std::any_of(external.begin(), external.end(), isGlobalIPv6);
    if (nativeIPv4 || !globalIPv6)
    {
        return {};
    }

    bool translated = std::any_of(external.begin(), external.end(), isTranslatedIPv4);
    return translated ? "IPv6-only network (464XLAT)" : "IPv6-only network";
}

static std::string addressText(const sockaddr *address)
{
    char text[INET6_ADDRSTRLEN] = {};
    if (address->sa_family == AF_INET)
    {
        inet_ntop(AF_INET, &reinterpret_cast<const sockaddr_in *>(address)->sin_addr, text,
                  sizeof(text));
    }
    else
    {
        inet_ntop(AF_INET6, &reinterpret_cast<const sockaddr_in6 *>(address)->sin6_addr, text,
                  sizeof(text));
    }

    return text;
}

std::vector<InterfaceAddress> interfaceAddresses()
{
    std::vector<InterfaceAddress> addresses;
    ifaddrs *list = nullptr;
    if (getifaddrs(&list) != 0)
    {
        return addresses;
    }

    for (ifaddrs *entry = list; entry; entry = entry->ifa_next)
    {
        const sockaddr *address = entry->ifa_addr;
        bool up                 = (entry->ifa_flags & IFF_UP) && (entry->ifa_flags & IFF_RUNNING);
        if (!address || !up || (address->sa_family != AF_INET && address->sa_family != AF_INET6))
        {
            continue;
        }

        addresses.push_back({entry->ifa_name ? entry->ifa_name : "", addressText(address),
                             address->sa_family == AF_INET6});
    }

    freeifaddrs(list);
    return addresses;
}

std::string currentNetworkStackMarker()
{
    return networkStackMarker(interfaceAddresses());
}
}
