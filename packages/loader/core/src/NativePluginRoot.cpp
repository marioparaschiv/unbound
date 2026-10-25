#include "NativePluginRoot.h"

#include "LoaderLog.h"
#include "NativePluginVersion.h"

#include <algorithm>

namespace loader::native
{
    namespace jsi = facebook::jsi;

    std::span<const char *const> expectedNativePluginCapabilities(NativePluginPlatform platform)
    {
        if (platform == NativePluginPlatform::IOS)
        {
            return kIOSNativePluginCapabilities;
        }
        return kAndroidNativePluginCapabilities;
    }

    const NativeCapabilityBinding *findNativeCapabilityBinding(std::string_view capability)
    {
        auto found = std::find_if(kNativeCapabilityBindings.begin(), kNativeCapabilityBindings.end(),
                                  [capability](const NativeCapabilityBinding &binding) {
                                      return binding.capability == capability;
                                  });
        return found == kNativeCapabilityBindings.end() ? nullptr : &*found;
    }

    std::vector<std::string> missingNativeCapabilityMethods(const NativeCapabilityBinding &binding,
                                                            const InstalledNativeMethods &installed)
    {
        std::vector<std::string> missing;
        auto                     nameSpace = installed.find(binding.nameSpace);
        for (std::string_view method : binding.methods)
        {
            if (nameSpace == installed.end() || !nameSpace->second.contains(method))
            {
                missing.push_back(std::string(binding.nameSpace) + "." + std::string(method));
            }
        }
        return missing;
    }

    static bool isBoundMethod(std::string_view nameSpace, std::string_view method)
    {
        return std::any_of(kNativeCapabilityBindings.begin(), kNativeCapabilityBindings.end(),
                           [&](const NativeCapabilityBinding &binding) {
                               return binding.nameSpace == nameSpace &&
                                      std::find(binding.methods.begin(), binding.methods.end(),
                                                method) != binding.methods.end();
                           });
    }

    NativeCapabilityReport resolveNativePluginCapabilities(NativePluginPlatform platform,
                                                           const InstalledNativeMethods &installed)
    {
        NativeCapabilityReport report;
        for (const char *capability : expectedNativePluginCapabilities(platform))
        {
            const NativeCapabilityBinding *binding = findNativeCapabilityBinding(capability);
            if (!binding)
            {
                report.diagnostics.push_back(std::string(capability) + " has no namespace binding");
                continue;
            }

            std::vector<std::string> missing = missingNativeCapabilityMethods(*binding, installed);
            if (missing.empty())
            {
                report.advertised.emplace_back(capability);
                continue;
            }

            std::string diagnostic = std::string(capability) + " is withheld because it lacks";
            for (const std::string &method : missing)
            {
                diagnostic += " " + method;
            }
            report.diagnostics.push_back(std::move(diagnostic));
        }

        for (const auto &[nameSpace, methods] : installed)
        {
            for (const std::string &method : methods)
            {
                if (!isBoundMethod(nameSpace, method))
                {
                    report.diagnostics.push_back(nameSpace + "." + method +
                                                 " is not bound to any capability");
                }
            }
        }
        return report;
    }

    NativePluginRootBuilder::NativePluginRootBuilder(jsi::Runtime &runtime, NativePluginPlatform platform)
        : runtime_(runtime), platform_(platform)
    {
    }

    void NativePluginRootBuilder::addNamespace(const std::string &name, jsi::Object methods)
    {
        namespaces_.emplace_back(name, std::move(methods));
    }

    void NativePluginRootBuilder::install()
    {
        InstalledNativeMethods installed;
        for (const auto &[name, methods] : namespaces_)
        {
            auto      &names      = installed[name];
            jsi::Array properties = methods.getPropertyNames(runtime_);
            for (size_t index = 0; index < properties.size(runtime_); index++)
            {
                jsi::Value property = properties.getValueAtIndex(runtime_, index);
                if (property.isString())
                {
                    names.insert(property.getString(runtime_).utf8(runtime_));
                }
            }
        }

        NativeCapabilityReport report = resolveNativePluginCapabilities(platform_, installed);
        for (const std::string &diagnostic : report.diagnostics)
        {
            log(LogLevel::Error, LOG_CATEGORY_PLUGINS, "Native plugin contract: " + diagnostic);
        }

        jsi::Object root(runtime_);
        root.setProperty(runtime_, "apiVersion", jsi::String::createFromUtf8(runtime_, kNativePluginApiVersion));
        root.setProperty(runtime_, "abiVersion", jsi::String::createFromUtf8(runtime_, kNativePluginAbiVersion));

        jsi::Array capabilities(runtime_, report.advertised.size());
        for (size_t index = 0; index < report.advertised.size(); index++)
        {
            capabilities.setValueAtIndex(runtime_, index,
                                         jsi::String::createFromUtf8(runtime_, report.advertised[index]));
        }
        root.setProperty(runtime_, "capabilities", std::move(capabilities));

        for (auto &[name, methods] : namespaces_)
        {
            root.setProperty(runtime_, name.c_str(), std::move(methods));
        }
        namespaces_.clear();

        runtime_.global().setProperty(runtime_, "NativePlugin", std::move(root));
    }
}
