#pragma once

#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <string_view>

namespace loader::attestation {
constexpr uint32_t    kMagic                 = 0x41545453u;
constexpr uint16_t    kVersion               = 1;
constexpr uint16_t    kAlgorithmP256SHA256   = 1;
constexpr uint32_t    kKeyID                 = 0x3ce00b70u;
constexpr size_t      kSectionSize           = 256;
constexpr size_t      kSignatureCapacity     = 96;
constexpr size_t      kDigestOffset          = 24;
constexpr size_t      kSignatureLengthOffset = 56;
constexpr size_t      kSignatureOffset       = 60;
constexpr size_t      kCommitHashOffset      = 156;
constexpr size_t      kCommitHashCapacity    = 41;
constexpr const char *kELFSectionName        = ".unbound.attestation";

struct Record {
    uint32_t    magic      = 0;
    uint16_t    version    = 0;
    uint16_t    algorithm  = 0;
    uint32_t    size       = 0;
    uint32_t    keyID      = 0;
    int32_t     cpuType    = 0;
    int32_t     cpuSubtype = 0;
    std::string digest;
    uint16_t    signatureLength = 0;
    std::string signature;
    std::string commitHash;
};

struct SliceLayout {
    size_t  size                 = 0;
    size_t  boundary             = 0;
    size_t  sectionOffset        = 0;
    size_t  sectionSize          = 0;
    size_t  codeSignatureCommand = 0;
    size_t  linkeditVMSize       = 0;
    size_t  linkeditFileSize     = 0;
    bool    hasCodeSignature     = false;
    bool    hasLinkedit          = false;
    int32_t cpuType              = 0;
    int32_t cpuSubtype           = 0;
};

struct Evaluation {
    std::optional<std::string> failure;
    Record                     record;
    std::string                digest;
};

std::optional<std::string_view> loadedSlice(std::string_view file, int32_t cpuType,
                                            int32_t cpuSubtype);
std::optional<SliceLayout>      parseSlice(std::string_view slice);
Record                          readRecord(std::string_view slice, const SliceLayout &layout);
bool                            hasValidMetadata(const Record &record, const SliceLayout &layout);
std::optional<std::string>      canonicalDigest(std::string_view slice, const SliceLayout &layout);
std::optional<SliceLayout>      parseELF(std::string_view file);
Evaluation evaluate(std::string_view file, int32_t loadedCpuType, int32_t loadedCpuSubtype);
std::optional<std::string> publicKeyPoint();
}
