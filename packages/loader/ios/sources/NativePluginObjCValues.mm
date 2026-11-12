#import "NativePluginObjCValues.h"

#include <algorithm>
#import <objc/runtime.h>
#include <stdexcept>
#include <string>
#include <vector>

#import "CoreConversions.h"
#import "LoaderJSIJSON.h"
#import "NativeConversionBudget.h"
#import "NativeFFI.h"
#import "NativeStructLayouts.h"

using namespace facebook;
using namespace facebook::jsi;

namespace loader::ios {

std::atomic<size_t> &liveObjCHandles()
{
    static std::atomic<size_t> live{0};
    return live;
}

std::atomic<size_t> &liveObjCRetains()
{
    static std::atomic<size_t> live{0};
    return live;
}

namespace {
    class NativeDataBuffer final : public MutableBuffer
    {
    public:
        explicit NativeDataBuffer(NSData *value)
        {
            if (value.length == 0)
            {
                return;
            }

            const uint8_t *bytes = static_cast<const uint8_t *>(value.bytes);
            bytes_.assign(bytes, bytes + value.length);
        }

        size_t size() const override
        {
            return bytes_.size();
        }

        uint8_t *data() override
        {
            return bytes_.data();
        }

    private:
        std::vector<uint8_t> bytes_;
    };
}

using loader::ffi::PointerHost;

Value objcJSIValue(Runtime &runtime, id value)
{
    return loader::toJSIValue(runtime, unbound::ios::jsonFromObject(value));
}

NSString *jsiString(Runtime &runtime, const Value &value)
{
    return value.isString() ? unbound::ios::toNSString(value.asString(runtime).utf8(runtime)) : nil;
}

std::shared_ptr<ObjCHandleHost> objcHost(Runtime &runtime, const Value &value)
{
    if (!value.isObject())
    {
        return nullptr;
    }

    Object object = value.asObject(runtime);
    if (!object.isHostObject<ObjCHandleHost>(runtime))
    {
        return nullptr;
    }

    return object.getHostObject<ObjCHandleHost>(runtime);
}

id objcValue(Runtime &runtime, const Value &value)
{
    std::shared_ptr<ObjCHandleHost> host = objcHost(runtime, value);
    return host ? host->value() : nil;
}

Value objcHandleResult(Runtime &runtime, id value)
{
    if (!value)
    {
        return Value::null();
    }

    return Object::createFromHostObject(runtime, std::make_shared<ObjCHandleHost>(value));
}

Value pointerResult(Runtime &runtime, void *pointer)
{
    return loader::ffi::pointerValue(runtime, pointer);
}

namespace {
    struct ConversionState {
        explicit ConversionState(const NativeConversionProfile &profile = kNativeValueConversion)
            : budget(profile)
        {
        }

        NativeConversionBudget    budget;
        std::vector<const void *> nativePath;
        std::vector<Object>       javascriptPath;

        void enter(Runtime &runtime)
        {
            if (!budget.enter())
            {
                throw JSError(runtime, "Native value exceeds conversion limits");
            }
        }

        void addBytes(Runtime &runtime, size_t count)
        {
            if (!budget.addBytes(count))
            {
                throw JSError(runtime, "Native value exceeds conversion byte limit");
            }
        }

        void addString(Runtime &runtime, size_t count)
        {
            if (!budget.addString(count))
            {
                throw JSError(runtime, "Native value exceeds conversion string limit");
            }
        }

        void addName(Runtime &runtime, size_t count)
        {
            if (!budget.addName(count))
            {
                throw JSError(runtime, "Native value exceeds conversion name limit");
            }
        }

        void ensureEntries(Runtime &runtime, size_t count)
        {
            if (!budget.reserveEntries(count))
            {
                throw JSError(runtime, "Native value exceeds conversion limits");
            }
        }
    };

    struct ConversionGuard {
        explicit ConversionGuard(Runtime &runtime, ConversionState &state) : state(state)
        {
            state.enter(runtime);
        }

        ~ConversionGuard()
        {
            state.budget.leave();
        }

        ConversionState &state;
    };

    struct NativeConversionVisit {
        NativeConversionVisit(Runtime &runtime, ConversionState &state, id value) : state(state)
        {
            const void *identity = (__bridge const void *) value;
            if (std::find(state.nativePath.begin(), state.nativePath.end(), identity) !=
                state.nativePath.end())
            {
                throw JSError(runtime, "Native value contains a collection cycle");
            }
            state.nativePath.push_back(identity);
        }

        ~NativeConversionVisit()
        {
            state.nativePath.pop_back();
        }

        ConversionState &state;
    };

    struct JavaScriptConversionVisit {
        JavaScriptConversionVisit(Runtime &runtime, ConversionState &state, const Value &value)
            : state(state)
        {
            Object object = value.asObject(runtime);
            for (const Object &ancestor : state.javascriptPath)
            {
                if (Object::strictEquals(runtime, ancestor, object))
                {
                    throw JSError(runtime, "JavaScript value contains a collection cycle");
                }
            }
            state.javascriptPath.push_back(std::move(object));
        }

        ~JavaScriptConversionVisit()
        {
            state.javascriptPath.pop_back();
        }

        ConversionState &state;
    };
}

static Value objcResultValue(Runtime &runtime, id value, ConversionState &state)
{
    ConversionGuard guard(runtime, state);
    if (!value)
    {
        return Value::null();
    }

    if ([value isKindOfClass:[NSString class]])
    {
        state.addBytes(runtime,
                       [(NSString *) value lengthOfBytesUsingEncoding:NSUTF8StringEncoding]);
        return objcJSIValue(runtime, value);
    }

    if ([value isKindOfClass:[NSNumber class]])
    {
        NSNumber   *number = (NSNumber *) value;
        const char *type   = number.objCType;
        if (strcmp(type, @encode(long long)) == 0 || strcmp(type, @encode(long)) == 0)
        {
            int64_t integer = number.longLongValue;
            if (integer > 9007199254740991LL || integer < -9007199254740991LL)
            {
                return Value(runtime, BigInt::fromInt64(runtime, integer));
            }
        }
        if (strcmp(type, @encode(unsigned long long)) == 0 ||
            strcmp(type, @encode(unsigned long)) == 0)
        {
            uint64_t integer = number.unsignedLongLongValue;
            if (integer > 9007199254740991ULL)
            {
                return Value(runtime, BigInt::fromUint64(runtime, integer));
            }
        }
        return objcJSIValue(runtime, value);
    }

    if ([value isKindOfClass:[NSData class]])
    {
        state.addBytes(runtime, [(NSData *) value length]);
        auto        data = std::make_shared<NativeDataBuffer>((NSData *) value);
        ArrayBuffer buffer(runtime, data);
        return Uint8Array(runtime, buffer, 0, buffer.size(runtime));
    }

    if ([value isKindOfClass:[NSArray class]])
    {
        NativeConversionVisit visit(runtime, state, value);
        NSArray              *array = (NSArray *) value;
        state.ensureEntries(runtime, array.count);
        Array result(runtime, array.count);
        for (NSUInteger index = 0; index < array.count; index++)
        {
            result.setValueAtIndex(runtime, index, objcResultValue(runtime, array[index], state));
        }
        return result;
    }

    if ([value isKindOfClass:[NSDictionary class]])
    {
        NativeConversionVisit visit(runtime, state, value);
        NSDictionary         *dictionary = (NSDictionary *) value;
        state.ensureEntries(runtime, dictionary.count);
        Object result(runtime);
        for (id key in dictionary)
        {
            const char *name =
                [key isKindOfClass:[NSString class]] ? ((NSString *) key).UTF8String : nullptr;
            if (!name)
            {
                continue;
            }
            state.addBytes(runtime,
                           [(NSString *) key lengthOfBytesUsingEncoding:NSUTF8StringEncoding]);
            result.setProperty(runtime, PropNameID::forUtf8(runtime, std::string(name)),
                               objcResultValue(runtime, dictionary[key], state));
        }
        return result;
    }

    return Object::createFromHostObject(runtime, std::make_shared<ObjCHandleHost>(value));
}

Value objcResult(Runtime &runtime, id value)
{
    ConversionState state;
    return objcResultValue(runtime, value, state);
}

static id valueToObjCValue(Runtime &runtime, const Value &value, ConversionState &state)
{
    ConversionGuard guard(runtime, state);
    if (value.isNull() || value.isUndefined())
    {
        return [NSNull null];
    }

    if (value.isString())
    {
        NSString *string = jsiString(runtime, value);
        state.addString(runtime, [string lengthOfBytesUsingEncoding:NSUTF8StringEncoding]);
        return string ?: @"";
    }

    if (value.isBool())
    {
        return @(value.getBool());
    }

    if (value.isNumber())
    {
        return @(value.getNumber());
    }

    if (value.isBigInt())
    {
        BigInt bigint = value.asBigInt(runtime);
        if (runtime.bigintIsInt64(bigint))
        {
            return @((long long) runtime.truncate(bigint));
        }
        if (runtime.bigintIsUint64(bigint))
        {
            return @((unsigned long long) runtime.truncate(bigint));
        }
        throw JSError(runtime, "Native integer exceeds 64-bit range");
    }

    if (!value.isObject())
    {
        return [NSNull null];
    }

    Object object = value.asObject(runtime);
    if (std::shared_ptr<ObjCHandleHost> host = objcHost(runtime, value))
    {
        return host->value();
    }

    if (object.isHostObject<StructHost>(runtime))
    {
        return object.getHostObject<StructHost>(runtime)->value();
    }

    if (object.isHostObject<PointerHost>(runtime))
    {
        return [NSValue valueWithPointer:object.getHostObject<PointerHost>(runtime)->value()];
    }

    if (object.isArray(runtime))
    {
        JavaScriptConversionVisit visit(runtime, state, value);
        Array                     array = object.asArray(runtime);
        size_t                    count = array.size(runtime);
        state.ensureEntries(runtime, count);
        NSMutableArray *result = [NSMutableArray arrayWithCapacity:count];
        for (size_t index = 0; index < count; index++)
        {
            [result
                addObject:valueToObjCValue(runtime, array.getValueAtIndex(runtime, index), state)
                              ?: [NSNull null]];
        }
        return result;
    }

    JavaScriptConversionVisit visit(runtime, state, value);
    NSMutableDictionary      *result = [NSMutableDictionary dictionary];
    Array                     names  = object.getPropertyNames(runtime);
    size_t                    count  = names.size(runtime);
    state.ensureEntries(runtime, count);
    for (size_t index = 0; index < count; index++)
    {
        Value name = names.getValueAtIndex(runtime, index);
        if (!name.isString())
        {
            continue;
        }

        NSString *key = jsiString(runtime, name);
        if (key.length == 0)
        {
            continue;
        }

        state.addName(runtime, [key lengthOfBytesUsingEncoding:NSUTF8StringEncoding]);
        id item     = valueToObjCValue(runtime, object.getProperty(runtime, key.UTF8String), state);
        result[key] = item ?: [NSNull null];
    }
    return result;
}

id valueToObjC(Runtime &runtime, const Value &value)
{
    ConversionState state;
    return valueToObjCValue(runtime, value, state);
}

id valueToData(Runtime &runtime, const Value &value)
{
    if (!value.isObject())
    {
        return nil;
    }

    Object object = value.asObject(runtime);
    if (object.isArrayBuffer(runtime))
    {
        ArrayBuffer buffer = object.getArrayBuffer(runtime);
        return [NSData dataWithBytes:buffer.data(runtime) length:buffer.size(runtime)];
    }

    if (object.isTypedArray(runtime))
    {
        TypedArray  array  = object.getTypedArray(runtime);
        ArrayBuffer buffer = array.buffer(runtime);
        return [NSData dataWithBytes:buffer.data(runtime) + array.byteOffset(runtime)
                              length:array.byteLength(runtime)];
    }

    return nil;
}

Value structResult(Runtime &runtime, NSString *name, NSValue *value)
{
    return Object::createFromHostObject(runtime, std::make_shared<StructHost>(name, value));
}

Value structValue(Runtime &runtime, NSString *name, const Value &fields)
{
    const loader::native::StructLayout *layout =
        loader::native::structLayout(std::string(name.UTF8String ?: ""));
    if (!layout)
    {
        throw JSError(runtime, "Unsupported native struct");
    }
    std::vector<uint8_t> bytes;
    try
    {
        bytes = loader::native::structFromJS(runtime, *layout, fields);
    }
    catch (const std::invalid_argument &error)
    {
        throw JSError(runtime, error.what());
    }
    std::string encoding(layout->encoding);
    return structResult(runtime, name,
                        [NSValue valueWithBytes:bytes.data() objCType:encoding.c_str()]);
}

NSMutableArray *argumentArray(Runtime &runtime, const Array &values)
{
    NSMutableArray *arguments = [NSMutableArray arrayWithCapacity:values.size(runtime)];
    for (size_t index = 0; index < values.size(runtime); index++)
    {
        [arguments addObject:valueToObjC(runtime, values.getValueAtIndex(runtime, index))
                                 ?: [NSNull null]];
    }
    return arguments;
}

NSArray *argumentArray(Runtime &runtime, const Value *args, size_t count, size_t start)
{
    NSMutableArray *arguments = [NSMutableArray arrayWithCapacity:count - start];
    for (size_t index = start; index < count; index++)
    {
        const Value &value = args[index];
        if (value.isObject() && value.asObject(runtime).isHostObject<ObjCHandleHost>(runtime))
        {
            [arguments addObject:objcValue(runtime, value) ?: [NSNull null]];
        }
        else
        {
            [arguments addObject:valueToObjC(runtime, value) ?: [NSNull null]];
        }
    }
    return arguments;
}

Class classFromValue(Runtime &runtime, const Value &value)
{
    id object = objcValue(runtime, value);
    if (object && object_isClass(object))
    {
        return object;
    }

    if (value.isString())
    {
        NSString *name = jsiString(runtime, value);
        return NSClassFromString(name);
    }

    return Nil;
}

Value StructHost::get(Runtime &runtime, const PropNameID &name)
{
    std::string property = name.utf8(runtime);
    if (property == "name")
    {
        return String::createFromUtf8(runtime, name_.UTF8String ?: "");
    }
    if (property == "value")
    {
        return structFields(runtime, name_, value_);
    }
    return Value::undefined();
}

Value structFields(Runtime &runtime, NSString *name, NSValue *value)
{
    const loader::native::StructLayout *layout =
        value ? loader::native::structLayoutForTypeName(std::string(name.UTF8String ?: ""))
              : nullptr;
    if (!layout)
    {
        return Value::undefined();
    }
    std::vector<uint8_t> bytes(layout->size);
    [value getValue:bytes.data() size:bytes.size()];
    return loader::native::structToJS(runtime, *layout, bytes.data());
}
}
