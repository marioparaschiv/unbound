#pragma once

#include <chrono>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <jsi/jsi.h>
#include <memory>
#include <nlohmann/json.hpp>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>

#include "NativeBoundedValue.h"
#include "NativeConversionBudget.h"
#include "NativeFFI.h"
#include "NativeFFIValues.h"
#include "NativeGeometry.h"
#include "NativeLimits.h"

namespace native_jsi_fuzz {
namespace jsi = facebook::jsi;

constexpr std::chrono::milliseconds kInputTimeLimit{2000};

struct FuzzStats {
    long evaluated  = 0;
    long serialized = 0;
    long rejected   = 0;
};

inline FuzzStats &stats()
{
    static FuzzStats shared;
    return shared;
}

class ByteReader
{
public:
    ByteReader(const std::uint8_t *data, std::size_t size) : data_(data), size_(size) {}

    std::uint8_t next()
    {
        return position_ < size_ ? data_[position_++] : 0;
    }

    bool exhausted() const
    {
        return position_ >= size_;
    }

private:
    const std::uint8_t *data_;
    std::size_t         size_;
    std::size_t         position_ = 0;
};

inline void require(bool condition, const char *invariant, const std::string &source)
{
    if (!condition)
    {
        std::fprintf(stderr, "native JSI fuzz invariant broken: %s\nvalue: %s\n", invariant,
                     source.substr(0, 400).c_str());
        std::abort();
    }
}

inline std::string numberLiteral(ByteReader &bytes)
{
    static const char *const numbers[] = {"0",
                                          "-0",
                                          "1",
                                          "-1",
                                          "0.5",
                                          "NaN",
                                          "Infinity",
                                          "-Infinity",
                                          "1e308",
                                          "-1e308",
                                          "5e-324",
                                          "2147483648",
                                          "4294967296",
                                          "9007199254740993",
                                          "-9223372036854775808",
                                          "1.7976931348623157e308"};
    return numbers[bytes.next() % (sizeof(numbers) / sizeof(numbers[0]))];
}

inline std::string stringLiteral(ByteReader &bytes)
{
    static const char *const strings[] = {
        "''",        "'a'",          "'struct:CGRect'", "'\\u0000'",        "'\\ud800'",
        "'\\uffff'", "'\\u{1F600}'", "'x'.repeat(65)",  "'y'.repeat(5000)", "'z'.repeat(70000)",
        "'id'",      "'__proto__'",  "'constructor'",   "'toJSON'"};
    return strings[bytes.next() % (sizeof(strings) / sizeof(strings[0]))];
}

inline std::string keyLiteral(ByteReader &bytes)
{
    static const char *const keys[] = {
        "a",         "id",         "x",        "y",  "width",          "height",
        "__proto__", "length",     "toJSON",   "''", "'k'.repeat(70)", "[Symbol('s')]",
        "0",         "4294967295", "'\\u0000'"};
    std::string key = keys[bytes.next() % (sizeof(keys) / sizeof(keys[0]))];
    if (key.front() == '[' || key.front() == '\'')
    {
        return key.front() == '[' ? key : "[" + key + "]";
    }
    return "'" + key + "'";
}

inline std::string valueSource(ByteReader &bytes, int depth)
{
    if (bytes.exhausted() || depth > 40)
    {
        return "0";
    }
    switch (bytes.next() % 22)
    {
        case 0:
            return "undefined";
        case 1:
            return "null";
        case 2:
            return bytes.next() % 2 ? "true" : "false";
        case 3:
        case 4:
            return numberLiteral(bytes);
        case 5:
        case 6:
            return stringLiteral(bytes);
        case 7: {
            std::string array = "[";
            int         count = bytes.next() % 6;
            for (int index = 0; index < count; index++)
            {
                array += (index ? "," : "") + valueSource(bytes, depth + 1);
            }
            return array + "]";
        }
        case 8: {
            std::string object = "({";
            int         count  = bytes.next() % 6;
            for (int index = 0; index < count; index++)
            {
                object +=
                    (index ? "," : "") + keyLiteral(bytes) + ":" + valueSource(bytes, depth + 1);
            }
            return object + "})";
        }
        case 9: {
            std::string nested = valueSource(bytes, depth + 1);
            int         levels = 1 + bytes.next() % 64;
            for (int level = 0; level < levels; level++)
            {
                nested = (bytes.next() % 2 ? "[" + nested + "]" : "({v:" + nested + "})");
            }
            return nested;
        }
        case 10:
            return "(() => { const o = {a: 1}; o.self = o; return o; })()";
        case 11:
            return "(() => { const a = [1]; a.push(a); return a; })()";
        case 12:
            return "({ get a() { throw new Error('getter'); } })";
        case 13:
            return "new Proxy({}, { ownKeys() { throw new Error('keys'); }, get() { throw new Error('get'); } })";
        case 14:
            return "new Proxy([], { get(t, k) { return k === 'length' ? 1e9 : 1; } })";
        case 15: {
            static const char *const lengths[] = {"1e6", "4294967295", "65", "513", "17"};
            return std::string("(() => { const a = []; a.length = ") + lengths[bytes.next() % 5] +
                   "; return a; })()";
        }
        case 16:
            return "Symbol('s')";
        case 17:
            return bytes.next() % 2 ? "123n" : "(2n ** 200n)";
        case 18:
            return bytes.next() % 2 ? "(function f() {})" : "(() => 1)";
        case 19: {
            static const char *const objects[] = {
                "new Date(0)",         "new Map([[1, 2]])",  "new Set([1])",
                "new Uint8Array(4)",   "new ArrayBuffer(8)", "/re/g",
                "Object.create(null)", "new Error('e')",     "Math",
                "globalThis"};
            return objects[bytes.next() % (sizeof(objects) / sizeof(objects[0]))];
        }
        case 20:
            return "({ id: " + stringLiteral(bytes) + ", x: " + numberLiteral(bytes) +
                   ", y: " + numberLiteral(bytes) + ", width: " + numberLiteral(bytes) +
                   ", height: " + numberLiteral(bytes) + " })";
        default:
            return "Array.from({ length: " + std::to_string(bytes.next() * 40) + " }, (_, i) => i)";
    }
}

inline const NativeConversionProfile &profileFor(std::uint8_t selector)
{
    static const NativeConversionProfile *const profiles[] = {
        &kNativeValueConversion, &kNativePropertiesConversion, &kNativeArgumentsConversion,
        &kNativeBatchConversion};
    return *profiles[selector % 4];
}

template <typename Body> inline void rejectsOnly(Body body)
{
    try
    {
        body();
        stats().serialized++;
    }
    catch (const std::invalid_argument &)
    {
        stats().rejected++;
    }
    catch (const jsi::JSError &)
    {
        stats().rejected++;
    }
}

inline void checkSerialized(const std::string &serialized, const NativeConversionProfile &profile,
                            const std::string &source)
{
    require(serialized.size() <= profile.maximumBytes,
            "a serialized value stays within its byte limit", source);
    require(nlohmann::json::accept(serialized), "a serialized value is valid JSON", source);
}

template <typename Body> inline std::optional<std::string> serializedOrRejected(Body body)
{
    try
    {
        return body();
    }
    catch (const std::invalid_argument &)
    {
        return std::nullopt;
    }
    catch (const jsi::JSError &)
    {
        return std::nullopt;
    }
}

inline void checkDirectMatchesTree(jsi::Runtime &runtime, const jsi::Value &value,
                                   const NativeConversionProfile &profile,
                                   const std::string             &source)
{
    std::optional<std::string> direct = serializedOrRejected([&] {
        return loader::native::serializeBounded(runtime, value, profile);
    });
    std::optional<std::string> tree   = serializedOrRejected([&] {
        NativeConversionBudget budget(profile);
        return loader::native::dumpBounded(loader::native::serializeBounded(runtime, value, budget),
                                           profile);
    });
    require(direct.has_value() == tree.has_value(),
            "the direct serializer accepts exactly what the tree serializer accepts", source);
    require(!direct || *direct == *tree,
            "the direct serializer writes the same JSON as the tree serializer", source);
}

inline void fuzzConversions(jsi::Runtime &runtime, const jsi::Value &value, std::uint8_t selector,
                            const std::string &source)
{
    const NativeConversionProfile &profile = profileFor(selector);
    checkDirectMatchesTree(runtime, value, profile, source);
    rejectsOnly([&] {
        checkSerialized(loader::native::serializeBounded(runtime, value, profile), profile, source);
    });
    rejectsOnly([&] {
        checkSerialized(loader::native::serializeBoundedObject(runtime, value, profile), profile,
                        source);
    });
    rejectsOnly([&] {
        checkSerialized(loader::native::serializeBoundedArguments(runtime, value, profile), profile,
                        source);
    });
    rejectsOnly([&] {
        loader::native::serializeBoundedBatch(runtime, value, 64);
    });
    rejectsOnly([&] {
        std::string name = loader::native::parseName(runtime, value, 64, "name");
        require(!name.empty() && name.size() <= 64, "a parsed name respects its bounds", source);
    });
    rejectsOnly([&] {
        loader::native::parseHandleId(runtime, value, "handle");
    });
    rejectsOnly([&] {
        loader::native::NativeSize size = loader::native::parseSize(runtime, value);
        require(size.width >= 0 && size.width <= loader::native::kMaximumNativeDimension &&
                    size.height >= 0 && size.height <= loader::native::kMaximumNativeDimension,
                "a parsed size stays within the native limits", source);
    });
    rejectsOnly([&] {
        loader::native::parseFrame(runtime, value);
    });
}

inline void fuzzFFIWrite(jsi::Runtime &runtime, const jsi::Value &value, std::uint8_t selector,
                         const std::string &source)
{
    static const char *const types[] = {"bool",
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
                                        "cstring",
                                        "pointer",
                                        "struct:CGPoint",
                                        "struct:CGRect",
                                        "struct:NSRange",
                                        "struct:UIEdgeInsets",
                                        "struct:timespec"};
    loader::ffi::Type        type =
        *loader::ffi::parseType(types[selector % (sizeof(types) / sizeof(types[0]))]);
    std::vector<std::uint8_t>    target(loader::ffi::valueStorageSize(type) + 16, 0xa5);
    loader::ffi::ArgumentStorage storage;
    rejectsOnly([&] {
        loader::ffi::writeValue(runtime, value, type, target.data(), storage);
    });
    for (std::size_t index = loader::ffi::valueStorageSize(type); index < target.size(); index++)
    {
        require(target[index] == 0xa5, "writing a value stays inside its storage", source);
    }
}

inline std::string sourceFor(const std::uint8_t *data, std::size_t size)
{
    ByteReader bytes(data, size);
    return valueSource(bytes, 0);
}

inline void fuzzOne(jsi::Runtime &runtime, const std::uint8_t *data, std::size_t size)
{
    if (size < 2)
    {
        return;
    }
    std::string source = sourceFor(data + 2, size - 2);
    jsi::Value  value;
    try
    {
        value = runtime.evaluateJavaScript(std::make_shared<jsi::StringBuffer>("(" + source + ")"),
                                           "fuzz.js");
    }
    catch (const jsi::JSIException &)
    {
        return;
    }
    stats().evaluated++;
    auto started = std::chrono::steady_clock::now();
    fuzzConversions(runtime, value, data[0], source);
    fuzzFFIWrite(runtime, value, data[1], source);
    require(std::chrono::steady_clock::now() - started < kInputTimeLimit,
            "converting one value finishes quickly", source);
}
}
