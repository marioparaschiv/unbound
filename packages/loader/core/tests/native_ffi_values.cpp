#include <cassert>
#include <cstdint>
#include <cstring>
#include <stdexcept>
#include <string>
#include <variant>
#include <vector>

#include "NativeFFIValues.h"

using loader::ffi::ArgumentStorage;
using loader::ffi::NativeAddress;
using loader::ffi::NativeFields;
using loader::ffi::NativeValue;
using loader::ffi::Type;

static Type type(const char *name)
{
    return *loader::ffi::parseType(name);
}

static bool rejects(const Type &target, const NativeValue &value)
{
    std::vector<std::uint8_t> bytes(loader::ffi::valueStorageSize(target));
    ArgumentStorage           storage;
    try
    {
        loader::ffi::encodeValue(target, value, bytes.data(), storage);
    }
    catch (const std::invalid_argument &)
    {
        return true;
    }
    return false;
}

static void nullCStringEncodesNullPointer()
{
    Type                      cstring = type("cstring");
    std::vector<std::uint8_t> bytes(loader::ffi::valueStorageSize(cstring), 0xff);
    ArgumentStorage           storage;
    loader::ffi::encodeValue(cstring, NativeValue{}, bytes.data(), storage);

    const char *pointer = reinterpret_cast<const char *>(1);
    std::memcpy(&pointer, bytes.data(), sizeof(pointer));
    assert(pointer == nullptr);
    assert(std::holds_alternative<std::monostate>(loader::ffi::decodeValue(cstring, bytes.data()).data));
}

static void cstringsStayValidWhileStorageGrows()
{
    Type                                   cstring = type("cstring");
    ArgumentStorage                        storage;
    std::vector<std::vector<std::uint8_t>> slots;
    for (int index = 0; index < 64; index++)
    {
        slots.emplace_back(loader::ffi::valueStorageSize(cstring));
        loader::ffi::encodeValue(cstring, NativeValue{std::to_string(index)}, slots.back().data(), storage);
    }
    for (int index = 0; index < 64; index++)
    {
        NativeValue decoded = loader::ffi::decodeValue(cstring, slots[index].data());
        assert(std::get<std::string>(decoded.data) == std::to_string(index));
    }
}

static void structsRoundTrip()
{
    Type         rect = type("struct:CGRect");
    NativeFields origin{NativeValue{1.5}, NativeValue{-2.0}};
    NativeFields size{NativeValue{320.0}, NativeValue{480.0}};
    NativeValue  value{NativeFields{NativeValue{origin}, NativeValue{size}}};

    std::vector<std::uint8_t> bytes(loader::ffi::valueStorageSize(rect), 0xaa);
    ArgumentStorage           storage;
    loader::ffi::encodeValue(rect, value, bytes.data(), storage);

    double raw[4];
    std::memcpy(raw, bytes.data(), sizeof(raw));
    assert(raw[0] == 1.5 && raw[1] == -2.0 && raw[2] == 320.0 && raw[3] == 480.0);

    NativeValue   decoded = loader::ffi::decodeValue(rect, bytes.data());
    NativeFields &fields  = std::get<NativeFields>(decoded.data);
    assert(fields.size() == 2);
    assert(std::get<double>(std::get<NativeFields>(fields[0].data)[0].data) == 1.5);
    assert(std::get<double>(std::get<NativeFields>(fields[1].data)[1].data) == 480.0);

    Type         range = type("struct:NSRange");
    NativeValue  rangeValue{NativeFields{NativeValue{3.0}, NativeValue{std::uint64_t{9}}}};
    std::vector<std::uint8_t> rangeBytes(loader::ffi::valueStorageSize(range));
    loader::ffi::encodeValue(range, rangeValue, rangeBytes.data(), storage);
    NativeFields rangeFields = std::get<NativeFields>(loader::ffi::decodeValue(range, rangeBytes.data()).data);
    assert(std::get<std::uint64_t>(rangeFields[0].data) == 3);
    assert(std::get<std::uint64_t>(rangeFields[1].data) == 9);

    assert(rejects(rect, NativeValue{NativeFields{NativeValue{origin}}}));
    assert(rejects(rect, NativeValue{1.0}));
}

static void scalarsAreValidated()
{
    assert(rejects(type("bool"), NativeValue{1.0}));
    assert(rejects(type("u8"), NativeValue{256.0}));
    assert(rejects(type("i32"), NativeValue{1.5}));
    assert(rejects(type("i32"), NativeValue{std::string("1")}));
    assert(rejects(type("u64"), NativeValue{std::int64_t{-1}}));
    assert(rejects(type("i64"), NativeValue{UINT64_MAX}));
    assert(rejects(type("i64"), NativeValue{9007199254740992.0}));
    assert(rejects(type("cstring"), NativeValue{2.0}));
    assert(rejects(type("pointer"), NativeValue{std::string("0x1")}));

    Type                      wide = type("u64");
    std::vector<std::uint8_t> bytes(loader::ffi::valueStorageSize(wide));
    ArgumentStorage           storage;
    loader::ffi::encodeValue(wide, NativeValue{UINT64_MAX}, bytes.data(), storage);
    assert(std::get<std::uint64_t>(loader::ffi::decodeValue(wide, bytes.data()).data) == UINT64_MAX);

    Type signedWide = type("i64");
    loader::ffi::encodeValue(signedWide, NativeValue{-42.0}, bytes.data(), storage);
    assert(std::get<std::int64_t>(loader::ffi::decodeValue(signedWide, bytes.data()).data) == -42);

    Type pointer = type("pointer");
    int  target  = 0;
    loader::ffi::encodeValue(pointer, NativeValue{NativeAddress{&target}}, bytes.data(), storage);
    assert(std::get<NativeAddress>(loader::ffi::decodeValue(pointer, bytes.data()).data).value == &target);
    loader::ffi::encodeValue(pointer, NativeValue{}, bytes.data(), storage);
    assert(std::holds_alternative<std::monostate>(loader::ffi::decodeValue(pointer, bytes.data()).data));
}

int main()
{
    nullCStringEncodesNullPointer();
    cstringsStayValidWhileStorageGrows();
    structsRoundTrip();
    scalarsAreValidated();
    return 0;
}
