#pragma once

#include <string>
#include <vector>

namespace loader::environment_report {
struct InterfaceAddress {
    std::string interface;
    std::string address;
    bool ipv6 = false;
};

std::string networkStackMarker(const std::vector<InterfaceAddress> &addresses);
std::vector<InterfaceAddress> interfaceAddresses();
std::string currentNetworkStackMarker();
}
