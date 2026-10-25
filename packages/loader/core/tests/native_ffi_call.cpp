#include <cassert>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <stdexcept>
#include <string>
#include <variant>
#include <vector>

#include "NativeAddressValidation.h"
#include "NativeFFI.h"

namespace jsi = facebook::jsi;

using loader::ffi::CallFrame;
using loader::ffi::Kind;
using loader::ffi::NativeFields;
using loader::ffi::NativeValue;
using loader::ffi::Type;

struct TestPoint {
    double x;
    double y;
};

struct TestRect {
    TestPoint origin;
    TestPoint size;
};

extern "C" TestRect unboundTestOffsetRect(TestRect rect, double distance)
{
    rect.origin.x += distance;
    rect.origin.y += distance;
    return rect;
}

extern "C" int32_t unboundTestIsNull(const char *value)
{
    return value == nullptr ? 1 : 0;
}

extern "C" int64_t unboundTestSum(int32_t a, int32_t b, int32_t c, int32_t d, int32_t e, int32_t f,
                                  int32_t g, int32_t h, int32_t i, int32_t j, int32_t k, int32_t l,
                                  int32_t m, int32_t n, int32_t o, int32_t p)
{
    return static_cast<int64_t>(a) + b + c + d + e + f + g + h + i + j + k + l + m + n + o + p;
}

static int unboundTestData = 7;

class MarkerCodec final : public loader::ffi::TypeCodec
{
public:
    void write(jsi::Runtime &, const jsi::Value &, std::uint8_t *,
               loader::ffi::ArgumentStorage &) const override
    {
    }

    jsi::Value read(jsi::Runtime &, const std::uint8_t *) const override
    {
        return jsi::Value::undefined();
    }
};

static Type type(const char *name)
{
    return loader::ffi::resolveType(name);
}

static void callInterfacesAreCachedAndBounded()
{
    Type integer = type("i32");
    auto first   = loader::ffi::callInterface(integer, {integer, integer});
    auto second  = loader::ffi::callInterface(integer, {integer, integer});
    assert(first == second);
    assert(first->cif.nargs == 2);

    auto different = loader::ffi::callInterface(type("double"), {integer, integer});
    assert(different != first);

    for (std::size_t index = 0; index < loader::ffi::kCallInterfaceCacheCapacity * 2; index++)
    {
        std::vector<Type> arguments(index % loader::ffi::kMaximumArguments + 1, type("u8"));
        arguments.front() = type(index % 3 == 0 ? "double" : index % 3 == 1 ? "float" : "i64");
        arguments.back()  = type(index % 5 == 0 ? "u16" : index % 5 == 1 ? "i16" : "u32");
        loader::ffi::callInterface(type(index % 2 == 0 ? "i8" : "u8"), arguments);
        loader::ffi::callInterface(
            loader::ffi::Type{Kind::Pointer, "pointer#" + std::to_string(index)}, {});
    }
    assert(loader::ffi::cachedCallInterfaceCount() <= loader::ffi::kCallInterfaceCacheCapacity);
    assert(first->cif.nargs == 2);

    auto rebuilt = loader::ffi::callInterface(integer, {integer, integer});
    assert(rebuilt->cif.nargs == 2);
}

static void structsTravelByValue()
{
    Type        rect = type("struct:CGRect");
    CallFrame   frame(loader::ffi::callInterface(rect, {rect, type("double")}));
    NativeValue value{
        NativeFields{NativeValue{NativeFields{NativeValue{1.0}, NativeValue{2.0}}},
                     NativeValue{NativeFields{NativeValue{30.0}, NativeValue{40.0}}}}};
    loader::ffi::encodeValue(rect, value, frame.argument(0), frame.storage());
    loader::ffi::encodeValue(type("double"), NativeValue{0.5}, frame.argument(1), frame.storage());
    frame.invoke(reinterpret_cast<void *>(&unboundTestOffsetRect));

    NativeFields result =
        std::get<NativeFields>(loader::ffi::decodeValue(rect, frame.result()).data);
    NativeFields origin = std::get<NativeFields>(result[0].data);
    NativeFields size   = std::get<NativeFields>(result[1].data);
    assert(std::get<double>(origin[0].data) == 1.5 && std::get<double>(origin[1].data) == 2.5);
    assert(std::get<double>(size[0].data) == 30.0 && std::get<double>(size[1].data) == 40.0);
    assert(loader::ffi::libffiType(rect)->size == sizeof(TestRect));
}

static void nullCStringsReachNativeCode()
{
    CallFrame frame(loader::ffi::callInterface(type("i32"), {type("cstring")}));
    loader::ffi::encodeValue(type("cstring"), NativeValue{}, frame.argument(0), frame.storage());
    frame.invoke(reinterpret_cast<void *>(&unboundTestIsNull));
    assert(std::get<double>(loader::ffi::decodeValue(type("i32"), frame.result()).data) == 1);

    CallFrame text(loader::ffi::callInterface(type("i32"), {type("cstring")}));
    loader::ffi::encodeValue(type("cstring"), NativeValue{std::string("")}, text.argument(0),
                             text.storage());
    text.invoke(reinterpret_cast<void *>(&unboundTestIsNull));
    assert(std::get<double>(loader::ffi::decodeValue(type("i32"), text.result()).data) == 0);
}

static void sixteenArgumentsAreSupported()
{
    std::vector<Type> arguments(loader::ffi::kMaximumArguments, type("i32"));
    auto              signature = loader::ffi::makeSignature(type("i64"), arguments);
    CallFrame         frame(loader::ffi::callInterface(signature.result, signature.arguments));
    for (std::size_t index = 0; index < arguments.size(); index++)
    {
        loader::ffi::encodeValue(arguments[index], NativeValue{static_cast<double>(index + 1)},
                                 frame.argument(index), frame.storage());
    }
    frame.invoke(reinterpret_cast<void *>(&unboundTestSum));
    assert(std::get<std::int64_t>(loader::ffi::decodeValue(type("i64"), frame.result()).data) ==
           136);
}

static void extensionTypesResolveThroughTheirCodec()
{
    bool rejectedUnknown = false;
    try
    {
        type("marker");
    }
    catch (const std::invalid_argument &error)
    {
        rejectedUnknown =
            std::string(error.what()) == "Unsupported native FFI type marker on this platform";
    }
    assert(rejectedUnknown);

    auto codec = std::make_shared<MarkerCodec>();
    loader::ffi::registerExtensionType("marker", codec);
    Type marker = type("marker");
    assert(marker.kind == Kind::Extension && marker.codec == codec.get());
    assert(loader::ffi::typeSize(marker) == sizeof(void *));
    assert(loader::ffi::libffiType(marker) == &ffi_type_pointer);
    assert(loader::ffi::callInterface(marker, {marker})->cif.nargs == 1);

    bool rejectedDuplicate = false;
    try
    {
        loader::ffi::registerExtensionType("marker", std::make_shared<MarkerCodec>());
    }
    catch (const std::invalid_argument &)
    {
        rejectedDuplicate = true;
    }
    assert(rejectedDuplicate);

    bool rejectedBuiltin = false;
    try
    {
        loader::ffi::registerExtensionType("pointer", std::make_shared<MarkerCodec>());
    }
    catch (const std::invalid_argument &)
    {
        rejectedBuiltin = true;
    }
    assert(rejectedBuiltin);

    bool rejectedEncoding = false;
    try
    {
        std::vector<std::uint8_t>    bytes(loader::ffi::valueStorageSize(marker));
        loader::ffi::ArgumentStorage storage;
        loader::ffi::encodeValue(marker, NativeValue{}, bytes.data(), storage);
    }
    catch (const std::invalid_argument &)
    {
        rejectedEncoding = true;
    }
    assert(rejectedEncoding);
}

static void onlyInstructionsAreCallable()
{
    assert(isCallableSymbolAddress(reinterpret_cast<void *>(&unboundTestIsNull)));
    assert(isCallableSymbolAddress(reinterpret_cast<void *>(&std::strlen)));
    assert(!isCallableSymbolAddress(&unboundTestData));
    assert(!isCallableSymbolAddress(nullptr));

    std::unique_ptr<int> heap = std::make_unique<int>(3);
    assert(!isCallableSymbolAddress(heap.get()));
    assert(!isExecutableAddress(heap.get()));
    assert(isExecutableAddress(reinterpret_cast<void *>(&unboundTestIsNull)));
}

int main()
{
    callInterfacesAreCachedAndBounded();
    structsTravelByValue();
    nullCStringsReachNativeCode();
    sixteenArgumentsAreSupported();
    extensionTypesResolveThroughTheirCodec();
    onlyInstructionsAreCallable();
    return 0;
}
