#include <cassert>
#include <cstdint>
#include <cstring>
#include <string>

#include "LoaderAttestation.h"
#include "LoaderCrypto.h"

using namespace loader;
using namespace loader::attestation;

static constexpr int32_t     kARM64        = 0x0100000c;
static constexpr int32_t     kARM64E       = 2;
static constexpr int32_t     kX86_64       = 0x01000007;
static constexpr size_t      kHeaderSize   = 32;
static constexpr size_t      kTextSize     = 72 + 80;
static constexpr size_t      kLinkeditSize = 72;
static constexpr size_t      kSignSize     = 16;
static constexpr size_t      kSection      = 512;
static constexpr size_t      kSignature    = 1024;
static constexpr size_t      kSignatureLen = 64;
static constexpr const char *kGoELFCanonicalDigest =
    "29d2713b315ef31b19e1cebfa5f0b4c5b9a793b91b2df7e62f51437009b61c17";
static constexpr const char *kGoCanonicalDigest =
    "fc022ffc817e367f6293adf91242fbe729532a55fec2c0d5455d7e6b7628fe48";

static void putLittle(std::string &data, size_t offset, uint64_t value, size_t width)
{
    for (size_t index = 0; index < width; index++)
    {
        data[offset + index] = static_cast<char>((value >> (8 * index)) & 0xff);
    }
}

static void putBig(std::string &data, size_t offset, uint64_t value, size_t width)
{
    for (size_t index = 0; index < width; index++)
    {
        data[offset + index] = static_cast<char>((value >> (8 * (width - 1 - index))) & 0xff);
    }
}

static void putName(std::string &data, size_t offset, const char *name)
{
    std::memcpy(data.data() + offset, name, std::strlen(name));
}

static std::string thinMachO(int32_t cpuSubtype)
{
    std::string data(kSignature + kSignatureLen, '\0');
    putLittle(data, 0, 0xfeedfacf, 4);
    putLittle(data, 4, kARM64, 4);
    putLittle(data, 8, static_cast<uint32_t>(cpuSubtype), 4);
    putLittle(data, 16, 3, 4);
    putLittle(data, 20, kTextSize + kLinkeditSize + kSignSize, 4);

    size_t text = kHeaderSize;
    putLittle(data, text, 0x19, 4);
    putLittle(data, text + 4, kTextSize, 4);
    putName(data, text + 8, "__TEXT");
    putLittle(data, text + 64, 1, 4);
    putName(data, text + 72, "__attestation");
    putName(data, text + 88, "__TEXT");
    putLittle(data, text + 112, kSectionSize, 8);
    putLittle(data, text + 120, kSection, 4);

    size_t linkedit = text + kTextSize;
    putLittle(data, linkedit, 0x19, 4);
    putLittle(data, linkedit + 4, kLinkeditSize, 4);
    putName(data, linkedit + 8, "__LINKEDIT");
    putLittle(data, linkedit + 32, 0x4000, 8);
    putLittle(data, linkedit + 48, 0x3000, 8);

    size_t signature = linkedit + kLinkeditSize;
    putLittle(data, signature, 0x1d, 4);
    putLittle(data, signature + 4, kSignSize, 4);
    putLittle(data, signature + 8, kSignature, 4);
    putLittle(data, signature + 12, kSignatureLen, 4);

    for (size_t index = kSection + kSectionSize; index < kSignature; index++)
    {
        data[index] = static_cast<char>(index * 7);
    }
    for (size_t index = kSignature; index < data.size(); index++)
    {
        data[index] = static_cast<char>(0xa5);
    }
    return data;
}

static void writeRecord(std::string &data, int32_t cpuSubtype, const std::string &digest)
{
    putLittle(data, kSection, kMagic, 4);
    putLittle(data, kSection + 4, kVersion, 2);
    putLittle(data, kSection + 6, kAlgorithmP256SHA256, 2);
    putLittle(data, kSection + 8, kSectionSize, 4);
    putLittle(data, kSection + 12, kKeyID, 4);
    putLittle(data, kSection + 16, kARM64, 4);
    putLittle(data, kSection + 20, static_cast<uint32_t>(cpuSubtype), 4);
    std::memcpy(data.data() + kSection + kDigestOffset, digest.data(), digest.size());
    putLittle(data, kSection + kSignatureLengthOffset, 70, 2);
    std::memset(data.data() + kSection + kSignatureOffset, 0x5a, 70);
    putName(data, kSection + kCommitHashOffset, "0123456789abcdef0123456789abcdef01234567");
}

static std::string attested(int32_t cpuSubtype)
{
    std::string data = thinMachO(cpuSubtype);
    writeRecord(data, cpuSubtype, std::string(32, '\0'));
    const SliceLayout layout = *parseSlice(data);
    writeRecord(data, cpuSubtype, *canonicalDigest(data, layout));
    return data;
}

static std::string fat(const std::string &first, int32_t firstSubtype, const std::string &second,
                       int32_t secondSubtype, int32_t secondCPU, bool wide)
{
    const size_t entrySize = wide ? 32 : 20;
    const size_t offset    = 0x4000;
    std::string  data(offset * 3, '\0');
    putBig(data, 0, wide ? 0xcafebabf : 0xcafebabe, 4);
    putBig(data, 4, 2, 4);
    const std::string slices[] = {first, second};
    const int32_t     cpus[]   = {kARM64, secondCPU};
    const int32_t     subs[]   = {firstSubtype, secondSubtype};
    for (size_t index = 0; index < 2; index++)
    {
        const size_t entry = 8 + index * entrySize;
        putBig(data, entry, static_cast<uint32_t>(cpus[index]), 4);
        putBig(data, entry + 4, static_cast<uint32_t>(subs[index]), 4);
        putBig(data, entry + 8, offset * (index + 1), wide ? 8 : 4);
        putBig(data, entry + (wide ? 16 : 12), slices[index].size(), wide ? 8 : 4);
        std::memcpy(data.data() + offset * (index + 1), slices[index].data(), slices[index].size());
    }
    return data;
}

static void parsesLayout()
{
    const std::string data   = thinMachO(0);
    const SliceLayout layout = *parseSlice(data);
    assert(layout.sectionOffset == kSection);
    assert(layout.sectionSize == kSectionSize);
    assert(layout.boundary == kSignature);
    assert(layout.hasCodeSignature && layout.hasLinkedit);
    assert(layout.codeSignatureCommand == kHeaderSize + kTextSize + kLinkeditSize);
    assert(layout.linkeditVMSize == kHeaderSize + kTextSize + 32);
    assert(layout.linkeditFileSize == kHeaderSize + kTextSize + 48);
    assert(layout.cpuType == kARM64);
}

static void matchesGoCanonicalDigest()
{
    const std::string data = thinMachO(0);
    assert(crypto::hex(*canonicalDigest(data, *parseSlice(data))) == kGoCanonicalDigest);
}

static void ignoresResignedFields()
{
    const std::string original = attested(0);
    std::string       resigned = original;
    putLittle(resigned, kSection + kSignatureLengthOffset, 71, 2);
    std::memset(resigned.data() + kSection + kSignatureOffset, 0x11, kSignatureCapacity);
    putLittle(resigned, kHeaderSize + kTextSize + kLinkeditSize + 12, 48, 4);
    putLittle(resigned, kHeaderSize + kTextSize + 32, 0x8000, 8);
    putLittle(resigned, kHeaderSize + kTextSize + 48, 0x7000, 8);
    std::memset(resigned.data() + kSignature, 0x3c, kSignatureLen);
    assert(*canonicalDigest(original, *parseSlice(original)) ==
           *canonicalDigest(resigned, *parseSlice(resigned)));

    std::string patched = original;
    patched[kSection + kSectionSize + 3] ^= 1;
    assert(*canonicalDigest(original, *parseSlice(original)) !=
           *canonicalDigest(patched, *parseSlice(patched)));
}

static void evaluatesThinSlices()
{
    const std::string data       = attested(kARM64E);
    const Evaluation  evaluation = evaluate(data, kARM64, kARM64E);
    assert(!evaluation.failure);
    assert(evaluation.digest == evaluation.record.digest);
    assert(evaluation.record.signature == std::string(70, '\x5a'));
    assert(evaluation.record.commitHash == "0123456789abcdef0123456789abcdef01234567");

    std::string patched = data;
    patched[kSection + kSectionSize] ^= 1;
    assert(evaluate(patched, kARM64, kARM64E).failure == "Mach-O digest mismatch");

    std::string wrongKey = data;
    putLittle(wrongKey, kSection + 12, 1, 4);
    assert(evaluate(wrongKey, kARM64, kARM64E).failure == "attestation metadata is invalid");
    std::string wrongCPU = data;
    putLittle(wrongCPU, kSection + 20, 0, 4);
    assert(evaluate(wrongCPU, kARM64, kARM64E).failure == "attestation metadata is invalid");
    std::string noSignature = data;
    putLittle(noSignature, kSection + kSignatureLengthOffset, 0, 2);
    assert(evaluate(noSignature, kARM64, kARM64E).failure == "attestation metadata is invalid");
    std::string longSignature = data;
    putLittle(longSignature, kSection + kSignatureLengthOffset, kSignatureCapacity + 1, 2);
    assert(evaluate(longSignature, kARM64, kARM64E).failure == "attestation metadata is invalid");
}

static void selectsFatSlices()
{
    const std::string arm64  = attested(0);
    const std::string arm64e = attested(kARM64E);
    for (bool wide : {false, true})
    {
        const std::string universal = fat(arm64, 0, arm64e, kARM64E, kARM64, wide);
        assert(*loadedSlice(universal, kARM64, kARM64E) == arm64e);
        assert(*loadedSlice(universal, kARM64, 0) == arm64);
        assert(*loadedSlice(universal, kARM64, static_cast<int32_t>(0x80000002)) == arm64e);
        assert(*loadedSlice(universal, kARM64, 5) == arm64);
        assert(!loadedSlice(universal, kX86_64, 3));
        assert(!evaluate(universal, kARM64, kARM64E).failure);
        assert(evaluate(universal, kX86_64, 3).failure ==
               "unable to select the loaded architecture slice");
    }
    std::string truncated = fat(arm64, 0, arm64e, kARM64E, kARM64, false);
    truncated.resize(0x4000 * 2 + 10);
    assert(!loadedSlice(truncated, kARM64, kARM64E));
}

static void rejectsMalformedLayouts()
{
    assert(!parseSlice(""));
    assert(!parseSlice(std::string(31, '\0')));
    std::string data = thinMachO(0);
    assert(evaluate(data.substr(0, 3), kARM64, 0).failure ==
           "unable to select the loaded architecture slice");

    std::string wrongMagic = data;
    putLittle(wrongMagic, 0, 0xfeedface, 4);
    assert(!parseSlice(wrongMagic));
    std::string oversizedCommands = data;
    putLittle(oversizedCommands, 20, data.size(), 4);
    assert(!parseSlice(oversizedCommands));
    std::string shortCommand = data;
    putLittle(shortCommand, kHeaderSize + 4, 4, 4);
    assert(!parseSlice(shortCommand));
    std::string tooManySections = data;
    putLittle(tooManySections, kHeaderSize + 64, 2, 4);
    assert(!parseSlice(tooManySections));
    std::string wrongSectionSize = data;
    putLittle(wrongSectionSize, kHeaderSize + 112, 128, 8);
    assert(!parseSlice(wrongSectionSize));
    std::string missingSection = data;
    putName(missingSection, kHeaderSize + 72, "__other_section");
    assert(!parseSlice(missingSection));
    assert(evaluate(missingSection, kARM64, 0).failure == "invalid Mach-O attestation layout");
    std::string signatureOutside = data;
    putLittle(signatureOutside, kHeaderSize + kTextSize + kLinkeditSize + 12, 4096, 4);
    assert(!parseSlice(signatureOutside));
    std::string sectionAfterSignature = data;
    putLittle(sectionAfterSignature, kHeaderSize + kTextSize + kLinkeditSize + 8, 600, 4);
    assert(!parseSlice(sectionAfterSignature));
}

static constexpr uint16_t kAArch64 = 183;

static std::string attestedELF()
{
    std::string data(1024, '\0');
    data.replace(0, 4,
                 "\x7f"
                 "ELF",
                 4);
    data[4] = 2;
    data[5] = 1;
    putLittle(data, 18, kAArch64, 2);
    putLittle(data, 40, 512, 8);
    putLittle(data, 58, 64, 2);
    putLittle(data, 60, 3, 2);
    putLittle(data, 62, 2, 2);

    const char names[] = "\0.unbound.attestation\0.shstrtab";
    data.replace(400, sizeof(names), names, sizeof(names));
    putLittle(data, 512 + 64, 1, 4);
    putLittle(data, 512 + 64 + 24, 128, 8);
    putLittle(data, 512 + 64 + 32, kSectionSize, 8);
    putLittle(data, 512 + 128, 22, 4);
    putLittle(data, 512 + 128 + 24, 400, 8);
    putLittle(data, 512 + 128 + 32, sizeof(names), 8);

    putLittle(data, 128, kMagic, 4);
    putLittle(data, 132, kVersion, 2);
    putLittle(data, 134, kAlgorithmP256SHA256, 2);
    putLittle(data, 136, kSectionSize, 4);
    putLittle(data, 140, kKeyID, 4);
    putLittle(data, 144, kAArch64, 4);
    putLittle(data, 128 + kSignatureLengthOffset, 3, 2);
    data.replace(128 + kSignatureOffset, 3, "sig");
    data.replace(128 + kCommitHashOffset, 7, "abc1234");
    data.replace(900, 5, "code!");

    const SliceLayout layout = *parseELF(data);
    data.replace(128 + kDigestOffset, crypto::kSHA256Bytes, *canonicalDigest(data, layout));
    return data;
}

static void evaluatesELFLibraries()
{
    const std::string data   = attestedELF();
    const SliceLayout layout = *parseELF(data);
    assert(layout.sectionOffset == 128);
    assert(layout.cpuType == kAArch64);
    assert(crypto::hex(*canonicalDigest(data, layout)) == kGoELFCanonicalDigest);

    const Evaluation evaluation = evaluate(data, kAArch64, 0);
    assert(!evaluation.failure);
    assert(evaluation.record.commitHash == "abc1234");
    assert(*evaluate(data, 62, 0).failure == "the library was built for another architecture");

    std::string tampered = data;
    tampered[900]        = 'C';
    assert(*evaluate(tampered, kAArch64, 0).failure == "ELF digest mismatch");

    std::string unnamed = data;
    unnamed[401]        = 'x';
    assert(!parseELF(unnamed));
}

static void decodesPinnedKey()
{
    const std::string point = *publicKeyPoint();
    assert(point.size() == 65);
    assert(point[0] == '\x04');
}

int main()
{
    parsesLayout();
    matchesGoCanonicalDigest();
    ignoresResignedFields();
    evaluatesThinSlices();
    selectsFatSlices();
    rejectsMalformedLayouts();
    decodesPinnedKey();
    evaluatesELFLibraries();
    return 0;
}
