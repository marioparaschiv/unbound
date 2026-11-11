#pragma once

#include <array>
#include <jsi/jsi.h>
#include <map>
#include <set>
#include <span>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "NativeCapabilityTable.h"

namespace loader::native {
enum class NativePluginPlatform
{
    IOS,
    Android,
};

using InstalledNativeMethods =
    std::map<std::string, std::set<std::string, std::less<>>, std::less<>>;

struct NativeCapabilityReport {
    std::vector<std::string> advertised;
    std::vector<std::string> diagnostics;
};

std::span<const char *const>   expectedNativePluginCapabilities(NativePluginPlatform platform);
const NativeCapabilityBinding *findNativeCapabilityBinding(std::string_view capability);
std::vector<std::string> missingNativeCapabilityMethods(const NativeCapabilityBinding &binding,
                                                        const InstalledNativeMethods  &installed);
NativeCapabilityReport   resolveNativePluginCapabilities(NativePluginPlatform          platform,
                                                         const InstalledNativeMethods &installed);

class NativePluginRootBuilder
{
public:
    NativePluginRootBuilder(facebook::jsi::Runtime &runtime, NativePluginPlatform platform);

    void addNamespace(const std::string &name, facebook::jsi::Object methods);
    void install();

private:
    facebook::jsi::Runtime                                    &runtime_;
    NativePluginPlatform                                       platform_;
    std::vector<std::pair<std::string, facebook::jsi::Object>> namespaces_;
};
}
