#include <cassert>

#include "NativePlatformBridge.h"
#include "NativeResourceBudget.h"

int main()
{
    loader::NativePlatformProvider provider;
    nlohmann::json                 unset = loader::debugEnvironment(provider);
    assert(unset["isVirtualDevice"] == false);
    assert(unset["hostAddress"].is_null());
    assert(unset["resources"]["hooks"] == 0);
    assert(unset["resources"]["surfaces"] == 0);
    assert(unset["resources"]["handles"] == 0);
    loader::native::setPlatformHandleCounter([] {
        return size_t(3);
    });
    assert(loader::debugEnvironment(provider)["resources"]["handles"] == 3);
    loader::native::setPlatformHandleCounter(nullptr);

    provider.isVirtualDevice = [] {
        return true;
    };
    provider.virtualDeviceHost = []() -> std::optional<std::string> {
        return "10.0.2.2";
    };
    nlohmann::json virtualDevice = loader::debugEnvironment(provider);
    assert(virtualDevice["isVirtualDevice"] == true);
    assert(virtualDevice["hostAddress"] == "10.0.2.2");
    return 0;
}
