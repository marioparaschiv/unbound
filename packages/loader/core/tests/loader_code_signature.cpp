#include <cassert>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <string>
#include <unistd.h>
#include <vector>

#include "LoaderCodeSignature.h"

using namespace loader::codesign;

static void appendHost(std::vector<uint8_t> &bytes, uint32_t value)
{
    uint8_t raw[sizeof(value)];
    std::memcpy(raw, &value, sizeof(value));
    bytes.insert(bytes.end(), raw, raw + sizeof(raw));
}

static void appendBig(std::vector<uint8_t> &bytes, uint32_t value)
{
    for (int shift = 24; shift >= 0; shift -= 8)
    {
        bytes.push_back(static_cast<uint8_t>(value >> shift));
    }
}

static void putHost(std::vector<uint8_t> &bytes, size_t offset, uint32_t value)
{
    std::memcpy(bytes.data() + offset, &value, sizeof(value));
}

struct Slot {
    uint32_t    type;
    uint32_t    magic;
    std::string payload;
};

static std::vector<uint8_t> machO(const std::vector<Slot> &slots, bool withSignature = true)
{
    std::vector<uint8_t> bytes;
    appendHost(bytes, kMachOMagic64);
    for (int index = 0; index < 3; index++)
    {
        appendHost(bytes, 0);
    }
    appendHost(bytes, withSignature ? 2 : 1);
    appendHost(bytes, 0);
    appendHost(bytes, 0);
    appendHost(bytes, 0);

    appendHost(bytes, 0x19);
    appendHost(bytes, 24);
    for (int index = 0; index < 4; index++)
    {
        appendHost(bytes, 0);
    }

    size_t dataOffsetField = 0;
    if (withSignature)
    {
        appendHost(bytes, kCodeSignatureCommand);
        appendHost(bytes, 16);
        dataOffsetField = bytes.size();
        appendHost(bytes, 0);
        appendHost(bytes, 0);
    }

    while (bytes.size() % 16)
    {
        bytes.push_back(0);
    }
    const size_t signature = bytes.size();
    if (withSignature)
    {
        putHost(bytes, dataOffsetField, static_cast<uint32_t>(signature));
    }

    std::vector<uint8_t> blobs;
    uint32_t             blobOffset = 12 + 8 * static_cast<uint32_t>(slots.size());
    std::vector<uint8_t> index;
    for (const Slot &slot : slots)
    {
        appendBig(index, slot.type);
        appendBig(index, blobOffset);
        appendBig(blobs, slot.magic);
        appendBig(blobs, static_cast<uint32_t>(slot.payload.size() + 8));
        blobs.insert(blobs.end(), slot.payload.begin(), slot.payload.end());
        blobOffset += static_cast<uint32_t>(slot.payload.size() + 8);
    }
    appendBig(bytes, kEmbeddedSignatureMagic);
    appendBig(bytes, blobOffset);
    appendBig(bytes, static_cast<uint32_t>(slots.size()));
    bytes.insert(bytes.end(), index.begin(), index.end());
    bytes.insert(bytes.end(), blobs.begin(), blobs.end());
    return bytes;
}

static std::filesystem::path write(const std::filesystem::path &root, const std::string &name,
                                   const std::vector<uint8_t> &bytes)
{
    const std::filesystem::path path = root / name;
    std::ofstream(path, std::ios::binary)
        .write(reinterpret_cast<const char *>(bytes.data()),
               static_cast<std::streamsize>(bytes.size()));
    return path;
}

int main()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-code-signature-XXXXXX").string();
    assert(mkdtemp(templatePath.data()));
    const std::filesystem::path root(templatePath);

    const std::string plist = "<?xml version=\"1.0\"?><plist><dict/></plist>";
    const auto signedBinary = write(root, "signed",
                                    machO({{0, 0xfade0c02, "code directory"},
                                           {kEntitlementsSlot, kEntitlementsBlobMagic, plist}}));
    assert(entitlementBlobs(signedBinary.string()) == std::vector<std::string>{plist});

    const auto twoSlots = write(root, "two",
                                machO({{kEntitlementsSlot, kEntitlementsBlobMagic, "first"},
                                       {kEntitlementsSlot, kEntitlementsBlobMagic, "second"}}));
    assert((entitlementBlobs(twoSlots.string()) == std::vector<std::string>{"first", "second"}));

    const auto wrongMagic = write(root, "magic",
                                  machO({{kEntitlementsSlot, 0xfade0b02, plist},
                                         {kEntitlementsSlot, kEntitlementsBlobMagic, "kept"}}));
    assert(entitlementBlobs(wrongMagic.string()) == std::vector<std::string>{"kept"});

    assert(
        entitlementBlobs(write(root, "none", machO({{0, 0xfade0c02, "code"}})).string()).empty());
    assert(entitlementBlobs(write(root, "unsigned", machO({}, false)).string()).empty());

    std::vector<uint8_t> fat = machO({{kEntitlementsSlot, kEntitlementsBlobMagic, plist}});
    putHost(fat, 0, 0xbebafeca);
    assert(entitlementBlobs(write(root, "fat", fat).string()).empty());

    std::vector<uint8_t> truncated = machO({{kEntitlementsSlot, kEntitlementsBlobMagic, plist}});
    truncated.resize(truncated.size() - 10);
    assert(entitlementBlobs(write(root, "truncated", truncated).string()).empty());

    std::vector<uint8_t> undersized  = machO({{kEntitlementsSlot, kEntitlementsBlobMagic, ""}});
    const size_t         lengthField = undersized.size() - 4;
    undersized[lengthField + 3]      = 4;
    assert(entitlementBlobs(write(root, "undersized", undersized).string()).empty());

    assert(entitlementBlobs(write(root, "short", {0xcf, 0xfa}).string()).empty());
    assert(entitlementBlobs((root / "missing").string()).empty());

    std::filesystem::remove_all(root);
    return 0;
}
