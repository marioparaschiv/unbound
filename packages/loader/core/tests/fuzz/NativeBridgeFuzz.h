#pragma once

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <nlohmann/json.hpp>
#include <optional>
#include <stdexcept>
#include <string>
#include <variant>
#include <vector>

#include "LoaderBundleManifest.h"
#include "NativeFFITypes.h"
#include "NativeFFIValues.h"
#include "NativeLimits.h"
#include "NativeNumericValidation.h"
#include "NativeTypeEncoding.h"

namespace native_bridge_fuzz {
enum class Target : std::uint8_t
{
    TypeEncoding,
    TypeName,
    ValueRoundTrip,
    NumericValue,
    Names,
    BundleManifest,
    Count,
};

inline void require(bool condition, const char *invariant)
{
    if (!condition)
    {
        std::fprintf(stderr, "native bridge fuzz invariant broken: %s\n", invariant);
        std::abort();
    }
}

inline void fuzzTypeEncoding(const std::string &input)
{
    normalizedType(input.c_str());
    std::string name = nativeFFITypeName(input.c_str());
    if (name.empty())
    {
        return;
    }
    bool platformType = name == "object" || name == "class" || name == "selector";
    require(platformType || loader::ffi::parseType(name).has_value(),
            "every mapped encoding names a known type");
    if (name.rfind("struct:", 0) != 0)
    {
        return;
    }
    const char *canonical = nativeStructEncoding(name.substr(7));
    require(canonical != nullptr, "every mapped struct has a canonical encoding");
    require(nativeFFITypeName(canonical) == name, "the canonical encoding maps back to its type");
}

inline bool decodesWithoutDereferencing(const loader::ffi::Type &type)
{
    if (type.kind == loader::ffi::Kind::CString || type.kind == loader::ffi::Kind::Extension)
    {
        return false;
    }
    if (type.kind != loader::ffi::Kind::Struct)
    {
        return true;
    }
    for (const loader::ffi::StructField &field : type.layout->fields)
    {
        if (!decodesWithoutDereferencing(field.type))
        {
            return false;
        }
    }
    return true;
}

inline bool holdsNonFinite(const loader::ffi::NativeValue &value)
{
    if (const double *number = std::get_if<double>(&value.data))
    {
        return !std::isfinite(*number);
    }
    if (const loader::ffi::NativeFields *fields =
            std::get_if<loader::ffi::NativeFields>(&value.data))
    {
        for (const loader::ffi::NativeValue &field : *fields)
        {
            if (holdsNonFinite(field))
            {
                return true;
            }
        }
    }
    return false;
}

inline void fuzzTypeName(const std::string &input)
{
    std::optional<loader::ffi::Type> type = loader::ffi::parseType(input);
    if (!type)
    {
        return;
    }
    require(type->name == input, "a parsed type keeps its name");
    std::size_t size      = loader::ffi::typeSize(*type);
    std::size_t alignment = loader::ffi::typeAlignment(*type);
    require(type->kind == loader::ffi::Kind::Void || size > 0, "only void is empty");
    require(alignment > 0 && (alignment & (alignment - 1)) == 0, "alignment is a power of two");
    require(type->kind == loader::ffi::Kind::Void || size % alignment == 0,
            "size is a multiple of alignment");
    require(loader::ffi::valueStorageSize(*type) >= size, "storage holds the whole value");
}

inline void fuzzValueRoundTrip(const std::uint8_t *data, std::size_t size)
{
    static const char *const names[] = {
        "bool",
        "i8",
        "u8",
        "i16",
        "u16",
        "i32",
        "u32",
        "i64",
        "u64",
        "float",
        "double",
        "pointer",
        "struct:CGPoint",
        "struct:CGRect",
        "struct:NSRange",
        "struct:UIEdgeInsets",
        "struct:CGAffineTransform",
        "struct:timespec",
    };
    if (size == 0)
    {
        return;
    }
    loader::ffi::Type type =
        *loader::ffi::parseType(names[data[0] % (sizeof(names) / sizeof(names[0]))]);
    if (!decodesWithoutDereferencing(type))
    {
        return;
    }
    std::size_t               storage = loader::ffi::valueStorageSize(type);
    std::vector<std::uint8_t> source(storage, 0);
    std::memcpy(source.data(), data + 1, std::min(storage, size - 1));
    if (type.kind == loader::ffi::Kind::Bool)
    {
        source[0] &= 1;
    }
    loader::ffi::NativeValue     value = loader::ffi::decodeValue(type, source.data());
    std::vector<std::uint8_t>    encoded(storage, 0);
    loader::ffi::ArgumentStorage arguments;
    try
    {
        loader::ffi::encodeValue(type, value, encoded.data(), arguments);
    }
    catch (const std::invalid_argument &)
    {
        require(holdsNonFinite(value), "a decoded value re-encodes unless it is not finite");
        return;
    }
    if (!holdsNonFinite(value))
    {
        loader::ffi::NativeValue  again = loader::ffi::decodeValue(type, encoded.data());
        std::vector<std::uint8_t> reencoded(storage, 0);
        loader::ffi::encodeValue(type, again, reencoded.data(), arguments);
        require(encoded == reencoded, "encoding a decoded value is stable");
    }
}

inline void fuzzNumericValue(const std::uint8_t *data, std::size_t size)
{
    static const char *const types[] = {"bool",   "i8",      "u8",      "i16",          "u16",
                                        "i32",    "u32",     "i64",     "u64",          "float",
                                        "double", "pointer", "cstring", "struct:CGRect"};
    if (size < 1 + sizeof(double))
    {
        return;
    }
    double value;
    std::memcpy(&value, data + 1, sizeof(double));
    const char *type  = types[data[0] % (sizeof(types) / sizeof(types[0]))];
    bool        valid = validNativeNumericValue(value, type);
    require(!(valid && std::isnan(value) && std::strcmp(type, "double") != 0 &&
              std::strcmp(type, "float") != 0),
            "NaN is never a valid integer");
    require(!valid || isNativeScalarType(type), "only scalar types accept numbers");
}

inline void fuzzNames(const std::string &input)
{
    try
    {
        std::string name = loader::native::parseName(input, 64, "name");
        require(!name.empty() && name.size() <= 64, "a parsed name respects its bounds");
    }
    catch (const std::invalid_argument &)
    {
    }
    nlohmann::json handle = nlohmann::json::parse(input, nullptr, false);
    if (handle.is_discarded())
    {
        return;
    }
    try
    {
        std::string id = loader::native::parseHandleId(handle, "handle");
        require(!loader::native::handleJSON(id).empty(), "a parsed handle serializes");
    }
    catch (const std::invalid_argument &)
    {
    }
}

inline void fuzzBundleManifest(const std::string &input)
{
    loader::parseBuildTime(input);
    loader::parseBaseline(input);
    std::optional<loader::BundleManifest> manifest = loader::parseBundleManifest(input);
    if (!manifest)
    {
        return;
    }
    for (std::uint32_t version : manifest->bytecodeVersions)
    {
        manifest->bundleFile(version);
    }
    if (!manifest->isSignable())
    {
        return;
    }
    loader::BundleBaseline baseline = loader::baselineFromManifest(*manifest, "fuzz");
    std::optional<loader::BundleBaseline> parsed =
        loader::parseBaseline(loader::serializeBaseline(baseline));
    require(parsed.has_value(), "a signable manifest leaves a baseline that parses");
    require(parsed->revision == baseline.revision && parsed->channel == baseline.channel,
            "a baseline round-trips");
    loader::rollbackProblem(*manifest, "fuzz", parsed);
}

inline void fuzzOne(const std::uint8_t *data, std::size_t size)
{
    if (size == 0)
    {
        return;
    }
    Target target = static_cast<Target>(data[0] % static_cast<std::uint8_t>(Target::Count));
    const std::uint8_t *rest   = data + 1;
    std::size_t         length = size - 1;
    std::string         text(reinterpret_cast<const char *>(rest), length);
    switch (target)
    {
        case Target::TypeEncoding:
            fuzzTypeEncoding(text);
            break;
        case Target::TypeName:
            fuzzTypeName(text);
            break;
        case Target::ValueRoundTrip:
            fuzzValueRoundTrip(rest, length);
            break;
        case Target::NumericValue:
            fuzzNumericValue(rest, length);
            break;
        case Target::Names:
            fuzzNames(text);
            break;
        case Target::BundleManifest:
            fuzzBundleManifest(text);
            break;
        case Target::Count:
            break;
    }
}
}
