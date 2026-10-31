#include "LoaderAttestation.h"

#include <algorithm>
#include <cstring>

#include "LoaderBundleSignature.h"
#include "LoaderCrypto.h"

namespace loader::attestation {
static constexpr uint32_t    kMachOMagic64         = 0xfeedfacfu;
static constexpr uint32_t    kFatMagic             = 0xcafebabeu;
static constexpr uint32_t    kFatMagic64           = 0xcafebabfu;
static constexpr uint32_t    kSegmentCommand64     = 0x19;
static constexpr uint32_t    kCodeSignatureCommand = 0x1d;
static constexpr size_t      kHeaderSize           = 32;
static constexpr size_t      kLoadCommandSize      = 8;
static constexpr size_t      kSegmentCommandSize   = 72;
static constexpr size_t      kSectionHeaderSize    = 80;
static constexpr size_t      kLinkeditCommandSize  = 16;
static constexpr size_t      kFatHeaderSize        = 8;
static constexpr size_t      kFatArchSize          = 20;
static constexpr size_t      kFatArch64Size        = 32;
static constexpr size_t      kNameLength           = 16;
static constexpr size_t      kPublicKeyPointBytes  = 65;
static constexpr size_t      kELFHeaderSize        = 64;
static constexpr size_t      kELFSectionHeaderSize = 64;
static constexpr uint8_t     kELFClass64           = 2;
static constexpr uint8_t     kELFLittleEndian      = 1;
static constexpr const char *kPinnedPublicKey =
    "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEQPX4NgN7w+oQW/t31KTzr45C8edXjinWB2pgvXhOqipWKRJ1wfnlfZmh4PwVtT9C/ng0bDA2RjvzxhHC6z0leA==";

static bool fits(std::string_view bytes, size_t offset, size_t length)
{
    return offset <= bytes.size() && bytes.size() - offset >= length;
}

template <typename Value>
static std::optional<Value> readLittle(std::string_view bytes, size_t offset)
{
    if (!fits(bytes, offset, sizeof(Value)))
    {
        return std::nullopt;
    }
    uint64_t value = 0;
    for (size_t index = 0; index < sizeof(Value); index++)
    {
        value |= static_cast<uint64_t>(static_cast<uint8_t>(bytes[offset + index])) << (8 * index);
    }
    return static_cast<Value>(value);
}

template <typename Value> static Value readBig(std::string_view bytes, size_t offset)
{
    uint64_t value = 0;
    for (size_t index = 0; index < sizeof(Value); index++)
    {
        value = (value << 8) | static_cast<uint8_t>(bytes[offset + index]);
    }
    return static_cast<Value>(value);
}

static bool namesEqual(std::string_view bytes, size_t offset, std::string_view name)
{
    if (!fits(bytes, offset, kNameLength))
    {
        return false;
    }
    std::string_view field = bytes.substr(offset, kNameLength);
    field                  = field.substr(0, std::min(field.find('\0'), field.size()));
    return field == name;
}

std::optional<std::string_view> loadedSlice(std::string_view file, int32_t cpuType,
                                            int32_t cpuSubtype)
{
    if (file.size() < sizeof(uint32_t))
    {
        return std::nullopt;
    }
    const auto magic = readBig<uint32_t>(file, 0);
    if (magic != kFatMagic && magic != kFatMagic64)
    {
        return file;
    }
    if (file.size() < kFatHeaderSize)
    {
        return std::nullopt;
    }
    const auto   architectureCount = readBig<uint32_t>(file, sizeof(uint32_t));
    const size_t entrySize         = magic == kFatMagic64 ? kFatArch64Size : kFatArchSize;
    if (architectureCount > (file.size() - kFatHeaderSize) / entrySize)
    {
        return std::nullopt;
    }
    std::optional<std::string_view> fallback;
    for (uint32_t index = 0; index < architectureCount; index++)
    {
        const size_t   entry        = kFatHeaderSize + index * entrySize;
        const auto     entryCPU     = readBig<int32_t>(file, entry);
        const auto     entrySubtype = readBig<int32_t>(file, entry + sizeof(uint32_t));
        const uint64_t offset       = magic == kFatMagic64 ? readBig<uint64_t>(file, entry + 8)
                                                           : readBig<uint32_t>(file, entry + 8);
        const uint64_t size         = magic == kFatMagic64 ? readBig<uint64_t>(file, entry + 16)
                                                           : readBig<uint32_t>(file, entry + 12);
        if (offset > file.size() || size > file.size() - offset)
        {
            return std::nullopt;
        }
        const std::string_view slice = file.substr(offset, size);
        if (entryCPU == cpuType &&
            (entrySubtype == cpuSubtype || (entrySubtype & 0xff) == (cpuSubtype & 0xff)))
        {
            return slice;
        }
        if (!fallback && entryCPU == cpuType)
        {
            fallback = slice;
        }
    }
    return fallback;
}

static bool readSegment(std::string_view bytes, size_t command, size_t commandSize,
                        SliceLayout &layout)
{
    if (commandSize < kSegmentCommandSize)
    {
        return false;
    }
    const std::optional<uint32_t> sectionCount = readLittle<uint32_t>(bytes, command + 64);
    if (!sectionCount || *sectionCount > (commandSize - kSegmentCommandSize) / kSectionHeaderSize)
    {
        return false;
    }
    if (namesEqual(bytes, command + 8, "__LINKEDIT"))
    {
        layout.hasLinkedit      = true;
        layout.linkeditVMSize   = command + 32;
        layout.linkeditFileSize = command + 48;
    }
    size_t section = command + kSegmentCommandSize;
    for (uint32_t index = 0; index < *sectionCount; index++, section += kSectionHeaderSize)
    {
        if (!namesEqual(bytes, section, "__attestation") ||
            !namesEqual(bytes, section + 16, "__TEXT"))
        {
            continue;
        }
        const std::optional<uint64_t> size   = readLittle<uint64_t>(bytes, section + 40);
        const std::optional<uint32_t> offset = readLittle<uint32_t>(bytes, section + 48);
        if (!size || !offset || *size != kSectionSize || *offset > bytes.size() ||
            *size > bytes.size() - *offset)
        {
            return false;
        }
        layout.sectionOffset = *offset;
        layout.sectionSize   = static_cast<size_t>(*size);
    }
    return true;
}

static bool readCodeSignature(std::string_view bytes, size_t command, size_t commandSize,
                              SliceLayout &layout)
{
    if (commandSize < kLinkeditCommandSize)
    {
        return false;
    }
    const std::optional<uint32_t> dataOffset = readLittle<uint32_t>(bytes, command + 8);
    const std::optional<uint32_t> dataSize   = readLittle<uint32_t>(bytes, command + 12);
    if (!dataOffset || !dataSize || *dataOffset > bytes.size() ||
        *dataSize > bytes.size() - *dataOffset)
    {
        return false;
    }
    layout.hasCodeSignature     = true;
    layout.codeSignatureCommand = command;
    layout.boundary             = *dataOffset;
    return true;
}

std::optional<SliceLayout> parseSlice(std::string_view bytes)
{
    const std::optional<uint32_t> magic = readLittle<uint32_t>(bytes, 0);
    if (!magic || *magic != kMachOMagic64 || bytes.size() < kHeaderSize)
    {
        return std::nullopt;
    }
    const auto commandCount = readLittle<uint32_t>(bytes, 16);
    const auto commandsSize = readLittle<uint32_t>(bytes, 20);
    if (!commandCount || !commandsSize || *commandsSize > bytes.size() - kHeaderSize)
    {
        return std::nullopt;
    }
    SliceLayout layout;
    layout.size       = bytes.size();
    layout.cpuType    = *readLittle<int32_t>(bytes, 4);
    layout.cpuSubtype = *readLittle<int32_t>(bytes, 8);

    size_t       command    = kHeaderSize;
    const size_t commandEnd = kHeaderSize + *commandsSize;
    for (uint32_t index = 0; index < *commandCount; index++)
    {
        if (command > commandEnd || commandEnd - command < kLoadCommandSize)
        {
            return std::nullopt;
        }
        const auto type = readLittle<uint32_t>(bytes, command);
        const auto size = readLittle<uint32_t>(bytes, command + sizeof(uint32_t));
        if (!type || !size || *size < kLoadCommandSize || *size > commandEnd - command)
        {
            return std::nullopt;
        }
        if (*type == kSegmentCommand64 && !readSegment(bytes, command, *size, layout))
        {
            return std::nullopt;
        }
        if (*type == kCodeSignatureCommand && !readCodeSignature(bytes, command, *size, layout))
        {
            return std::nullopt;
        }
        command += *size;
    }
    if (layout.sectionSize != kSectionSize)
    {
        return std::nullopt;
    }
    if (!layout.hasCodeSignature)
    {
        layout.boundary = bytes.size();
    }
    if (layout.boundary > bytes.size() || layout.sectionOffset > layout.boundary ||
        layout.sectionSize > layout.boundary - layout.sectionOffset)
    {
        return std::nullopt;
    }
    return layout;
}

Record readRecord(std::string_view slice, const SliceLayout &layout)
{
    const std::string_view section = slice.substr(layout.sectionOffset, kSectionSize);
    Record                 record;
    record.magic           = *readLittle<uint32_t>(section, 0);
    record.version         = *readLittle<uint16_t>(section, 4);
    record.algorithm       = *readLittle<uint16_t>(section, 6);
    record.size            = *readLittle<uint32_t>(section, 8);
    record.keyID           = *readLittle<uint32_t>(section, 12);
    record.cpuType         = *readLittle<int32_t>(section, 16);
    record.cpuSubtype      = *readLittle<int32_t>(section, 20);
    record.digest          = std::string(section.substr(kDigestOffset, crypto::kSHA256Bytes));
    record.signatureLength = *readLittle<uint16_t>(section, kSignatureLengthOffset);
    record.signature       = std::string(section.substr(
        kSignatureOffset, std::min<size_t>(record.signatureLength, kSignatureCapacity)));
    const std::string_view commit = section.substr(kCommitHashOffset, kCommitHashCapacity);
    record.commitHash             = std::string(commit.substr(0, commit.find('\0')));
    return record;
}

bool hasValidMetadata(const Record &record, const SliceLayout &layout)
{
    return record.magic == kMagic && record.version == kVersion &&
           record.algorithm == kAlgorithmP256SHA256 && record.size == kSectionSize &&
           record.keyID == kKeyID && record.cpuType == layout.cpuType &&
           record.cpuSubtype == layout.cpuSubtype && record.signatureLength != 0 &&
           record.signatureLength <= kSignatureCapacity;
}

static bool zeroRange(std::string &data, size_t offset, size_t length)
{
    if (!fits(data, offset, length))
    {
        return false;
    }
    std::memset(data.data() + offset, 0, length);
    return true;
}

std::optional<std::string> canonicalDigest(std::string_view slice, const SliceLayout &layout)
{
    std::string canonical(slice.substr(0, layout.boundary));
    if (!zeroRange(canonical, layout.sectionOffset + kDigestOffset, crypto::kSHA256Bytes) ||
        !zeroRange(canonical, layout.sectionOffset + kSignatureLengthOffset, 2) ||
        !zeroRange(canonical, layout.sectionOffset + kSignatureOffset, kSignatureCapacity))
    {
        return std::nullopt;
    }
    if (layout.hasCodeSignature && !zeroRange(canonical, layout.codeSignatureCommand + 8, 8))
    {
        return std::nullopt;
    }
    if (layout.hasLinkedit && (!zeroRange(canonical, layout.linkeditFileSize, 8) ||
                               !zeroRange(canonical, layout.linkeditVMSize, 8)))
    {
        return std::nullopt;
    }
    return crypto::sha256(canonical);
}

static Evaluation failed(const char *reason)
{
    Evaluation evaluation;
    evaluation.failure = reason;
    return evaluation;
}

static bool isELF(std::string_view file)
{
    return file.size() >= 4 && file.substr(0, 4) == std::string_view("\x7f"
                                                                     "ELF",
                                                                     4);
}

static std::optional<std::string_view> sectionName(std::string_view file, size_t tableOffset,
                                                   size_t tableSize, uint32_t nameOffset)
{
    if (nameOffset >= tableSize || !fits(file, tableOffset, tableSize))
    {
        return std::nullopt;
    }
    std::string_view names = file.substr(tableOffset + nameOffset, tableSize - nameOffset);
    return names.substr(0, names.find('\0'));
}

std::optional<SliceLayout> parseELF(std::string_view file)
{
    if (!isELF(file) || file.size() < kELFHeaderSize ||
        static_cast<uint8_t>(file[4]) != kELFClass64 ||
        static_cast<uint8_t>(file[5]) != kELFLittleEndian)
    {
        return std::nullopt;
    }
    const auto machine     = readLittle<uint16_t>(file, 18);
    const auto tableOffset = readLittle<uint64_t>(file, 40);
    const auto entrySize   = readLittle<uint16_t>(file, 58);
    const auto count       = readLittle<uint16_t>(file, 60);
    const auto namesIndex  = readLittle<uint16_t>(file, 62);
    if (!machine || !tableOffset || !entrySize || !count || !namesIndex ||
        *entrySize != kELFSectionHeaderSize || *namesIndex >= *count ||
        !fits(file, *tableOffset, static_cast<size_t>(*count) * kELFSectionHeaderSize))
    {
        return std::nullopt;
    }
    auto header = [&](size_t index) {
        return *tableOffset + index * kELFSectionHeaderSize;
    };
    const auto namesOffset = readLittle<uint64_t>(file, header(*namesIndex) + 24);
    const auto namesSize   = readLittle<uint64_t>(file, header(*namesIndex) + 32);
    if (!namesOffset || !namesSize)
    {
        return std::nullopt;
    }

    SliceLayout layout;
    layout.size     = file.size();
    layout.boundary = file.size();
    layout.cpuType  = *machine;
    for (size_t index = 0; index < *count; index++)
    {
        const auto nameOffset = readLittle<uint32_t>(file, header(index));
        const auto name =
            nameOffset ? sectionName(file, *namesOffset, *namesSize, *nameOffset) : std::nullopt;
        if (name && *name == kELFSectionName)
        {
            layout.sectionOffset = *readLittle<uint64_t>(file, header(index) + 24);
            layout.sectionSize   = *readLittle<uint64_t>(file, header(index) + 32);
        }
    }
    if (layout.sectionSize != kSectionSize || !fits(file, layout.sectionOffset, kSectionSize))
    {
        return std::nullopt;
    }
    return layout;
}

static Evaluation evaluateSlice(std::string_view slice, const SliceLayout &layout,
                                const char *mismatch)
{
    Evaluation evaluation;
    evaluation.record = readRecord(slice, layout);
    if (!hasValidMetadata(evaluation.record, layout))
    {
        return failed("attestation metadata is invalid");
    }
    const std::optional<std::string> digest = canonicalDigest(slice, layout);
    if (!digest || !crypto::constantTimeEqual(*digest, evaluation.record.digest))
    {
        return failed(mismatch);
    }
    evaluation.digest = *digest;
    return evaluation;
}

Evaluation evaluate(std::string_view file, int32_t loadedCpuType, int32_t loadedCpuSubtype)
{
    if (isELF(file))
    {
        const std::optional<SliceLayout> layout = parseELF(file);
        if (!layout)
        {
            return failed("invalid ELF attestation layout");
        }
        if (layout->cpuType != loadedCpuType)
        {
            return failed("the library was built for another architecture");
        }
        return evaluateSlice(file, *layout, "ELF digest mismatch");
    }

    const std::optional<std::string_view> slice =
        loadedSlice(file, loadedCpuType, loadedCpuSubtype);
    if (!slice)
    {
        return failed("unable to select the loaded architecture slice");
    }
    const std::optional<SliceLayout> layout = parseSlice(*slice);
    if (!layout)
    {
        return failed("invalid Mach-O attestation layout");
    }
    return evaluateSlice(*slice, *layout, "Mach-O digest mismatch");
}

std::optional<std::string> publicKeyPoint()
{
    const std::optional<std::string> key = decodeBase64(kPinnedPublicKey);
    if (!key || key->size() < kPublicKeyPointBytes)
    {
        return std::nullopt;
    }
    return key->substr(key->size() - kPublicKeyPointBytes);
}
}
