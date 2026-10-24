#include "NativeFFI.h"

#include <dlfcn.h>
#include <ffi.h>

#include <algorithm>
#include <cstdint>
#include <cstring>
#include <map>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <vector>

#include "NativeFFITypes.h"
#include "NativeNumericValidation.h"

namespace jsi = facebook::jsi;

namespace loader::ffi
{
    namespace
    {
        constexpr std::size_t kMaximumArguments = 16;

        class PointerHost final : public jsi::HostObject
        {
        public:
            PointerHost(void *value, bool callable) : value_(value), callable_(callable) {}

            void *value() const
            {
                return value_;
            }

            bool callable() const
            {
                return callable_;
            }

        private:
            void *value_;
            bool  callable_;
        };

        struct StructType
        {
            ffi_type               type{};
            std::vector<ffi_type *> elements;
        };

        std::recursive_mutex                                       structTypeMutex;
        std::map<const StructLayout *, std::unique_ptr<StructType>> structTypes;

        ffi_type *libffiType(const Type &type);

        ffi_type *structType(const StructLayout *layout)
        {
            std::lock_guard<std::recursive_mutex> lock(structTypeMutex);
            auto                                  existing = structTypes.find(layout);
            if (existing != structTypes.end())
            {
                return &existing->second->type;
            }

            auto created = std::make_unique<StructType>();
            for (const StructField &field : layout->fields)
            {
                created->elements.push_back(libffiType(field.type));
            }
            created->elements.push_back(nullptr);
            created->type.type      = FFI_TYPE_STRUCT;
            created->type.elements  = created->elements.data();
            ffi_type *result        = &created->type;
            structTypes[layout]     = std::move(created);
            return result;
        }

        ffi_type *libffiType(const Type &type)
        {
            switch (type.kind)
            {
            case Kind::Void:
                return &ffi_type_void;
            case Kind::Bool:
            case Kind::UInt8:
                return &ffi_type_uint8;
            case Kind::Int8:
                return &ffi_type_sint8;
            case Kind::Int16:
                return &ffi_type_sint16;
            case Kind::UInt16:
                return &ffi_type_uint16;
            case Kind::Int32:
                return &ffi_type_sint32;
            case Kind::UInt32:
                return &ffi_type_uint32;
            case Kind::Int64:
                return &ffi_type_sint64;
            case Kind::UInt64:
                return &ffi_type_uint64;
            case Kind::Float:
                return &ffi_type_float;
            case Kind::Double:
                return &ffi_type_double;
            case Kind::CString:
            case Kind::Pointer:
                return &ffi_type_pointer;
            case Kind::Struct:
                return structType(type.layout);
            }
            throw std::invalid_argument("Unsupported native FFI type");
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

        Type parseValueType(jsi::Runtime &runtime, const jsi::Value &value)
        {
            std::string         name = typeName(runtime, value);
            std::optional<Type> type = parseType(name);
            if (!type)
            {
                throw std::invalid_argument("Unsupported native FFI type " + name + " on this platform");
            }
            return *type;
        }

        struct Signature
        {
            Type              result;
            std::vector<Type> arguments;
        };

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

            Signature  parsed{parseValueType(runtime, result), {}};
            jsi::Array list = arguments.asObject(runtime).asArray(runtime);
            if (list.size(runtime) > kMaximumArguments)
            {
                throw std::invalid_argument("Native FFI signatures take at most 16 arguments");
            }
            for (std::size_t index = 0; index < list.size(runtime); index++)
            {
                Type argument = parseValueType(runtime, list.getValueAtIndex(runtime, index));
                if (argument.kind == Kind::Void)
                {
                    throw std::invalid_argument("Native FFI arguments cannot be void");
                }
                parsed.arguments.push_back(argument);
            }
            return parsed;
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

        jsi::Value pointerValue(jsi::Runtime &runtime, void *pointer, bool callable)
        {
            if (!pointer)
            {
                return jsi::Value::null();
            }
            return jsi::Object::createFromHostObject(runtime, std::make_shared<PointerHost>(pointer, callable));
        }

        template <typename T> void store(uint8_t *target, T value)
        {
            std::memcpy(target, &value, sizeof(value));
        }

        template <typename T> T load(const uint8_t *source)
        {
            T value;
            std::memcpy(&value, source, sizeof(value));
            return value;
        }

        double numericArgument(jsi::Runtime &runtime, const jsi::Value &value, const Type &type)
        {
            if (!value.isNumber() || !validNativeNumericValue(value.getNumber(), type.name))
            {
                throw std::invalid_argument("Native FFI " + type.name + " argument is out of range");
            }
            return value.getNumber();
        }

        uint64_t wideArgument(jsi::Runtime &runtime, const jsi::Value &value, const Type &type)
        {
            if (value.isBigInt())
            {
                jsi::BigInt number = value.getBigInt(runtime);
                if (type.kind == Kind::Int64)
                {
                    if (!number.isInt64(runtime))
                    {
                        throw std::invalid_argument("Native FFI i64 argument is out of range");
                    }
                    return static_cast<uint64_t>(number.getInt64(runtime));
                }
                if (!number.isUint64(runtime))
                {
                    throw std::invalid_argument("Native FFI u64 argument is out of range");
                }
                return number.getUint64(runtime);
            }
            double number = numericArgument(runtime, value, type);
            return type.kind == Kind::Int64 ? static_cast<uint64_t>(static_cast<int64_t>(number))
                                            : static_cast<uint64_t>(number);
        }

        void writeValue(jsi::Runtime &runtime, const jsi::Value &value, const Type &type, uint8_t *target,
                        std::vector<std::string> &strings)
        {
            switch (type.kind)
            {
            case Kind::Void:
                return;
            case Kind::Bool:
                if (!value.isBool())
                {
                    throw std::invalid_argument("Native FFI boolean argument expected");
                }
                store<uint8_t>(target, value.getBool() ? 1 : 0);
                return;
            case Kind::Int8:
                store<int8_t>(target, static_cast<int8_t>(numericArgument(runtime, value, type)));
                return;
            case Kind::UInt8:
                store<uint8_t>(target, static_cast<uint8_t>(numericArgument(runtime, value, type)));
                return;
            case Kind::Int16:
                store<int16_t>(target, static_cast<int16_t>(numericArgument(runtime, value, type)));
                return;
            case Kind::UInt16:
                store<uint16_t>(target, static_cast<uint16_t>(numericArgument(runtime, value, type)));
                return;
            case Kind::Int32:
                store<int32_t>(target, static_cast<int32_t>(numericArgument(runtime, value, type)));
                return;
            case Kind::UInt32:
                store<uint32_t>(target, static_cast<uint32_t>(numericArgument(runtime, value, type)));
                return;
            case Kind::Int64:
            case Kind::UInt64:
                store<uint64_t>(target, wideArgument(runtime, value, type));
                return;
            case Kind::Float:
                store<float>(target, static_cast<float>(numericArgument(runtime, value, type)));
                return;
            case Kind::Double:
                store<double>(target, numericArgument(runtime, value, type));
                return;
            case Kind::CString:
                if (value.isNull() || value.isUndefined())
                {
                    store<const char *>(target, nullptr);
                    return;
                }
                if (!value.isString())
                {
                    throw std::invalid_argument("Native FFI cstring argument expected");
                }
                strings.push_back(value.getString(runtime).utf8(runtime));
                store<const char *>(target, strings.back().c_str());
                return;
            case Kind::Pointer:
                if (value.isNull() || value.isUndefined())
                {
                    store<void *>(target, nullptr);
                    return;
                }
                if (auto host = pointerHost(runtime, value))
                {
                    store<void *>(target, host->value());
                    return;
                }
                throw std::invalid_argument("Native FFI pointer argument expected");
            case Kind::Struct:
            {
                if (!value.isObject())
                {
                    throw std::invalid_argument("Native FFI " + type.layout->name + " argument must be an object");
                }
                jsi::Object object = value.asObject(runtime);
                jsi::Value  inner  = object.getProperty(runtime, "value");
                if (inner.isObject() && object.getProperty(runtime, "name").isString())
                {
                    object = inner.asObject(runtime);
                }
                for (const StructField &field : type.layout->fields)
                {
                    jsi::Value fieldValue = object.getProperty(runtime, field.name.c_str());
                    if (fieldValue.isUndefined())
                    {
                        throw std::invalid_argument("Native FFI " + type.layout->name + " is missing " + field.name);
                    }
                    writeValue(runtime, fieldValue, field.type, target + field.offset, strings);
                }
                return;
            }
            }
        }

        jsi::Value readValue(jsi::Runtime &runtime, const Type &type, const uint8_t *source);

        jsi::Value readStruct(jsi::Runtime &runtime, const StructLayout *layout, const uint8_t *source)
        {
            jsi::Object fields(runtime);
            for (const StructField &field : layout->fields)
            {
                if (field.type.kind == Kind::Struct)
                {
                    fields.setProperty(runtime, field.name.c_str(),
                                       readStruct(runtime, field.type.layout, source + field.offset));
                }
                else
                {
                    fields.setProperty(runtime, field.name.c_str(), readValue(runtime, field.type, source + field.offset));
                }
            }
            return fields;
        }

        jsi::Value readValue(jsi::Runtime &runtime, const Type &type, const uint8_t *source)
        {
            switch (type.kind)
            {
            case Kind::Void:
                return jsi::Value::undefined();
            case Kind::Bool:
                return jsi::Value(load<uint8_t>(source) != 0);
            case Kind::Int8:
                return jsi::Value(static_cast<double>(load<int8_t>(source)));
            case Kind::UInt8:
                return jsi::Value(static_cast<double>(load<uint8_t>(source)));
            case Kind::Int16:
                return jsi::Value(static_cast<double>(load<int16_t>(source)));
            case Kind::UInt16:
                return jsi::Value(static_cast<double>(load<uint16_t>(source)));
            case Kind::Int32:
                return jsi::Value(static_cast<double>(load<int32_t>(source)));
            case Kind::UInt32:
                return jsi::Value(static_cast<double>(load<uint32_t>(source)));
            case Kind::Int64:
                return jsi::BigInt::fromInt64(runtime, load<int64_t>(source));
            case Kind::UInt64:
                return jsi::BigInt::fromUint64(runtime, load<uint64_t>(source));
            case Kind::Float:
                return jsi::Value(static_cast<double>(load<float>(source)));
            case Kind::Double:
                return jsi::Value(load<double>(source));
            case Kind::CString:
            {
                const char *string = load<const char *>(source);
                return string ? jsi::Value(jsi::String::createFromUtf8(runtime, string)) : jsi::Value::null();
            }
            case Kind::Pointer:
                return pointerValue(runtime, load<void *>(source), false);
            case Kind::Struct:
            {
                jsi::Object result(runtime);
                result.setProperty(runtime, "name", jsi::String::createFromUtf8(runtime, type.layout->name));
                result.setProperty(runtime, "value", readStruct(runtime, type.layout, source));
                return result;
            }
            }
            return jsi::Value::undefined();
        }

        bool isLoadedCode(void *address)
        {
            Dl_info info{};
            return dladdr(address, &info) != 0 && info.dli_fbase != nullptr;
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
        if (!host->callable() || !isLoadedCode(host->value()))
        {
            throw std::invalid_argument("ffi.call requires an executable symbol pointer");
        }

        Signature signature = parseSignature(runtime, args[1]);
        if (signature.arguments.size() != count - 2)
        {
            throw std::invalid_argument("Native FFI argument count does not match the signature");
        }

        std::vector<std::vector<uint64_t>> storage(signature.arguments.size());
        std::vector<void *>                values(signature.arguments.size());
        std::vector<ffi_type *>            types(signature.arguments.size());
        std::vector<std::string>           strings;
        strings.reserve(signature.arguments.size() * 4);
        for (std::size_t index = 0; index < signature.arguments.size(); index++)
        {
            const Type &type = signature.arguments[index];
            storage[index].assign((typeSize(type) + sizeof(uint64_t) - 1) / sizeof(uint64_t) + 1, 0);
            auto *bytes = reinterpret_cast<uint8_t *>(storage[index].data());
            writeValue(runtime, args[index + 2], type, bytes, strings);
            values[index] = bytes;
            types[index]  = libffiType(type);
        }

        ffi_cif cif{};
        if (ffi_prep_cif(&cif, FFI_DEFAULT_ABI, static_cast<unsigned>(types.size()), libffiType(signature.result),
                         types.data()) != FFI_OK)
        {
            throw std::invalid_argument("Native FFI signature could not be prepared");
        }

        std::vector<uint64_t> result((std::max(typeSize(signature.result), sizeof(ffi_arg)) + 7) / 8 + 1, 0);
        ffi_call(&cif, reinterpret_cast<void (*)()>(host->value()),
                 signature.result.kind == Kind::Void ? nullptr : result.data(), values.data());
        return readValue(runtime, signature.result, reinterpret_cast<const uint8_t *>(result.data()));
    }
}
