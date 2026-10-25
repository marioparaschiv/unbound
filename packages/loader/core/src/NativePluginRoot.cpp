#include "NativePluginRoot.h"

#include "NativePluginVersion.h"

namespace loader::native
{
    namespace jsi = facebook::jsi;

    jsi::Object makeNativePluginRoot(jsi::Runtime &runtime, std::span<const char *const> capabilities)
    {
        jsi::Object root(runtime);
        root.setProperty(runtime, "apiVersion", jsi::String::createFromUtf8(runtime, kNativePluginApiVersion));
        root.setProperty(runtime, "abiVersion", jsi::String::createFromUtf8(runtime, kNativePluginAbiVersion));

        jsi::Array names(runtime, capabilities.size());
        for (size_t index = 0; index < capabilities.size(); index++)
        {
            names.setValueAtIndex(runtime, index, jsi::String::createFromUtf8(runtime, capabilities[index]));
        }
        root.setProperty(runtime, "capabilities", std::move(names));
        return root;
    }
}
