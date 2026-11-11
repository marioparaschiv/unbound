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
    nlohmann::json kinds = loader::debugEnvironment(provider)["resources"];
    for (const char *name : {"objcHandles", "objcPlans", "objcRetains", "javaHandles", "leases"})
    {
        assert(kinds[name] == 0);
    }
    assert(kinds["mainWork"]["drains"].is_number());
    assert(kinds["mainWaits"].is_array());
    loader::native::setPlatformResourceCounter(loader::native::kJavaHandleCounter, [] {
        return size_t(7);
    });
    assert(loader::debugEnvironment(provider)["resources"]["javaHandles"] == 7);
    assert(loader::debugEnvironment(provider)["resources"]["handles"] == 7);
    loader::native::setPlatformResourceCounter(loader::native::kObjCPlanCounter, [] {
        return size_t(3);
    });
    assert(loader::debugEnvironment(provider)["resources"]["handles"] == 10);
    loader::native::setPlatformResourceCounter(loader::native::kObjCPlanCounter, nullptr);
    loader::native::setPlatformResourceCounter(loader::native::kJavaHandleCounter, nullptr);
    assert(loader::debugEnvironment(provider)["resources"]["javaHandles"] == 0);

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
