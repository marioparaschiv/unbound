#include "NativeFFI.h"

#include <dlfcn.h>
#include <mutex>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

#include "NativeAddressValidation.h"

namespace jsi = facebook::jsi;

namespace loader::ffi {
namespace {
    std::mutex          platformMutex;
    PointerResolver     platformPointerResolver;
    StructResultFactory platformStructResultFactory;

    PointerResolver currentPointerResolver()
    {
        std::lock_guard<std::mutex> lock(platformMutex);
        return platformPointerResolver;
    }

    StructResultFactory currentStructResultFactory()
    {
        std::lock_guard<std::mutex> lock(platformMutex);
        return platformStructResultFactory;
    }

    std::string typeName(jsi::Runtime &runtime, const jsi::Value &value)
    {
        if (value.isString())
        {
            return value.getString(runtime).utf8(runtime);
        }
        if (value.isObject())
        {
            jsi::Object object     = value.asObject(runtime);
            jsi::Value  structName = object.getProperty(runtime, "struct");
            if (structName.isString())
            {
                return "struct:" + structName.getString(runtime).utf8(runtime);
            }
            jsi::Value name = object.getProperty(runtime, "type");
            if (name.isString())
            {
                return name.getString(runtime).utf8(runtime);
            }
        }
        throw std::invalid_argument("Native FFI type must be a string or type object");
    }

    Signature parseSignature(jsi::Runtime &runtime, const jsi::Value &value)
    {
        if (!value.isObject())
        {
            throw std::invalid_argument("ffi.call expects a signature object");
        }
        jsi::Object signature = value.asObject(runtime);
        jsi::Value  result    = signature.getProperty(runtime, "returnType");
        if (result.isUndefined())
        {
            result = signature.getProperty(runtime, "returns");
        }
        if (result.isUndefined())
        {
            throw std::invalid_argument("Native FFI signature is missing returnType");
        }
        jsi::Value arguments = signature.getProperty(runtime, "args");
        if (!arguments.isObject() || !arguments.asObject(runtime).isArray(runtime))
        {
            throw std::invalid_argument("Native FFI signature is missing args");
        }

        jsi::Array        list = arguments.asObject(runtime).asArray(runtime);
        std::vector<Type> types;
        types.reserve(list.size(runtime));
        for (std::size_t index = 0; index < list.size(runtime); index++)
        {
            types.push_back(resolveType(typeName(runtime, list.getValueAtIndex(runtime, index))));
        }
        return makeSignature(resolveType(typeName(runtime, result)), std::move(types));
    }

    std::optional<void *> resolvedPointer(jsi::Runtime &runtime, const jsi::Value &value)
    {
        if (value.isNull() || value.isUndefined())
        {
            return nullptr;
        }
        if (auto host = pointerHost(runtime, value))
        {
            return host->value();
        }
        if (value.isObject())
        {
            if (PointerResolver resolver = currentPointerResolver())
            {
                return resolver(runtime, value.asObject(runtime));
            }
        }
        return std::nullopt;
    }

    NativeValue nativeValue(jsi::Runtime &runtime, const jsi::Value &value, const Type &type);

    NativeValue nativeStruct(jsi::Runtime &runtime, const jsi::Value &value, const Type &type)
    {
        if (!value.isObject())
        {
            throw std::invalid_argument("Native FFI " + type.layout->name +
                                        " argument must be an object");
        }
        jsi::Object object = value.asObject(runtime);
        jsi::Value  inner  = object.getProperty(runtime, "value");
        if (inner.isObject() && object.getProperty(runtime, "name").isString())
        {
            object = inner.asObject(runtime);
        }

        NativeFields fields;
        fields.reserve(type.layout->fields.size());
        for (const StructField &field : type.layout->fields)
        {
            jsi::Value fieldValue = object.getProperty(runtime, field.name.c_str());
            if (fieldValue.isUndefined())
            {
                throw std::invalid_argument("Native FFI " + type.layout->name + " is missing " +
                                            field.name);
            }
            fields.push_back(nativeValue(runtime, fieldValue, field.type));
        }
        return {std::move(fields)};
    }

    NativeValue nativeBigInt(jsi::Runtime &runtime, const jsi::Value &value, const Type &type)
    {
        jsi::BigInt number = value.getBigInt(runtime);
        if (number.isInt64(runtime))
        {
            return {number.getInt64(runtime)};
        }
        if (number.isUint64(runtime))
        {
            return {number.getUint64(runtime)};
        }
        throw std::invalid_argument("Native FFI " + type.name + " argument is out of range");
    }

    NativeValue nativeValue(jsi::Runtime &runtime, const jsi::Value &value, const Type &type)
    {
        switch (type.kind)
        {
            case Kind::Struct:
                return nativeStruct(runtime, value, type);
            case Kind::Pointer:
                if (std::optional<void *> pointer = resolvedPointer(runtime, value))
                {
                    return *pointer ? NativeValue{NativeAddress{*pointer}} : NativeValue{};
                }
                throw std::invalid_argument("Native FFI pointer argument expected");
            case Kind::CString:
                if (value.isNull() || value.isUndefined())
                {
                    return {};
                }
                if (!value.isString())
                {
                    throw std::invalid_argument("Native FFI cstring argument expected");
                }
                return {value.getString(runtime).utf8(runtime)};
            case Kind::Bool:
                if (!value.isBool())
                {
                    throw std::invalid_argument("Native FFI boolean argument expected");
                }
                return {value.getBool()};
            default:
                break;
        }

        if (value.isNumber())
        {
            return {value.getNumber()};
        }
        if (value.isBigInt() && (type.kind == Kind::Int64 || type.kind == Kind::UInt64))
        {
            return nativeBigInt(runtime, value, type);
        }
        throw std::invalid_argument("Native FFI " + type.name + " argument is out of range");
    }

    jsi::Value javaScriptValue(jsi::Runtime &runtime, const Type &type, const NativeValue &value);

    jsi::Object structFields(jsi::Runtime &runtime, const StructLayout &layout,
                             const NativeFields &fields)
    {
        jsi::Object result(runtime);
        for (std::size_t index = 0; index < layout.fields.size(); index++)
        {
            const StructField &field = layout.fields[index];
            result.setProperty(runtime, field.name.c_str(),
                               javaScriptValue(runtime, field.type, fields[index]));
        }
        return result;
    }

    jsi::Value javaScriptValue(jsi::Runtime &runtime, const Type &type, const NativeValue &value)
    {
        if (std::holds_alternative<std::monostate>(value.data))
        {
            return type.kind == Kind::Void ? jsi::Value::undefined() : jsi::Value::null();
        }
        if (const auto *flag = std::get_if<bool>(&value.data))
        {
            return jsi::Value(*flag);
        }
        if (const auto *number = std::get_if<double>(&value.data))
        {
            return jsi::Value(*number);
        }
        if (const auto *number = std::get_if<std::int64_t>(&value.data))
        {
            return jsi::BigInt::fromInt64(runtime, *number);
        }
        if (const auto *number = std::get_if<std::uint64_t>(&value.data))
        {
            return jsi::BigInt::fromUint64(runtime, *number);
        }
        if (const auto *string = std::get_if<std::string>(&value.data))
        {
            return jsi::String::createFromUtf8(runtime, *string);
        }
        if (const auto *address = std::get_if<NativeAddress>(&value.data))
        {
            return pointerValue(runtime, address->value, false);
        }
        return structFields(runtime, *type.layout, std::get<NativeFields>(value.data));
    }

    jsi::Value structResult(jsi::Runtime &runtime, const Type &type, const std::uint8_t *source)
    {
        if (StructResultFactory factory = currentStructResultFactory())
        {
            if (std::optional<jsi::Value> result = factory(runtime, *type.layout, source))
            {
                return std::move(*result);
            }
        }

        jsi::Object result(runtime);
        result.setProperty(runtime, "name",
                           jsi::String::createFromUtf8(runtime, type.layout->name));
        result.setProperty(runtime, "value",
                           javaScriptValue(runtime, type, decodeValue(type, source)));
        return result;
    }
}

void setPointerResolver(PointerResolver resolver)
{
    std::lock_guard<std::mutex> lock(platformMutex);
    platformPointerResolver = std::move(resolver);
}

void setStructResultFactory(StructResultFactory factory)
{
    std::lock_guard<std::mutex> lock(platformMutex);
    platformStructResultFactory = std::move(factory);
}

Type resolveType(const std::string &name)
{
    std::optional<Type> type = parseType(name);
    if (!type)
    {
        throw std::invalid_argument("Unsupported native FFI type " + name + " on this platform");
    }
    return *type;
}

jsi::Value pointerValue(jsi::Runtime &runtime, void *pointer, bool callable)
{
    if (!pointer)
    {
        return jsi::Value::null();
    }
    return jsi::Object::createFromHostObject(runtime,
                                             std::make_shared<PointerHost>(pointer, callable));
}

std::shared_ptr<PointerHost> pointerHost(jsi::Runtime &runtime, const jsi::Value &value)
{
    if (!value.isObject())
    {
        return nullptr;
    }
    jsi::Object object = value.asObject(runtime);
    if (!object.isHostObject<PointerHost>(runtime))
    {
        return nullptr;
    }
    return object.getHostObject<PointerHost>(runtime);
}

void writeValue(jsi::Runtime &runtime, const jsi::Value &value, const Type &type,
                std::uint8_t *target, ArgumentStorage &storage)
{
    if (type.kind == Kind::Extension)
    {
        type.codec->write(runtime, value, target, storage);
        return;
    }
    if (type.kind == Kind::Void)
    {
        return;
    }
    encodeValue(type, nativeValue(runtime, value, type), target, storage);
}

jsi::Value readValue(jsi::Runtime &runtime, const Type &type, const std::uint8_t *source)
{
    switch (type.kind)
    {
        case Kind::Void:
            return jsi::Value::undefined();
        case Kind::Extension:
            return type.codec->read(runtime, source);
        case Kind::Struct:
            return structResult(runtime, type, source);
        default:
            return javaScriptValue(runtime, type, decodeValue(type, source));
    }
}

jsi::Value lookupSymbol(jsi::Runtime &runtime, const jsi::Value *args, std::size_t count)
{
    if (count == 0 || !args[0].isString())
    {
        throw std::invalid_argument("ffi.symbol expects a symbol name");
    }
    std::string name   = args[0].getString(runtime).utf8(runtime);
    void       *handle = RTLD_DEFAULT;
    bool        opened = false;
    if (count > 1 && args[1].isString())
    {
        std::string image = args[1].getString(runtime).utf8(runtime);
        handle            = dlopen(image.c_str(), RTLD_NOLOAD | RTLD_LAZY);
        if (!handle)
        {
            throw std::invalid_argument("ffi.symbol image is not loaded");
        }
        opened = true;
    }

    void *symbol = dlsym(handle, name.c_str());
    if (opened)
    {
        dlclose(handle);
    }
    return pointerValue(runtime, symbol, true);
}

jsi::Value callFunction(jsi::Runtime &runtime, const jsi::Value *args, std::size_t count)
{
    if (count < 2)
    {
        throw std::invalid_argument("ffi.call expects a pointer, signature, and arguments");
    }
    std::shared_ptr<PointerHost> host = pointerHost(runtime, args[0]);
    if (!host)
    {
        throw std::invalid_argument("ffi.call expects a pointer handle");
    }
    if (!host->callable() || !isCallableSymbolAddress(host->value()))
    {
        throw std::invalid_argument("ffi.call requires an executable symbol pointer");
    }

    Signature signature = parseSignature(runtime, args[1]);
    if (signature.arguments.size() != count - 2)
    {
        throw std::invalid_argument("Native FFI argument count does not match the signature");
    }

    CallFrame frame(callInterface(signature.result, signature.arguments));
    for (std::size_t index = 0; index < signature.arguments.size(); index++)
    {
        writeValue(runtime, args[index + 2], signature.arguments[index], frame.argument(index),
                   frame.storage());
    }
    frame.invoke(host->value());
    return readValue(runtime, signature.result, frame.result());
}
}
