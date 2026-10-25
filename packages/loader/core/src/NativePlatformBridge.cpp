#include "NativePlatformBridge.h"

#include "LoaderFiles.h"
#include "LoaderJSI.h"

namespace loader
{
    namespace jsi = facebook::jsi;

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
                return jsi::String::createFromUtf8(runtime, value.get<std::string>());
            case nlohmann::json::value_t::array:
            {
                jsi::Array array(runtime, value.size());
                for (size_t index = 0; index < value.size(); index++)
                {
                    array.setValueAtIndex(runtime, index, toJSIValue(runtime, value[index]));
                }
                return array;
            }
            case nlohmann::json::value_t::object:
            {
                jsi::Object object(runtime);
                for (auto entry = value.begin(); entry != value.end(); ++entry)
                {
                    object.setProperty(runtime, entry.key().c_str(), toJSIValue(runtime, entry.value()));
                }
                return object;
            }
            case nlohmann::json::value_t::binary:
                return jsi::Value::undefined();
        }
        return jsi::Value::undefined();
    }

    nlohmann::json fromJSIValue(jsi::Runtime &runtime, const jsi::Value &value)
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

        jsi::Object object = value.getObject(runtime);
        if (object.isArray(runtime))
        {
            jsi::Array     array  = object.getArray(runtime);
            nlohmann::json result = nlohmann::json::array();
            for (size_t index = 0; index < array.size(runtime); index++)
            {
                result.push_back(fromJSIValue(runtime, array.getValueAtIndex(runtime, index)));
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
            result[name]     = fromJSIValue(runtime, object.getProperty(runtime, name.c_str()));
        }
        return result;
    }

    jsi::Function makeHostFunction(jsi::Runtime &runtime, const char *name,
                                   unsigned int argumentCount, jsi::HostFunctionType handler)
    {
        return jsi::Function::createFromHostFunction(runtime, jsi::PropNameID::forUtf8(runtime, name),
                                                     argumentCount, std::move(handler));
    }

    template <typename Provider>
    static jsi::Function stringGetter(jsi::Runtime &runtime, const char *name, Provider provider)
    {
        return makeHostFunction(runtime, name, 0,
                                [provider](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *,
                                           size_t) -> jsi::Value {
                                    return jsi::String::createFromUtf8(rt, provider ? provider() : "");
                                });
    }

    template <typename Provider>
    static jsi::Function booleanGetter(jsi::Runtime &runtime, const char *name, Provider provider)
    {
        return makeHostFunction(
            runtime, name, 0,
            [provider](jsi::Runtime &, const jsi::Value &, const jsi::Value *, size_t) -> jsi::Value {
                return jsi::Value(provider ? provider() : false);
            });
    }

    void installNativePlatform(jsi::Runtime &runtime, std::shared_ptr<NativePlatformProvider> provider)
    {
        jsi::Object platform(runtime);

        platform.setProperty(
            runtime, "evaluateBytecode",
            makeHostFunction(runtime, "evaluateBytecode", 2,
                             [](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                                size_t count) -> jsi::Value {
                                 if (count == 0 || !args[0].isObject() ||
                                     !args[0].asObject(rt).isArrayBuffer(rt))
                                 {
                                     throw jsi::JSError(rt, "evaluateBytecode expects an ArrayBuffer "
                                                            "of Hermes bytecode as its first argument");
                                 }

                                 jsi::ArrayBuffer buffer = args[0].asObject(rt).getArrayBuffer(rt);
                                 std::string bytecode(reinterpret_cast<const char *>(buffer.data(rt)),
                                                      buffer.size(rt));
                                 std::string tag = count > 1 && args[1].isString()
                                                       ? args[1].getString(rt).utf8(rt)
                                                       : "NativePlatform.evaluateBytecode";
                                 return evaluateBytecode(rt, std::move(bytecode), tag);
                             }));

        jsi::Object device(runtime);
        device.setProperty(runtime, "platform", jsi::String::createFromUtf8(runtime, provider->platform));
        device.setProperty(runtime, "getDeviceModel",
                           stringGetter(runtime, "getDeviceModel", provider->deviceModel));
        device.setProperty(runtime, "getOSVersionString",
                           stringGetter(runtime, "getOSVersionString", provider->osVersion));
        device.setProperty(runtime, "isRooted",
                           booleanGetter(runtime, "isRooted", provider->isRooted));
        device.setProperty(runtime, "isSystemApp",
                           booleanGetter(runtime, "isSystemApp", provider->isSystemApp));
        platform.setProperty(runtime, "device", std::move(device));

        if (provider->platform == "ios")
        {
            jsi::Object ios(runtime);
            ios.setProperty(runtime, "isVerifiedBuild",
                            booleanGetter(runtime, "isVerifiedBuild", provider->isVerifiedBuild));
            ios.setProperty(
                runtime, "getEntitlements",
                makeHostFunction(runtime, "getEntitlements", 0,
                                 [provider](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *,
                                            size_t) -> jsi::Value {
                                     return toJSIValue(rt, provider->entitlements
                                                               ? provider->entitlements()
                                                               : nlohmann::json::object());
                                 }));
            ios.setProperty(runtime, "getEntitlementsAsPlist",
                            stringGetter(runtime, "getEntitlementsAsPlist",
                                         provider->entitlementsAsPlist));
            platform.setProperty(runtime, "ios", std::move(ios));
        }

        jsi::Object app(runtime);
        app.setProperty(runtime, "getAppSource",
                        stringGetter(runtime, "getAppSource", provider->appSource));
        platform.setProperty(runtime, "app", std::move(app));

        if (!provider->documents.empty())
        {
            jsi::Object files(runtime);
            files.setProperty(
                runtime, "remove",
                makeHostFunction(runtime, "remove", 1,
                                 [provider](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                                            size_t count) -> jsi::Value {
                                     if (count == 0 || !args[0].isString())
                                     {
                                         return jsi::Value(false);
                                     }
                                     return jsi::Value(
                                         removeTree(provider->documents, args[0].getString(rt).utf8(rt)));
                                 }));
            platform.setProperty(runtime, "files", std::move(files));
        }

        platform.setProperty(runtime, "platform", jsi::String::createFromUtf8(runtime, provider->platform));
        runtime.global().setProperty(runtime, "NativePlatform", std::move(platform));
    }
}
