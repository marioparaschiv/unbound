#include "LoaderBinaryAnatomy.h"

#include <algorithm>
#include <cstdio>
#include <cstring>
#include <fstream>

#include "LoaderCodeSignature.h"
#include "LoaderCrypto.h"

namespace loader::binary {
namespace {
    constexpr size_t   kMachHeaderSize    = 32;
    constexpr size_t   kMaxHeaderBytes    = 4 * 1024 * 1024;
    constexpr size_t   kMaxSignatureBytes = 16 * 1024 * 1024;
    constexpr size_t   kFingerprintLength = 16;
    constexpr uint32_t kCPUTypeARM64      = 0x0100000c;

    const std::string kCommonNameOID   = std::string("\x55\x04\x03", 3);
    const std::string kOrgUnitOID      = std::string("\x55\x04\x0b", 3);
    const std::string kOrganizationOID = std::string("\x55\x04\x0a", 3);

    uint32_t little32(const std::string &bytes, size_t offset)
    {
        uint32_t value = 0;
        std::memcpy(&value, bytes.data() + offset, sizeof(value));
        return value;
    }

    uint32_t big32(const std::string &bytes, size_t offset)
    {
        const auto *data = reinterpret_cast<const uint8_t *>(bytes.data() + offset);
        return (uint32_t(data[0]) << 24) | (uint32_t(data[1]) << 16) | (uint32_t(data[2]) << 8) |
               uint32_t(data[3]);
    }

    std::optional<std::string> readRange(std::ifstream &stream, uint64_t offset, size_t size)
    {
        std::string bytes(size, '\0');
        stream.clear();
        if (!stream.seekg(static_cast<std::streamoff>(offset)) ||
            !stream.read(bytes.data(), static_cast<std::streamoff>(size)))
        {
            return std::nullopt;
        }
        return bytes;
    }

    std::optional<uint64_t> arm64SliceOffset(std::ifstream &stream)
    {
        std::optional<std::string> magic = readRange(stream, 0, 8);
        if (!magic)
        {
            return std::nullopt;
        }
        uint32_t value = big32(*magic, 0);
        if (value != codesign::kFatMagic && value != codesign::kFatMagic64)
        {
            return 0;
        }
        bool     wide      = value == codesign::kFatMagic64;
        uint32_t slices    = std::min<uint32_t>(big32(*magic, 4), 16);
        size_t   entrySize = wide ? 32 : 20;
        for (uint32_t index = 0; index < slices; index++)
        {
            std::optional<std::string> entry = readRange(stream, 8 + entrySize * index, entrySize);
            if (!entry)
            {
                return std::nullopt;
            }
            if (big32(*entry, 0) == kCPUTypeARM64)
            {
                return wide ? (uint64_t(big32(*entry, 8)) << 32) | big32(*entry, 12)
                            : big32(*entry, 8);
            }
        }
        return std::nullopt;
    }

    std::string uuidString(const std::string &bytes, size_t offset)
    {
        std::string text;
        for (size_t index = 0; index < 16; index++)
        {
            char digits[3];
            std::snprintf(digits, sizeof(digits), "%02X",
                          static_cast<uint8_t>(bytes[offset + index]));
            text += digits;
            if (index == 3 || index == 5 || index == 7 || index == 9)
            {
                text += '-';
            }
        }
        return text;
    }

    struct Element {
        uint8_t     tag = 0;
        std::string content;
        std::string whole;
    };

    std::optional<Element> readElement(const std::string &der, size_t &offset)
    {
        if (offset + 2 > der.size())
        {
            return std::nullopt;
        }
        size_t  start  = offset;
        uint8_t tag    = static_cast<uint8_t>(der[offset++]);
        size_t  length = static_cast<uint8_t>(der[offset++]);
        if (length & 0x80)
        {
            size_t bytes = length & 0x7f;
            if (bytes == 0 || bytes > 4 || offset + bytes > der.size())
            {
                return std::nullopt;
            }
            length = 0;
            for (size_t index = 0; index < bytes; index++)
            {
                length = (length << 8) | static_cast<uint8_t>(der[offset++]);
            }
        }
        if (length > der.size() - offset)
        {
            return std::nullopt;
        }
        Element element{tag, der.substr(offset, length),
                        der.substr(start, offset + length - start)};
        offset += length;
        return element;
    }

    std::vector<Element> children(const std::string &content)
    {
        std::vector<Element> list;
        size_t               offset = 0;
        while (std::optional<Element> element = readElement(content, offset))
        {
            list.push_back(std::move(*element));
        }
        return list;
    }

    std::string nameAttribute(const std::string &name, const std::string &oid)
    {
        for (const Element &set : children(name))
        {
            for (const Element &pair : children(set.content))
            {
                std::vector<Element> parts = children(pair.content);
                if (parts.size() >= 2 && parts[0].tag == 0x06 && parts[0].content == oid)
                {
                    return parts[1].content;
                }
            }
        }
        return "";
    }

    std::vector<Element> tbsFields(const std::string &der)
    {
        size_t                 offset      = 0;
        std::optional<Element> certificate = readElement(der, offset);
        if (!certificate || certificate->tag != 0x30)
        {
            return {};
        }
        std::vector<Element> parts = children(certificate->content);
        if (parts.empty() || parts[0].tag != 0x30)
        {
            return {};
        }
        std::vector<Element> fields = children(parts[0].content);
        if (!fields.empty() && fields[0].tag == 0xa0)
        {
            fields.erase(fields.begin());
        }
        return fields;
    }

    std::string subjectOf(const std::string &der)
    {
        std::vector<Element> fields = tbsFields(der);
        return fields.size() > 4 ? fields[4].whole : "";
    }

    std::string issuerOf(const std::string &der)
    {
        std::vector<Element> fields = tbsFields(der);
        return fields.size() > 2 ? fields[2].whole : "";
    }
}

std::string versionString(uint32_t packed)
{
    uint32_t    major = packed >> 16;
    uint32_t    minor = (packed >> 8) & 0xff;
    uint32_t    patch = packed & 0xff;
    std::string text  = std::to_string(major) + "." + std::to_string(minor);
    return patch ? text + "." + std::to_string(patch) : text;
}

std::optional<Anatomy> parseAnatomy(const std::string &image)
{
    if (image.size() < kMachHeaderSize || little32(image, 0) != codesign::kMachOMagic64)
    {
        return std::nullopt;
    }
    Anatomy  anatomy;
    uint32_t count       = little32(image, 16);
    anatomy.loadCommands = count;
    size_t offset        = kMachHeaderSize;
    for (uint32_t index = 0; index < count && offset + 8 <= image.size(); index++)
    {
        uint32_t command = little32(image, offset);
        uint32_t size    = little32(image, offset + 4);
        if (size < 8 || offset + size > image.size())
        {
            break;
        }
        if (command == kUUIDCommand && size >= 24)
        {
            anatomy.uuid = uuidString(image, offset + 8);
        }
        else if (command == kEncryptionInfo64 && size >= 20)
        {
            anatomy.cryptid = little32(image, offset + 16);
        }
        else if (command == kBuildVersion && size >= 24)
        {
            anatomy.minimumOS = versionString(little32(image, offset + 12));
            anatomy.sdk       = versionString(little32(image, offset + 16));
        }
        else if (command == kVersionMinIPhoneOS && size >= 16 && anatomy.minimumOS.empty())
        {
            anatomy.minimumOS = versionString(little32(image, offset + 8));
            anatomy.sdk       = versionString(little32(image, offset + 12));
        }
        else if ((command == kLoadDylib || command == kLoadWeakDylib ||
                  command == kReexportDylib) &&
                 size >= 24)
        {
            uint32_t    nameOffset = little32(image, offset + 8);
            std::string name =
                nameOffset < size ? image.substr(offset + nameOffset, size - nameOffset) : "";
            anatomy.dylibs.push_back(name.substr(0, name.find('\0')));
        }
        offset += size;
    }
    return anatomy;
}

std::optional<Anatomy> readAnatomy(const std::string &executablePath)
{
    std::ifstream stream(executablePath, std::ios::binary);
    if (!stream)
    {
        return std::nullopt;
    }
    std::optional<uint64_t>    base = arm64SliceOffset(stream);
    std::optional<std::string> header =
        base ? readRange(stream, *base, kMachHeaderSize) : std::nullopt;
    if (!header || little32(*header, 0) != codesign::kMachOMagic64)
    {
        return std::nullopt;
    }
    size_t commandBytes                = std::min<size_t>(little32(*header, 20), kMaxHeaderBytes);
    std::optional<std::string> image   = readRange(stream, *base, kMachHeaderSize + commandBytes);
    std::optional<Anatomy>     anatomy = image ? parseAnatomy(*image) : std::nullopt;
    if (!anatomy)
    {
        return std::nullopt;
    }
    size_t offset = kMachHeaderSize;
    for (uint32_t index = 0; index < anatomy->loadCommands && offset + 16 <= image->size(); index++)
    {
        uint32_t command = little32(*image, offset);
        uint32_t size    = little32(*image, offset + 4);
        if (size < 8)
        {
            break;
        }
        if (command == kCodeSignature)
        {
            uint32_t dataOffset = little32(*image, offset + 8);
            uint32_t dataSize =
                std::min<uint32_t>(little32(*image, offset + 12), kMaxSignatureBytes);
            std::optional<std::string> superBlob = readRange(stream, *base + dataOffset, dataSize);
            if (superBlob && superBlob->size() >= 12 &&
                big32(*superBlob, 0) == codesign::kEmbeddedSignatureMagic)
            {
                uint32_t blobs = big32(*superBlob, 8);
                for (uint32_t slot = 0; slot < blobs && 12 + slot * 8 + 8 <= superBlob->size();
                     slot++)
                {
                    if (big32(*superBlob, 12 + slot * 8) != kSignatureSlot)
                    {
                        continue;
                    }
                    uint32_t blobOffset = big32(*superBlob, 12 + slot * 8 + 4);
                    if (blobOffset + 8 > superBlob->size() ||
                        big32(*superBlob, blobOffset) != kBlobWrapperMagic)
                    {
                        break;
                    }
                    uint32_t length = big32(*superBlob, blobOffset + 4);
                    if (length >= 8 && blobOffset + length <= superBlob->size())
                    {
                        anatomy->signature = superBlob->substr(blobOffset + 8, length - 8);
                    }
                    break;
                }
            }
            break;
        }
        offset += size;
    }
    return anatomy;
}

std::vector<std::string> cmsCertificates(const std::string &cms)
{
    size_t                 offset      = 0;
    std::optional<Element> contentInfo = readElement(cms, offset);
    if (!contentInfo || contentInfo->tag != 0x30)
    {
        return {};
    }
    std::vector<Element> info = children(contentInfo->content);
    if (info.size() < 2 || info[1].tag != 0xa0)
    {
        return {};
    }
    std::vector<Element> wrapped = children(info[1].content);
    if (wrapped.empty() || wrapped[0].tag != 0x30)
    {
        return {};
    }
    std::vector<std::string> certificates;
    for (const Element &field : children(wrapped[0].content))
    {
        if (field.tag != 0xa0)
        {
            continue;
        }
        for (const Element &certificate : children(field.content))
        {
            if (certificate.tag == 0x30)
            {
                certificates.push_back(certificate.whole);
            }
        }
        break;
    }
    return certificates;
}

std::optional<Certificate> describeCertificate(const std::string &der)
{
    std::vector<Element> fields = tbsFields(der);
    if (fields.size() < 5)
    {
        return std::nullopt;
    }
    Certificate certificate;
    certificate.commonName         = nameAttribute(fields[4].content, kCommonNameOID);
    certificate.organizationalUnit = nameAttribute(fields[4].content, kOrgUnitOID);
    certificate.organization       = nameAttribute(fields[4].content, kOrganizationOID);
    certificate.issuerCommonName   = nameAttribute(fields[2].content, kCommonNameOID);
    certificate.fingerprint        = crypto::hex(crypto::sha256(der)).substr(0, kFingerprintLength);
    return certificate;
}

std::optional<Certificate> signer(const std::string &cms)
{
    std::vector<std::string> certificates = cmsCertificates(cms);
    for (const std::string &candidate : certificates)
    {
        std::string subject = subjectOf(candidate);
        bool        issuesAnother =
            std::any_of(certificates.begin(), certificates.end(), [&](const std::string &other) {
                return &other != &candidate && issuerOf(other) == subject;
            });
        if (!issuesAnother)
        {
            return describeCertificate(candidate);
        }
    }
    return std::nullopt;
}

std::string signerLine(const Certificate &certificate)
{
    std::string kind = certificate.commonName.substr(0, certificate.commonName.find(':'));
    std::string line =
        certificate.fingerprint + " · " + (kind.empty() ? "unnamed certificate" : kind);
    return certificate.organizationalUnit.empty() ? line
                                                  : line + " · " + certificate.organizationalUnit;
}

std::string anatomyLine(const Anatomy &anatomy, const std::string &bundlePath)
{
    std::vector<std::string> parts;
    if (anatomy.cryptid)
    {
        parts.push_back(*anatomy.cryptid ? "encrypted" : "decrypted");
    }
    if (!anatomy.minimumOS.empty())
    {
        parts.push_back("min " + anatomy.minimumOS + " · SDK " + anatomy.sdk);
    }
    size_t injected =
        std::count_if(anatomy.dylibs.begin(), anatomy.dylibs.end(), [&](const std::string &path) {
            return !path.starts_with("/System/") && !path.starts_with("/usr/lib/") &&
                   !path.starts_with("@rpath/") && !path.starts_with(bundlePath);
        });
    parts.push_back(std::to_string(anatomy.dylibs.size()) + " dylibs" +
                    (injected ? " (" + std::to_string(injected) + " added)" : ""));
    if (!anatomy.uuid.empty())
    {
        parts.push_back("UUID " + anatomy.uuid.substr(0, 8));
    }
    std::string line;
    for (const std::string &part : parts)
    {
        line += (line.empty() ? "" : " · ") + part;
    }
    return line;
}
}
