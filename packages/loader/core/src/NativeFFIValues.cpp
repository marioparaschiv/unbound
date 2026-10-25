#include "NativeFFIValues.h"

#include <algorithm>
#include <cstring>
#include <limits>
#include <stdexcept>

#include "NativeNumericValidation.h"

namespace loader::ffi {
namespace {
    template <typename T> void store(std::uint8_t *target, T value)
    {
        std::memcpy(target, &value, sizeof(value));
    }

    template <typename T> T load(const std::uint8_t *source)
    {
        T value;
        std::memcpy(&value, source, sizeof(value));
        return value;
    }

    std::invalid_argument outOfRange(const Type &type)
    {
        return std::invalid_argument("Native FFI " + type.name + " argument is out of range");
    }

    double numericArgument(const NativeValue &value, const Type &type)
    {
        const double *number = std::get_if<double>(&value.data);
        if (!number || !validNativeNumericValue(*number, type.name))
        {
            throw outOfRange(type);
        }
        return *number;
    }

    std::int64_t signedWideArgument(const NativeValue &value, const Type &type)
    {
        if (const auto *number = std::get_if<std::int64_t>(&value.data))
        {
            return *number;
        }
        if (const auto *number = std::get_if<std::uint64_t>(&value.data))
        {
            if (*number > static_cast<std::uint64_t>(std::numeric_limits<std::int64_t>::max()))
            {
                throw outOfRange(type);
            }
            return static_cast<std::int64_t>(*number);
        }
        return static_cast<std::int64_t>(numericArgument(value, type));
    }

    std::uint64_t unsignedWideArgument(const NativeValue &value, const Type &type)
    {
        if (const auto *number = std::get_if<std::uint64_t>(&value.data))
        {
            return *number;
        }
        if (const auto *number = std::get_if<std::int64_t>(&value.data))
        {
            if (*number < 0)
            {
                throw outOfRange(type);
            }
            return static_cast<std::uint64_t>(*number);
        }
        return static_cast<std::uint64_t>(numericArgument(value, type));
    }

    void encodeStruct(const Type &type, const NativeValue &value, std::uint8_t *target,
                      ArgumentStorage &storage)
    {
        const auto *fields = std::get_if<NativeFields>(&value.data);
        if (!fields)
        {
            throw std::invalid_argument("Native FFI " + type.layout->name +
                                        " argument must be an object");
        }
        if (fields->size() != type.layout->fields.size())
        {
            throw std::invalid_argument("Native FFI " + type.layout->name +
                                        " argument has the wrong layout");
        }
        std::memset(target, 0, type.layout->size);
        for (std::size_t index = 0; index < fields->size(); index++)
        {
            const StructField &field = type.layout->fields[index];
            encodeValue(field.type, (*fields)[index], target + field.offset, storage);
        }
    }
}

const char *ArgumentStorage::keep(std::string value)
{
    strings_.push_back(std::move(value));
    return strings_.back().c_str();
}

void ArgumentStorage::retain(std::shared_ptr<const void> value)
{
    retained_.push_back(std::move(value));
}

std::size_t valueStorageSize(const Type &type)
{
    return std::max(typeSize(type), sizeof(std::uint64_t));
}

void encodeValue(const Type &type, const NativeValue &value, std::uint8_t *target,
                 ArgumentStorage &storage)
{
    switch (type.kind)
    {
        case Kind::Void:
            return;
        case Kind::Bool: {
            const bool *flag = std::get_if<bool>(&value.data);
            if (!flag)
            {
                throw std::invalid_argument("Native FFI boolean argument expected");
            }
            store<std::uint8_t>(target, *flag ? 1 : 0);
            return;
        }
        case Kind::Int8:
            store<std::int8_t>(target, static_cast<std::int8_t>(numericArgument(value, type)));
            return;
        case Kind::UInt8:
            store<std::uint8_t>(target, static_cast<std::uint8_t>(numericArgument(value, type)));
            return;
        case Kind::Int16:
            store<std::int16_t>(target, static_cast<std::int16_t>(numericArgument(value, type)));
            return;
        case Kind::UInt16:
            store<std::uint16_t>(target, static_cast<std::uint16_t>(numericArgument(value, type)));
            return;
        case Kind::Int32:
            store<std::int32_t>(target, static_cast<std::int32_t>(numericArgument(value, type)));
            return;
        case Kind::UInt32:
            store<std::uint32_t>(target, static_cast<std::uint32_t>(numericArgument(value, type)));
            return;
        case Kind::Int64:
            store<std::int64_t>(target, signedWideArgument(value, type));
            return;
        case Kind::UInt64:
            store<std::uint64_t>(target, unsignedWideArgument(value, type));
            return;
        case Kind::Float:
            store<float>(target, static_cast<float>(numericArgument(value, type)));
            return;
        case Kind::Double:
            store<double>(target, numericArgument(value, type));
            return;
        case Kind::CString:
            if (std::holds_alternative<std::monostate>(value.data))
            {
                store<const char *>(target, nullptr);
                return;
            }
            if (const auto *string = std::get_if<std::string>(&value.data))
            {
                store<const char *>(target, storage.keep(*string));
                return;
            }
            throw std::invalid_argument("Native FFI cstring argument expected");
        case Kind::Pointer:
            if (std::holds_alternative<std::monostate>(value.data))
            {
                store<void *>(target, nullptr);
                return;
            }
            if (const auto *address = std::get_if<NativeAddress>(&value.data))
            {
                store<void *>(target, address->value);
                return;
            }
            throw std::invalid_argument("Native FFI pointer argument expected");
        case Kind::Struct:
            encodeStruct(type, value, target, storage);
            return;
        case Kind::Extension:
            throw std::invalid_argument("Native FFI " + type.name +
                                        " values are encoded by their platform codec");
    }
}

NativeValue decodeValue(const Type &type, const std::uint8_t *source)
{
    switch (type.kind)
    {
        case Kind::Void:
            return {};
        case Kind::Bool:
            return {load<std::uint8_t>(source) != 0};
        case Kind::Int8:
            return {static_cast<double>(load<std::int8_t>(source))};
        case Kind::UInt8:
            return {static_cast<double>(load<std::uint8_t>(source))};
        case Kind::Int16:
            return {static_cast<double>(load<std::int16_t>(source))};
        case Kind::UInt16:
            return {static_cast<double>(load<std::uint16_t>(source))};
        case Kind::Int32:
            return {static_cast<double>(load<std::int32_t>(source))};
        case Kind::UInt32:
            return {static_cast<double>(load<std::uint32_t>(source))};
        case Kind::Int64:
            return {load<std::int64_t>(source)};
        case Kind::UInt64:
            return {load<std::uint64_t>(source)};
        case Kind::Float:
            return {static_cast<double>(load<float>(source))};
        case Kind::Double:
            return {load<double>(source)};
        case Kind::CString: {
            const char *string = load<const char *>(source);
            return string ? NativeValue{std::string(string)} : NativeValue{};
        }
        case Kind::Pointer: {
            void *address = load<void *>(source);
            return address ? NativeValue{NativeAddress{address}} : NativeValue{};
        }
        case Kind::Struct: {
            NativeFields fields;
            fields.reserve(type.layout->fields.size());
            for (const StructField &field : type.layout->fields)
            {
                fields.push_back(decodeValue(field.type, source + field.offset));
            }
            return {std::move(fields)};
        }
        case Kind::Extension:
            throw std::invalid_argument("Native FFI " + type.name +
                                        " values are decoded by their platform codec");
    }
    return {};
}
}
