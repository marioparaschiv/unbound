#include "LoaderCodeSignature.h"

#include <algorithm>
#include <climits>
#include <cstring>
#include <fstream>
#include <optional>

namespace loader::codesign {
namespace {
    constexpr std::streamoff kMachHeaderSize      = 32;
    constexpr std::streamoff kCommandCountOffset  = 16;
    constexpr std::streamoff kLoadCommandSize     = 8;
    constexpr std::streamoff kLinkeditCommandSize = 16;
    constexpr std::streamoff kSuperBlobHeaderSize = 12;
    constexpr std::streamoff kBlobIndexSize       = 8;
    constexpr std::streamoff kBlobHeaderSize      = 8;
    constexpr uint32_t       kMaxFatSlices        = 16;

    class BinaryReader
    {
    public:
        explicit BinaryReader(const std::string &path) : stream_(path, std::ios::binary) {}

        bool isOpen() const
        {
            return stream_.is_open();
        }

        std::streamoff position()
        {
            return stream_.tellg();
        }

        bool seek(std::streamoff offset)
        {
            stream_.clear();
            return static_cast<bool>(stream_.seekg(offset));
        }

        bool read(void *target, std::streamoff size)
        {
            return static_cast<bool>(stream_.read(static_cast<char *>(target), size));
        }

        std::optional<std::string> readBytes(uint64_t size)
        {
            const std::streamoff start = position();
            stream_.seekg(0, std::ios::end);
            const std::streamoff end = position();
            seek(start);
            if (start < 0 || end < start || size > static_cast<uint64_t>(end - start))
            {
                return std::nullopt;
            }
            std::string bytes(static_cast<size_t>(size), '\0');
            if (!read(bytes.data(), static_cast<std::streamoff>(size)))
            {
                return std::nullopt;
            }
            return bytes;
        }

    private:
        std::ifstream stream_;
    };

    uint32_t hostValue(const uint8_t *bytes)
    {
        uint32_t value;
        std::memcpy(&value, bytes, sizeof(value));
        return value;
    }

    uint32_t bigEndianValue(const uint8_t *bytes)
    {
        return (static_cast<uint32_t>(bytes[0]) << 24) | (static_cast<uint32_t>(bytes[1]) << 16) |
               (static_cast<uint32_t>(bytes[2]) << 8) | static_cast<uint32_t>(bytes[3]);
    }

    std::optional<std::string> entitlementsBlob(BinaryReader &reader, uint64_t offset)
    {
        uint8_t header[kBlobHeaderSize];
        if (!reader.seek(static_cast<std::streamoff>(offset)) ||
            !reader.read(header, sizeof(header)))
        {
            return std::nullopt;
        }
        const uint32_t length = bigEndianValue(header + 4);
        if (bigEndianValue(header) != kEntitlementsBlobMagic || length < kBlobHeaderSize)
        {
            return std::nullopt;
        }
        return reader.readBytes(length - kBlobHeaderSize);
    }

    std::vector<std::string> signatureEntitlements(BinaryReader &reader, uint32_t offset)
    {
        std::vector<std::string> blobs;
        uint8_t                  superBlob[kSuperBlobHeaderSize];
        if (!reader.seek(offset) || !reader.read(superBlob, sizeof(superBlob)) ||
            bigEndianValue(superBlob) != kEmbeddedSignatureMagic)
        {
            return blobs;
        }

        const uint32_t count = bigEndianValue(superBlob + 8);
        for (uint32_t index = 0; index < count; index++)
        {
            uint8_t blobIndex[kBlobIndexSize];
            if (!reader.read(blobIndex, sizeof(blobIndex)))
            {
                continue;
            }
            if (bigEndianValue(blobIndex) != kEntitlementsSlot)
            {
                continue;
            }
            const std::streamoff next = reader.position();
            if (auto blob = entitlementsBlob(reader, static_cast<uint64_t>(offset) +
                                                         bigEndianValue(blobIndex + 4)))
            {
                blobs.push_back(std::move(*blob));
            }
            reader.seek(next);
        }
        return blobs;
    }

    std::vector<std::string> machOEntitlements(BinaryReader &reader, uint64_t base)
    {
        uint8_t header[kMachHeaderSize];
        if (!reader.seek(static_cast<std::streamoff>(base)) || !reader.read(header, sizeof(header)))
        {
            return {};
        }

        const uint32_t commandCount = hostValue(header + kCommandCountOffset);
        for (uint32_t index = 0; index < commandCount; index++)
        {
            const std::streamoff commandStart = reader.position();
            uint8_t              command[kLoadCommandSize];
            if (!reader.read(command, sizeof(command)))
            {
                return {};
            }
            if (hostValue(command) == kCodeSignatureCommand)
            {
                uint8_t linkedit[kLinkeditCommandSize];
                if (!reader.seek(commandStart) || !reader.read(linkedit, sizeof(linkedit)))
                {
                    return {};
                }
                const uint64_t signature = base + hostValue(linkedit + 8);
                if (signature > UINT32_MAX)
                {
                    return {};
                }
                return signatureEntitlements(reader, static_cast<uint32_t>(signature));
            }
            reader.seek(commandStart + hostValue(command + 4));
        }
        return {};
    }

    bool isMachO64(BinaryReader &reader, uint64_t offset)
    {
        uint8_t magicBytes[sizeof(uint32_t)];
        if (!reader.seek(static_cast<std::streamoff>(offset)) ||
            !reader.read(magicBytes, sizeof(magicBytes)))
        {
            return false;
        }
        const uint32_t magic = hostValue(magicBytes);
        return magic == kMachOMagic64 || magic == kMachOSwappedMagic64;
    }

    std::vector<std::string> fatEntitlements(BinaryReader &reader, bool wide)
    {
        uint8_t count[sizeof(uint32_t)];
        if (!reader.seek(4) || !reader.read(count, sizeof(count)))
        {
            return {};
        }
        const uint32_t       slices    = std::min<uint32_t>(bigEndianValue(count), kMaxFatSlices);
        const std::streamoff entrySize = wide ? 32 : 20;
        for (uint32_t index = 0; index < slices; index++)
        {
            uint8_t entry[32];
            if (!reader.seek(8 + entrySize * index) || !reader.read(entry, entrySize))
            {
                return {};
            }
            const uint64_t offset = wide
                                        ? (static_cast<uint64_t>(bigEndianValue(entry + 8)) << 32) |
                                              bigEndianValue(entry + 12)
                                        : bigEndianValue(entry + 8);
            if (!isMachO64(reader, offset))
            {
                continue;
            }
            std::vector<std::string> blobs = machOEntitlements(reader, offset);
            if (!blobs.empty())
            {
                return blobs;
            }
        }
        return {};
    }
}

std::vector<std::string> entitlementBlobs(const std::string &executablePath)
{
    BinaryReader reader(executablePath);
    uint8_t      magicBytes[sizeof(uint32_t)];
    if (!reader.isOpen() || !reader.read(magicBytes, sizeof(magicBytes)))
    {
        return {};
    }
    const uint32_t magic = bigEndianValue(magicBytes);
    if (magic == kFatMagic || magic == kFatMagic64)
    {
        return fatEntitlements(reader, magic == kFatMagic64);
    }
    if (!isMachO64(reader, 0))
    {
        return {};
    }
    return machOEntitlements(reader, 0);
}

std::optional<std::string> entitlementsFromBlob(const std::string &blob)
{
    constexpr size_t headerSize = static_cast<size_t>(kBlobHeaderSize);
    if (blob.size() < headerSize)
    {
        return std::nullopt;
    }
    const auto    *bytes  = reinterpret_cast<const uint8_t *>(blob.data());
    const uint32_t length = bigEndianValue(bytes + 4);
    if (bigEndianValue(bytes) != kEntitlementsBlobMagic || length < headerSize ||
        length > blob.size())
    {
        return std::nullopt;
    }
    std::string payload = blob.substr(headerSize, length - headerSize);
    if (payload.empty())
    {
        return std::nullopt;
    }
    return payload;
}
}
