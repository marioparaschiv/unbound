#include "NativePlatformBridge.h"

#include <cassert>

int main()
{
    loader::NativePlatformProvider provider;
    nlohmann::json                 unset = loader::debugEnvironment(provider);
    assert(unset["isVirtualDevice"] == false);
    assert(unset["hostAddress"].is_null());

    provider.isVirtualDevice   = [] { return true; };
    provider.virtualDeviceHost = []() -> std::optional<std::string> { return "10.0.2.2"; };
    nlohmann::json virtualDevice = loader::debugEnvironment(provider);
    assert(virtualDevice["isVirtualDevice"] == true);
    assert(virtualDevice["hostAddress"] == "10.0.2.2");
    return 0;
}
