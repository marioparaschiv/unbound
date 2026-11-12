#import "NativePluginFFICodecs.h"

#import <Foundation/Foundation.h>
#include <memory>
#include <mutex>
#import <objc/runtime.h>
#include <optional>
#include <stdexcept>

#import "NativeFFI.h"
#import "NativePluginObjCValues.h"
#import "NativeTypeEncoding.h"

using namespace facebook;
using namespace facebook::jsi;

namespace loader::ios {
using loader::ffi::PointerHost;

namespace {
    class ObjectFFICodec final : public loader::ffi::TypeCodec
    {
    public:
        void write(Runtime &runtime, const Value &value, uint8_t *target,
                   loader::ffi::ArgumentStorage &storage) const override
        {
            if (value.isNull() || value.isUndefined())
            {
                storeNativeValue<void *>(target, nullptr);
                return;
            }
            if (std::shared_ptr<PointerHost> host = loader::ffi::pointerHost(runtime, value))
            {
                storeNativeValue<void *>(target, host->value());
                return;
            }
            id object = valueToObjC(runtime, value);
            storage.retain(std::make_shared<ObjCHandleHost>(object, liveObjCRetains()));
            storeNativeValue<void *>(target, (__bridge void *) object);
        }

        Value read(Runtime &runtime, const uint8_t *source) const override
        {
            return objcResult(runtime, (__bridge id) loadNativeValue<void *>(source));
        }
    };

    class ClassFFICodec final : public loader::ffi::TypeCodec
    {
    public:
        void write(Runtime &runtime, const Value &value, uint8_t *target,
                   loader::ffi::ArgumentStorage &) const override
        {
            if (value.isNull() || value.isUndefined())
            {
                storeNativeValue<void *>(target, nullptr);
                return;
            }
            if (std::shared_ptr<ObjCHandleHost> host = objcHost(runtime, value))
            {
                storeNativeValue<void *>(target, (__bridge void *) host->value());
                return;
            }
            if (std::shared_ptr<PointerHost> host = loader::ffi::pointerHost(runtime, value))
            {
                storeNativeValue<void *>(target, host->value());
                return;
            }
            throw std::invalid_argument("Native FFI class argument expected");
        }

        Value read(Runtime &runtime, const uint8_t *source) const override
        {
            return objcResult(runtime, (__bridge id) loadNativeValue<void *>(source));
        }
    };

    class SelectorFFICodec final : public loader::ffi::TypeCodec
    {
    public:
        void write(Runtime &runtime, const Value &value, uint8_t *target,
                   loader::ffi::ArgumentStorage &) const override
        {
            if (value.isNull() || value.isUndefined())
            {
                storeNativeValue<SEL>(target, NULL);
                return;
            }
            if (value.isString())
            {
                storeNativeValue<SEL>(target, NSSelectorFromString(jsiString(runtime, value)));
                return;
            }
            if (std::shared_ptr<PointerHost> host = loader::ffi::pointerHost(runtime, value))
            {
                storeNativeValue<void *>(target, host->value());
                return;
            }
            throw std::invalid_argument("Native FFI selector argument expected");
        }

        Value read(Runtime &runtime, const uint8_t *source) const override
        {
            SEL selector = loadNativeValue<SEL>(source);
            return selector ? Value(String::createFromUtf8(runtime, sel_getName(selector)))
                            : Value::null();
        }
    };
}

static std::optional<void *> objcFFIPointer(Runtime &runtime, const Object &object)
{
    if (!object.isHostObject<ObjCHandleHost>(runtime))
    {
        return std::nullopt;
    }
    return (__bridge void *) object.getHostObject<ObjCHandleHost>(runtime)->value();
}

static std::optional<Value> objcFFIStructResult(Runtime                         &runtime,
                                                const loader::ffi::StructLayout &layout,
                                                const uint8_t                   *source)
{
    const char *encoding = nativeStructEncoding(layout.name);
    if (!encoding)
    {
        return std::nullopt;
    }
    return structResult(runtime, [NSString stringWithUTF8String:layout.name.c_str()] ?: @"",
                        [NSValue value:source withObjCType:encoding]);
}

void installFFIPlatform(void)
{
    static std::once_flag installed;
    std::call_once(installed, [] {
        loader::ffi::registerExtensionType("object", std::make_shared<ObjectFFICodec>());
        loader::ffi::registerExtensionType("class", std::make_shared<ClassFFICodec>());
        loader::ffi::registerExtensionType("selector", std::make_shared<SelectorFFICodec>());
        loader::ffi::setPointerResolver(objcFFIPointer);
        loader::ffi::setStructResultFactory(objcFFIStructResult);
    });
}
}
