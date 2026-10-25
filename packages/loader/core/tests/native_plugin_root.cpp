#include "NativePluginRoot.h"

#include <algorithm>
#include <cassert>
#include <set>
#include <string>

using namespace loader::native;

static InstalledNativeMethods installedFor(NativePluginPlatform platform)
{
    InstalledNativeMethods installed;
    for (const char *capability : expectedNativePluginCapabilities(platform))
    {
        const NativeCapabilityBinding *binding = findNativeCapabilityBinding(capability);
        assert(binding);
        auto &methods = installed[std::string(binding->nameSpace)];
        for (std::string_view method : binding->methods)
        {
            methods.insert(std::string(method));
        }
    }
    return installed;
}

static bool contains(const std::vector<std::string> &values, const std::string &value)
{
    return std::find(values.begin(), values.end(), value) != values.end();
}

static bool mentions(const std::vector<std::string> &values, const std::string &fragment)
{
    return std::any_of(values.begin(), values.end(),
                       [&](const std::string &value) { return value.find(fragment) != std::string::npos; });
}

int main()
{
    std::set<std::string_view> capabilities;
    for (const NativeCapabilityBinding &binding : kNativeCapabilityBindings)
    {
        assert(capabilities.insert(binding.capability).second);
        assert(!binding.nameSpace.empty());
    }

    for (NativePluginPlatform platform : {NativePluginPlatform::IOS, NativePluginPlatform::Android})
    {
        NativeCapabilityReport report = resolveNativePluginCapabilities(platform, installedFor(platform));
        assert(report.diagnostics.empty());
        assert(report.advertised.size() == expectedNativePluginCapabilities(platform).size());
    }

    InstalledNativeMethods android = installedFor(NativePluginPlatform::Android);
    assert(!android.contains("objc"));
    assert(android["fabric"].contains("mountAsync"));
    assert(!android["fabric"].contains("mount"));

    InstalledNativeMethods ios = installedFor(NativePluginPlatform::IOS);
    ios["fabric"].erase("setSize");
    ios["objc"].insert("teleport");
    NativeCapabilityReport partial = resolveNativePluginCapabilities(NativePluginPlatform::IOS, ios);
    assert(!contains(partial.advertised, "native.fabric.mount"));
    assert(contains(partial.advertised, "native.fabric.async"));
    assert(mentions(partial.diagnostics, "native.fabric.mount is withheld because it lacks fabric.setSize"));
    assert(mentions(partial.diagnostics, "objc.teleport is not bound to any capability"));

    InstalledNativeMethods empty;
    NativeCapabilityReport bare = resolveNativePluginCapabilities(NativePluginPlatform::Android, empty);
    assert((bare.advertised == std::vector<std::string>{"native.runtime.events"}));

    const NativeCapabilityBinding *hooks = findNativeCapabilityBinding("native.java.hooks");
    assert(hooks && hooks->nameSpace == "hooks");
    assert(missingNativeCapabilityMethods(*hooks, empty).size() == hooks->methods.size());
    assert(!findNativeCapabilityBinding("native.unknown.capability"));
}
