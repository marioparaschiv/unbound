#include <cassert>
#include <cstdint>
#include <string>
#include <vector>

#include "LoaderSettingsCache.h"

namespace {
constexpr size_t kHeaderBytes   = 28;
constexpr size_t kVersionOffset = 4;
constexpr size_t kCountOffset   = 24;

void writeInteger(std::string &cache, size_t offset, uint64_t value, size_t width)
{
    for (size_t index = 0; index < width; index++)
    {
        cache[offset + index] = static_cast<char>((value >> (index * 8)) & 0xff);
    }
}

void hashesAreFnv1a()
{
    assert(loader::settingsHash("") == 0xcbf29ce484222325ULL);
    assert(loader::settingsHash("a") == 0xaf63dc4c8601ec8cULL);
    assert(loader::settingsHash("foobar") == 0x85944171f73967e8ULL);
    assert(loader::settingsHash(std::string("\0", 1)) != loader::settingsHash(""));
}

void emptyCacheRoundTrips()
{
    std::string cache = loader::encodeSettingsCache(7, 2, {});
    assert(cache.size() == kHeaderBytes);
    assert(cache.compare(0, 4, "UBSC") == 0);

    auto stores = loader::decodeSettingsCache(cache, 7, 2);
    assert(stores && stores->empty());
}

void storesRoundTripByteForByte()
{
    const std::string                      packed = std::string("\x81\xa1k\xc3\0\xff", 6);
    const std::vector<loader::CachedStore> stores = {
        {"unbound", 1, 10, packed},
        {"", 12, 0, ""},
        {std::string("na\0me", 5), 13, 4, "\x90"},
    };
    std::string cache = loader::encodeSettingsCache(42, 20, stores);
    assert(cache.size() ==
           kHeaderBytes + (4 + 7 + 24) + (4 + 0 + 24) + (4 + 5 + 24) + packed.size() + 0 + 1);

    auto decoded = loader::decodeSettingsCache(cache, 42, 20);
    assert(decoded && decoded->size() == stores.size());
    for (size_t index = 0; index < stores.size(); index++)
    {
        assert((*decoded)[index].name == stores[index].name);
        assert((*decoded)[index].jsonOffset == stores[index].jsonOffset);
        assert((*decoded)[index].jsonLength == stores[index].jsonLength);
        assert((*decoded)[index].packed == stores[index].packed);
    }
}

void headerMismatchesAreRejected()
{
    const std::string cache = loader::encodeSettingsCache(1, 0, {});

    std::string magic = cache;
    magic[0]          = 'X';
    assert(!loader::decodeSettingsCache(magic, 1, 0));

    std::string version = cache;
    writeInteger(version, kVersionOffset, 2, 4);
    assert(!loader::decodeSettingsCache(version, 1, 0));

    assert(!loader::decodeSettingsCache("", 1, 0));
    assert(!loader::decodeSettingsCache("UBSC", 1, 0));
}

void storeSpansMustFitTheJson()
{
    assert(loader::decodeSettingsCache(loader::encodeSettingsCache(1, 8, {{"a", 8, 0, ""}}), 1, 8));
    assert(loader::decodeSettingsCache(loader::encodeSettingsCache(1, 8, {{"a", 0, 8, ""}}), 1, 8));
    assert(
        !loader::decodeSettingsCache(loader::encodeSettingsCache(1, 8, {{"a", 9, 0, ""}}), 1, 8));
    assert(
        !loader::decodeSettingsCache(loader::encodeSettingsCache(1, 8, {{"a", 8, 1, ""}}), 1, 8));
    assert(!loader::decodeSettingsCache(
        loader::encodeSettingsCache(1, 8, {{"a", 1, UINT64_MAX, ""}}), 1, 8));
    assert(!loader::decodeSettingsCache(
        loader::encodeSettingsCache(1, 8, {{"a", 0, 1, ""}, {"b", UINT64_MAX, 0, ""}}), 1, 8));
}

void oversizedCountsAreRejected()
{
    std::string count = loader::encodeSettingsCache(1, 0, {});
    writeInteger(count, kCountOffset, UINT32_MAX, 4);
    assert(!loader::decodeSettingsCache(count, 1, 0));

    std::string name = loader::encodeSettingsCache(1, 4, {{"abc", 0, 1, "p"}});
    writeInteger(name, kHeaderBytes, UINT32_MAX, 4);
    assert(!loader::decodeSettingsCache(name, 1, 4));

    std::string  packed             = loader::encodeSettingsCache(1, 4, {{"abc", 0, 1, "p"}});
    const size_t packedLengthOffset = kHeaderBytes + 4 + 3 + 16;
    writeInteger(packed, packedLengthOffset, UINT64_MAX, 8);
    assert(!loader::decodeSettingsCache(packed, 1, 4));
    writeInteger(packed, packedLengthOffset, 0, 8);
    assert(!loader::decodeSettingsCache(packed, 1, 4));
}
}

int main()
{
    hashesAreFnv1a();
    emptyCacheRoundTrips();
    storesRoundTripByteForByte();
    headerMismatchesAreRejected();
    storeSpansMustFitTheJson();
    oversizedCountsAreRejected();
    return 0;
}
