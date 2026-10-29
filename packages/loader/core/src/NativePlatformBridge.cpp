#include "NativePlatformBridge.h"

#include <atomic>
#include <mutex>
#include <stdexcept>

#include "LoaderAddonActivity.h"
#include "LoaderAddonSignature.h"
#include "LoaderAddons.h"
#include "LoaderCrashGuard.h"
#include "LoaderFiles.h"
#include "LoaderFreezeWatchdog.h"
#include "LoaderJSI.h"
#include "LoaderJSON.h"
#include "NativePluginRuntime.h"
#include "NativeResourceBudget.h"

namespace loader {
namespace jsi = facebook::jsi;

static std::atomic<bool> launchURLClaimed{false};

jsi::Value toJSIValue(jsi::Runtime &runtime, const nlohmann::json &value)
{
    switch (value.type())
    {
        case nlohmann::json::value_t::null:
        case nlohmann::json::value_t::discarded:
            return jsi::Value::null();
        case nlohmann::json::value_t::boolean:
            return jsi::Value(value.get<bool>());
        case nlohmann::json::value_t::number_integer:
        case nlohmann::json::value_t::number_unsigned:
        case nlohmann::json::value_t::number_float:
            return jsi::Value(value.get<double>());
        case nlohmann::json::value_t::string:
            return jsi::String::createFromUtf8(runtime, withValidUTF8(value.get<std::string>()));
        case nlohmann::json::value_t::array: {
            jsi::Array array(runtime, value.size());
            for (size_t index = 0; index < value.size(); index++)
            {
                array.setValueAtIndex(runtime, index, toJSIValue(runtime, value[index]));
            }
            return array;
        }
        case nlohmann::json::value_t::object: {
            jsi::Object object(runtime);
            for (auto entry = value.begin(); entry != value.end(); ++entry)
            {
                object.setProperty(runtime,
                                   jsi::PropNameID::forUtf8(runtime, withValidUTF8(entry.key())),
                                   toJSIValue(runtime, entry.value()));
            }
            return object;
        }
        case nlohmann::json::value_t::binary:
            return jsi::Value::undefined();
    }
    return jsi::Value::undefined();
}

static constexpr size_t kMaximumConvertedDepth = 128;

static nlohmann::json convertJSIValue(jsi::Runtime &runtime, const jsi::Value &value, size_t depth)
{
    if (value.isUndefined() || value.isNull())
    {
        return nullptr;
    }
    if (value.isBool())
    {
        return value.getBool();
    }
    if (value.isNumber())
    {
        return value.getNumber();
    }
    if (value.isString())
    {
        return value.getString(runtime).utf8(runtime);
    }
    if (!value.isObject())
    {
        return nullptr;
    }

    if (depth > kMaximumConvertedDepth)
    {
        throw std::invalid_argument("Native value nests deeper than " +
                                    std::to_string(kMaximumConvertedDepth) +
                                    " levels or refers to itself");
    }

    jsi::Object object = value.getObject(runtime);
    if (object.isArray(runtime))
    {
        jsi::Array     array  = object.getArray(runtime);
        nlohmann::json result = nlohmann::json::array();
        for (size_t index = 0; index < array.size(runtime); index++)
        {
            result.push_back(
                convertJSIValue(runtime, array.getValueAtIndex(runtime, index), depth + 1));
        }
        return result;
    }

    if (object.isFunction(runtime))
    {
        return nullptr;
    }

    nlohmann::json result = nlohmann::json::object();
    jsi::Array     names  = object.getPropertyNames(runtime);
    for (size_t index = 0; index < names.size(runtime); index++)
    {
        std::string name = names.getValueAtIndex(runtime, index).getString(runtime).utf8(runtime);
        result[name] =
            convertJSIValue(runtime, object.getProperty(runtime, name.c_str()), depth + 1);
    }
    return result;
}

nlohmann::json fromJSIValue(jsi::Runtime &runtime, const jsi::Value &value)
{
    return convertJSIValue(runtime, value, 1);
}

template <typename Provider>
static jsi::Function stringGetter(jsi::Runtime &runtime, const char *name, Provider provider)
{
    return native::makeFunction(
        runtime, name, 0,
        [provider](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *, size_t) -> jsi::Value {
            return jsi::String::createFromUtf8(rt, provider ? provider() : "");
        });
}

template <typename Provider>
static jsi::Function booleanGetter(jsi::Runtime &runtime, const char *name, Provider provider)
{
    return native::makeFunction(
        runtime, name, 0,
        [provider](jsi::Runtime &, const jsi::Value &, const jsi::Value *, size_t) -> jsi::Value {
            return jsi::Value(provider ? provider() : false);
        });
}

static std::string stringArgument(jsi::Runtime &runtime, const jsi::Value *args, size_t count,
                                  size_t index)
{
    return index < count && args[index].isString() ? args[index].getString(runtime).utf8(runtime)
                                                   : std::string();
}

class ActivityCellBuffer final : public jsi::MutableBuffer
{
public:
    explicit ActivityCellBuffer(uint32_t *cell) : cell_(cell) {}

    size_t size() const override
    {
        return sizeof(*cell_);
    }

    uint8_t *data() override
    {
        return reinterpret_cast<uint8_t *>(cell_);
    }

private:
    uint32_t *cell_;
};

static jsi::Value activityCell(jsi::Runtime &runtime)
{
    uint32_t *cell = claimActivityCell();
    if (!cell)
    {
        return jsi::Value::undefined();
    }
    return jsi::ArrayBuffer(runtime, std::make_shared<ActivityCellBuffer>(cell));
}

static jsi::Object crashGuardObject(jsi::Runtime &runtime, const std::string &documents)
{
    crashDisabledAddons(documents);
    startFreezeWatchdog(documents);

    jsi::Object guard(runtime);
    guard.setProperty(
        runtime, "begin",
        native::makeFunction(runtime, "begin", 2,
                             [documents](jsi::Runtime     &rt, const jsi::Value &,
                                         const jsi::Value *args, size_t count) -> jsi::Value {
                                 armAddonCrashAttribution(documents);
                                 return jsi::Value(AddonCrashGuard(documents).beginStart(
                                     stringArgument(rt, args, count, 0),
                                     stringArgument(rt, args, count, 1)));
                             }));
    guard.setProperty(
        runtime, "end",
        native::makeFunction(runtime, "end", 1,
                             [documents](jsi::Runtime     &rt, const jsi::Value &,
                                         const jsi::Value *args, size_t count) -> jsi::Value {
                                 return jsi::Value(AddonCrashGuard(documents).finishStart(
                                     stringArgument(rt, args, count, 0)));
                             }));
    guard.setProperty(
        runtime, "register",
        native::makeFunction(runtime, "register", 2,
                             [documents](jsi::Runtime     &rt, const jsi::Value &,
                                         const jsi::Value *args, size_t count) -> jsi::Value {
                                 armAddonCrashAttribution(documents);
                                 return jsi::Value(static_cast<double>(
                                     registerAddonSlot(stringArgument(rt, args, count, 0),
                                                       stringArgument(rt, args, count, 1))));
                             }));
    guard.setProperty(runtime, "activity",
                      native::makeFunction(runtime, "activity", 0,
                                           [](jsi::Runtime &rt, const jsi::Value &,
                                              const jsi::Value *, size_t) -> jsi::Value {
                                               return activityCell(rt);
                                           }));
    guard.setProperty(
        runtime, "disabled",
        native::makeFunction(runtime, "disabled", 0,
                             [documents](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *,
                                         size_t) -> jsi::Value {
                                 return toJSIValue(
                                     rt, crashedAddonsJSON(crashDisabledAddons(documents)));
                             }));
    return guard;
}

static std::mutex                              gInstalledProviderMutex;
static std::shared_ptr<NativePlatformProvider> gInstalledProvider;

void setNativePlatformProvider(std::shared_ptr<NativePlatformProvider> provider)
{
    std::lock_guard<std::mutex> lock(gInstalledProviderMutex);
    gInstalledProvider = std::move(provider);
}

std::shared_ptr<NativePlatformProvider> currentNativePlatformProvider()
{
    std::lock_guard<std::mutex> lock(gInstalledProviderMutex);
    return gInstalledProvider;
}

void installNativePlatform(jsi::Runtime &runtime, std::shared_ptr<NativePlatformProvider> provider)
{
    jsi::Object platform(runtime);

    platform.setProperty(
        runtime, "evaluateBytecode",
        native::makeFunction(
            runtime, "evaluateBytecode", 2,
            [](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
               size_t count) -> jsi::Value {
                if (count == 0 || !args[0].isObject() || !args[0].asObject(rt).isArrayBuffer(rt))
                {
                    throw jsi::JSError(rt, "evaluateBytecode expects an ArrayBuffer "
                                           "of Hermes bytecode as its first argument");
                }

                jsi::ArrayBuffer buffer = args[0].asObject(rt).getArrayBuffer(rt);
                std::string      bytecode(reinterpret_cast<const char *>(buffer.data(rt)),
                                          buffer.size(rt));
                std::string      tag = count > 1 && args[1].isString()
                                           ? args[1].getString(rt).utf8(rt)
                                           : "NativePlatform.evaluateBytecode";
                return evaluateBytecode(rt, std::move(bytecode), tag);
            }));

    if (provider->fonts)
    {
        jsi::Object fonts(runtime);
        auto        list = provider->fonts;
        fonts.setProperty(runtime, "list",
                          native::makeFunction(runtime, "list", 0,
                                               [list](jsi::Runtime &rt, const jsi::Value &,
                                                      const jsi::Value *, size_t) -> jsi::Value {
                                                   return toJSIValue(rt, list());
                                               }));
        platform.setProperty(runtime, "fonts", std::move(fonts));
    }

    if (provider->settings)
    {
        jsi::Object    settings(runtime);
        SettingsStore *store = provider->settings;
        settings.setProperty(
            runtime, "apply",
            native::makeFunction(
                runtime, "apply", 1,
                [store](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                        size_t count) -> jsi::Value {
                    if (count == 0 || !args[0].isObject() || !args[0].asObject(rt).isArray(rt))
                    {
                        throw jsi::JSError(rt, "settings.apply expects an array of changes");
                    }
                    return jsi::Value(store->apply(fromJSIValue(rt, args[0])));
                }));
        platform.setProperty(runtime, "settings", std::move(settings));
    }

    jsi::Object device(runtime);
    device.setProperty(runtime, "platform",
                       jsi::String::createFromUtf8(runtime, provider->platform));
    device.setProperty(runtime, "getDeviceModel",
                       stringGetter(runtime, "getDeviceModel", provider->deviceModel));
    device.setProperty(runtime, "getOSVersionString",
                       stringGetter(runtime, "getOSVersionString", provider->osVersion));
    device.setProperty(runtime, "isRooted", booleanGetter(runtime, "isRooted", provider->isRooted));
    device.setProperty(runtime, "isSystemApp",
                       booleanGetter(runtime, "isSystemApp", provider->isSystemApp));
    device.setProperty(runtime, "isVirtualDevice",
                       booleanGetter(runtime, "isVirtualDevice", provider->isVirtualDevice));
    platform.setProperty(runtime, "device", std::move(device));

    if (provider->platform == "ios")
    {
        jsi::Object ios(runtime);
        ios.setProperty(runtime, "isVerifiedBuild",
                        booleanGetter(runtime, "isVerifiedBuild", provider->isVerifiedBuild));
        ios.setProperty(runtime, "getEntitlements",
                        native::makeFunction(runtime, "getEntitlements", 0,
                                             [provider](jsi::Runtime &rt, const jsi::Value &,
                                                        const jsi::Value *, size_t) -> jsi::Value {
                                                 return toJSIValue(rt,
                                                                   provider->entitlements
                                                                       ? provider->entitlements()
                                                                       : nlohmann::json::object());
                                             }));
        ios.setProperty(
            runtime, "getEntitlementsAsPlist",
            stringGetter(runtime, "getEntitlementsAsPlist", provider->entitlementsAsPlist));
        platform.setProperty(runtime, "ios", std::move(ios));
    }

    jsi::Object app(runtime);
    app.setProperty(runtime, "getAppSource",
                    stringGetter(runtime, "getAppSource", provider->appSource));
    app.setProperty(runtime, "getFramework",
                    stringGetter(runtime, "getFramework", provider->framework));
    app.setProperty(runtime, "claimLaunchURL",
                    native::makeFunction(runtime, "claimLaunchURL", 0,
                                         [](jsi::Runtime &, const jsi::Value &, const jsi::Value *,
                                            size_t) -> jsi::Value {
                                             return jsi::Value(!launchURLClaimed.exchange(true));
                                         }));
    platform.setProperty(runtime, "app", std::move(app));

    if (!provider->documents.empty())
    {
        jsi::Object files(runtime);
        files.setProperty(
            runtime, "remove",
            native::makeFunction(runtime, "remove", 1,
                                 [provider](jsi::Runtime     &rt, const jsi::Value &,
                                            const jsi::Value *args, size_t count) -> jsi::Value {
                                     if (count == 0 || !args[0].isString())
                                     {
                                         return jsi::Value(false);
                                     }
                                     return jsi::Value(removeTree(provider->documents,
                                                                  args[0].getString(rt).utf8(rt)));
                                 }));
        platform.setProperty(runtime, "files", std::move(files));
        platform.setProperty(runtime, "crashGuard", crashGuardObject(runtime, provider->documents));
    }

    jsi::Object addons(runtime);
    addons.setProperty(
        runtime, "verify",
        native::makeFunction(
            runtime, "verify", 2,
            [](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
               size_t count) -> jsi::Value {
                jsi::Object result(rt);
                if (count < 2 || !args[0].isString() || !args[1].isString())
                {
                    result.setProperty(rt, "status", jsi::String::createFromAscii(rt, "invalid"));
                    result.setProperty(rt, "problem",
                                       jsi::String::createFromAscii(
                                           rt, "verify needs the manifest JSON and the bundle"));
                    return result;
                }
                nlohmann::json manifest =
                    nlohmann::json::parse(args[0].getString(rt).utf8(rt), nullptr, false);
                AddonSignatureResult signature =
                    manifest.is_object()
                        ? verifyAddonSignature(manifest, args[1].getString(rt).utf8(rt),
                                               compiledBundleTrust())
                        : AddonSignatureResult{AddonSignatureStatus::Invalid, TrustedSigner::None,
                                               "the manifest is not a JSON object"};
                result.setProperty(
                    rt, "status",
                    jsi::String::createFromAscii(rt, describeAddonSignature(signature.status)));
                if (signature.status == AddonSignatureStatus::Signed)
                {
                    result.setProperty(
                        rt, "signer",
                        jsi::String::createFromUtf8(
                            rt, describeSigner(signature.signer, compiledBundleTrust())));
                }
                if (!signature.problem.empty())
                {
                    result.setProperty(rt, "problem",
                                       jsi::String::createFromUtf8(rt, signature.problem));
                }
                return result;
            }));
    addons.setProperty(
        runtime, "evaluateBytecode",
        native::makeFunction(runtime, "evaluateBytecode", 2,
                             [provider](jsi::Runtime     &rt, const jsi::Value &,
                                        const jsi::Value *args, size_t count) -> jsi::Value {
                                 if (!provider || provider->documents.empty() || count < 2 ||
                                     !args[0].isString() || !args[1].isNumber())
                                 {
                                     return jsi::Value::undefined();
                                 }
                                 double requested = args[1].getNumber();
                                 if (!(requested > 0 && requested <= UINT32_MAX) ||
                                     requested != static_cast<uint32_t>(requested))
                                 {
                                     return jsi::Value::undefined();
                                 }
                                 std::string                folder = args[0].getString(rt).utf8(rt);
                                 std::optional<std::string> bytecode = readPluginBytecode(
                                     provider->documents, folder, static_cast<uint32_t>(requested));
                                 if (!bytecode)
                                 {
                                     return jsi::Value::undefined();
                                 }
                                 return evaluateBytecode(rt, std::move(*bytecode),
                                                         "unbound-plugin:" + folder);
                             }));
    platform.setProperty(runtime, "addons", std::move(addons));

    platform.setProperty(runtime, "platform",
                         jsi::String::createFromUtf8(runtime, provider->platform));
    runtime.global().setProperty(runtime, "NativePlatform", std::move(platform));
}

nlohmann::json debugEnvironment(const NativePlatformProvider &provider)
{
    std::optional<std::string> host =
        provider.virtualDeviceHost ? provider.virtualDeviceHost() : std::nullopt;
    return {{"isVirtualDevice", provider.isVirtualDevice && provider.isVirtualDevice()},
            {"hostAddress", host ? nlohmann::json(*host) : nlohmann::json(nullptr)},
            {"resources", native::nativeResourceCounts()}};
}

nlohmann::json currentDebugEnvironment()
{
    std::shared_ptr<NativePlatformProvider> provider = currentNativePlatformProvider();
    return debugEnvironment(provider ? *provider : NativePlatformProvider{});
}
}
