#include "LoaderSettingsCache.h"

#include <cstring>

namespace loader {
// Layout, little-endian: magic, version, JSON hash, JSON size, store count; then per store its
// name length and name, JSON offset, JSON length and packed length; then the packed stores in
// index order.
static constexpr char     kMagic[4] = {'U', 'B', 'S', 'C'};
static constexpr uint32_t kVersion  = 1;

static void appendInteger(std::string &out, uint64_t value, size_t width)
{
    for (size_t index = 0; index < width; index++)
    {
        out += static_cast<char>((value >> (index * 8)) & 0xff);
    }
}

namespace {
    // Reads the cache front to back; every read fails once one runs past the end.
    class CacheReader
    {
    public:
        explicit CacheReader(std::string_view data) : data_(data) {}

        std::optional<uint64_t> integer(size_t width)
        {
            if (data_.size() - offset_ < width)
            {
                return std::nullopt;
            }
            uint64_t value = 0;
            for (size_t index = 0; index < width; index++)
            {
                value |= static_cast<uint64_t>(static_cast<unsigned char>(data_[offset_ + index]))
                         << (index * 8);
            }
            offset_ += width;
            return value;
        }

        std::optional<std::string_view> bytes(uint64_t length)
        {
            if (data_.size() - offset_ < length)
            {
                return std::nullopt;
            }
            std::string_view slice = data_.substr(offset_, length);
            offset_ += length;
            return slice;
        }

        bool atEnd() const
        {
            return offset_ == data_.size();
        }

    private:
        std::string_view data_;
        size_t           offset_ = 0;
    };
}

uint64_t settingsHash(std::string_view json)
{
    uint64_t hash = 0xcbf29ce484222325ULL;
    for (char byte : json)
    {
        hash ^= static_cast<unsigned char>(byte);
        hash *= 0x100000001b3ULL;
    }
    return hash;
}

std::string encodeSettingsCache(uint64_t jsonHash, uint64_t jsonSize,
                                const std::vector<CachedStore> &stores)
{
    std::string out(kMagic, sizeof(kMagic));
    appendInteger(out, kVersion, 4);
    appendInteger(out, jsonHash, 8);
    appendInteger(out, jsonSize, 8);
    appendInteger(out, stores.size(), 4);
    for (const CachedStore &store : stores)
    {
        appendInteger(out, store.name.size(), 4);
        out += store.name;
        appendInteger(out, store.jsonOffset, 8);
        appendInteger(out, store.jsonLength, 8);
        appendInteger(out, store.packed.size(), 8);
    }
    for (const CachedStore &store : stores)
    {
        out += store.packed;
    }
    return out;
}

std::optional<std::vector<CachedStore>> decodeSettingsCache(std::string_view cache,
                                                            uint64_t jsonHash, uint64_t jsonSize)
{
    CacheReader                     reader(cache);
    std::optional<std::string_view> magic = reader.bytes(sizeof(kMagic));
    if (!magic || std::memcmp(magic->data(), kMagic, sizeof(kMagic)) != 0 ||
        reader.integer(4) != kVersion || reader.integer(8) != jsonHash ||
        reader.integer(8) != jsonSize)
    {
        return std::nullopt;
    }
    std::optional<uint64_t> count = reader.integer(4);
    if (!count)
    {
        return std::nullopt;
    }

    std::vector<CachedStore> stores;
    std::vector<uint64_t>    packedLengths;
    for (uint64_t index = 0; index < *count; index++)
    {
        std::optional<uint64_t>         nameLength = reader.integer(4);
        std::optional<std::string_view> name =
            nameLength ? reader.bytes(*nameLength) : std::nullopt;
        std::optional<uint64_t> offset       = reader.integer(8);
        std::optional<uint64_t> length       = reader.integer(8);
        std::optional<uint64_t> packedLength = reader.integer(8);
        if (!name || !offset || !length || !packedLength || *offset > jsonSize ||
            *length > jsonSize - *offset)
        {
            return std::nullopt;
        }
        stores.push_back({std::string(*name), *offset, *length, {}});
        packedLengths.push_back(*packedLength);
    }
    for (size_t index = 0; index < stores.size(); index++)
    {
        std::optional<std::string_view> packed = reader.bytes(packedLengths[index]);
        if (!packed)
        {
            return std::nullopt;
        }
        stores[index].packed = std::string(*packed);
    }
    if (!reader.atEnd())
    {
        return std::nullopt;
    }
    return stores;
}
}
