#pragma once

#include <functional>
#include <memory>
#include <string>

#include <jsi/jsi.h>

#include <nlohmann/json.hpp>

namespace loader
{
    struct NativePlatformProvider
    {
        std::string                     platform;
        std::function<std::string()>    deviceModel;
        std::function<std::string()>    osVersion;
        std::function<bool()>           isRooted;
        std::function<bool()>           isSystemApp;
        std::function<bool()>           isVerifiedBuild;
        std::function<nlohmann::json()> entitlements;
        std::function<std::string()>    entitlementsAsPlist;
        std::function<std::string()>    appSource;
    };

    facebook::jsi::Value toJSIValue(facebook::jsi::Runtime &runtime, const nlohmann::json &value);
    nlohmann::json fromJSIValue(facebook::jsi::Runtime &runtime, const facebook::jsi::Value &value);

    facebook::jsi::Function makeHostFunction(facebook::jsi::Runtime &runtime, const char *name,
                                             unsigned int argumentCount,
                                             facebook::jsi::HostFunctionType handler);

    void installNativePlatform(facebook::jsi::Runtime &runtime,
                               std::shared_ptr<NativePlatformProvider> provider);
}
