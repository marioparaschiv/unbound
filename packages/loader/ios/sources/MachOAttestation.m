#import "Attestation.h"

#import <CommonCrypto/CommonDigest.h>
#import <Foundation/Foundation.h>
#import <Security/Security.h>
#import <dlfcn.h>
#import <mach-o/dyld.h>
#import <mach-o/fat.h>
#import <mach-o/loader.h>

#import "Logger.h"

#include <string.h>

#if ATTESTATION_ENABLED
__attribute__((section("__TEXT,__attestation"), used))
const unsigned char AttestationPlaceholder[ATTESTATION_SECTION_SIZE] = {0};
#endif

typedef struct
{
    size_t        size;
    size_t        boundary;
    size_t        sectionOffset;
    size_t        sectionSize;
    size_t        codeSignatureCommand;
    size_t        linkeditVmsize;
    size_t        linkeditFilesize;
    bool          hasCodeSignature;
    bool          hasLinkedit;
    cpu_type_t    cpuType;
    cpu_subtype_t cpuSubtype;
} AttestationSliceInfo;

static bool readUInt32(const uint8_t *bytes, size_t length, size_t offset, uint32_t *value)
{
    if (offset > length || length - offset < sizeof(uint32_t))
    {
        return false;
    }
    memcpy(value, bytes + offset, sizeof(uint32_t));
    return true;
}

static bool readUInt64(const uint8_t *bytes, size_t length, size_t offset, uint64_t *value)
{
    if (offset > length || length - offset < sizeof(uint64_t))
    {
        return false;
    }
    memcpy(value, bytes + offset, sizeof(uint64_t));
    return true;
}

static uint32_t readBigEndianUInt32(const uint8_t *bytes)
{
    return ((uint32_t)bytes[0] << 24) | ((uint32_t)bytes[1] << 16) | ((uint32_t)bytes[2] << 8) |
           (uint32_t)bytes[3];
}

static uint64_t readBigEndianUInt64(const uint8_t *bytes)
{
    uint64_t value = 0;
    for (NSUInteger index = 0; index < 8; index++)
    {
        value = (value << 8) | bytes[index];
    }
    return value;
}

static bool namesEqual(const uint8_t *bytes, size_t length, size_t offset, const char *name)
{
    if (offset > length || length - offset < 16)
    {
        return false;
    }
    char value[17] = {0};
    memcpy(value, bytes + offset, 16);
    return strncmp(value, name, 16) == 0;
}

static bool parseSlice(const uint8_t *bytes, size_t length, AttestationSliceInfo *result)
{
    uint32_t magic = 0;
    uint32_t commandCount = 0;
    uint32_t commandSize = 0;
    if (!readUInt32(bytes, length, 0, &magic) || magic != MH_MAGIC_64 || length < sizeof(struct mach_header_64))
    {
        return false;
    }
    if (!readUInt32(bytes, length, offsetof(struct mach_header_64, ncmds), &commandCount) ||
        !readUInt32(bytes, length, offsetof(struct mach_header_64, sizeofcmds), &commandSize))
    {
        return false;
    }
    size_t commandsStart = sizeof(struct mach_header_64);
    if (commandSize > length - commandsStart)
    {
        return false;
    }
    memset(result, 0, sizeof(*result));
    result->size = length;
    memcpy(&result->cpuType, bytes + offsetof(struct mach_header_64, cputype), sizeof(result->cpuType));
    memcpy(&result->cpuSubtype, bytes + offsetof(struct mach_header_64, cpusubtype), sizeof(result->cpuSubtype));
    size_t commandOffset = commandsStart;
    size_t commandEnd = commandsStart + commandSize;
    for (uint32_t index = 0; index < commandCount; index++)
    {
        if (commandOffset > commandEnd || commandEnd - commandOffset < sizeof(struct load_command))
        {
            return false;
        }
        uint32_t command = 0;
        uint32_t currentCommandSize = 0;
        if (!readUInt32(bytes, length, commandOffset, &command) ||
            !readUInt32(bytes, length, commandOffset + sizeof(uint32_t), &currentCommandSize) ||
            currentCommandSize < sizeof(struct load_command) || currentCommandSize > commandEnd - commandOffset)
        {
            return false;
        }
        if (command == LC_SEGMENT_64)
        {
            if (currentCommandSize < sizeof(struct segment_command_64))
            {
                return false;
            }
            uint32_t sectionCount = 0;
            if (!readUInt32(bytes, length, commandOffset + offsetof(struct segment_command_64, nsects), &sectionCount) ||
                sectionCount > (currentCommandSize - sizeof(struct segment_command_64)) / sizeof(struct section_64))
            {
                return false;
            }
            if (namesEqual(bytes, length, commandOffset + offsetof(struct segment_command_64, segname), "__LINKEDIT"))
            {
                result->hasLinkedit = true;
                result->linkeditVmsize = commandOffset + offsetof(struct segment_command_64, vmsize);
                result->linkeditFilesize = commandOffset + offsetof(struct segment_command_64, filesize);
            }
            size_t sectionOffset = commandOffset + sizeof(struct segment_command_64);
            for (uint32_t sectionIndex = 0; sectionIndex < sectionCount; sectionIndex++)
            {
                if (namesEqual(bytes, length, sectionOffset + offsetof(struct section_64, sectname), "__attestation") &&
                    namesEqual(bytes, length, sectionOffset + offsetof(struct section_64, segname), "__TEXT"))
                {
                    uint64_t sectionSize = 0;
                    uint32_t sectionFileOffset = 0;
                    if (!readUInt64(bytes, length, sectionOffset + offsetof(struct section_64, size), &sectionSize) ||
                        !readUInt32(bytes, length, sectionOffset + offsetof(struct section_64, offset), &sectionFileOffset) ||
                        sectionSize != ATTESTATION_SECTION_SIZE || sectionFileOffset > length ||
                        sectionSize > length - sectionFileOffset)
                    {
                        return false;
                    }
                    result->sectionOffset = sectionFileOffset;
                    result->sectionSize = (size_t)sectionSize;
                }
                sectionOffset += sizeof(struct section_64);
            }
        }
        else if (command == LC_CODE_SIGNATURE)
        {
            if (currentCommandSize < sizeof(struct linkedit_data_command))
            {
                return false;
            }
            uint32_t dataOffset = 0;
            uint32_t dataSize = 0;
            if (!readUInt32(bytes, length, commandOffset + offsetof(struct linkedit_data_command, dataoff), &dataOffset) ||
                !readUInt32(bytes, length, commandOffset + offsetof(struct linkedit_data_command, datasize), &dataSize) ||
                dataOffset > length || dataSize > length - dataOffset)
            {
                return false;
            }
            result->hasCodeSignature = true;
            result->codeSignatureCommand = commandOffset;
            result->boundary = dataOffset;
        }
        commandOffset += currentCommandSize;
    }
    if (result->sectionSize != ATTESTATION_SECTION_SIZE)
    {
        return false;
    }
    if (!result->hasCodeSignature)
    {
        result->boundary = length;
    }
    if (result->boundary > length || result->sectionOffset > result->boundary ||
        result->sectionSize > result->boundary - result->sectionOffset)
    {
        return false;
    }
    return true;
}

static bool chooseLoadedSlice(const uint8_t *bytes,
                              size_t length,
                              cpu_type_t loadedCpuType,
                              cpu_subtype_t loadedCpuSubtype,
                              const uint8_t **slice,
                              size_t *sliceLength)
{
    if (length < sizeof(uint32_t))
    {
        return false;
    }
    uint32_t magic = readBigEndianUInt32(bytes);
    if (magic != FAT_MAGIC && magic != FAT_MAGIC_64)
    {
        *slice = bytes;
        *sliceLength = length;
        return true;
    }
    if (length < sizeof(struct fat_header))
    {
        return false;
    }
    uint32_t architectureCount = readBigEndianUInt32(bytes + sizeof(uint32_t));
    size_t entrySize = magic == FAT_MAGIC_64 ? sizeof(struct fat_arch_64) : sizeof(struct fat_arch);
    size_t entriesStart = sizeof(struct fat_header);
    if (architectureCount > (length - entriesStart) / entrySize)
    {
        return false;
    }
    const uint8_t *fallback = NULL;
    size_t fallbackLength = 0;
    for (uint32_t index = 0; index < architectureCount; index++)
    {
        const uint8_t *entry = bytes + entriesStart + index * entrySize;
        cpu_type_t cpuType = (cpu_type_t)readBigEndianUInt32(entry);
        cpu_subtype_t cpuSubtype = (cpu_subtype_t)readBigEndianUInt32(entry + sizeof(uint32_t));
        uint64_t offset = magic == FAT_MAGIC_64 ? readBigEndianUInt64(entry + 8) : readBigEndianUInt32(entry + 8);
        uint64_t size = magic == FAT_MAGIC_64 ? readBigEndianUInt64(entry + 16) : readBigEndianUInt32(entry + 12);
        if (offset > length || size > length - offset)
        {
            return false;
        }
        if (cpuType == loadedCpuType &&
            (cpuSubtype == loadedCpuSubtype || (cpuSubtype & 0xff) == (loadedCpuSubtype & 0xff)))
        {
            *slice = bytes + offset;
            *sliceLength = (size_t)size;
            return true;
        }
        if (!fallback && cpuType == loadedCpuType)
        {
            fallback = bytes + offset;
            fallbackLength = (size_t)size;
        }
    }
    if (fallback)
    {
        *slice = fallback;
        *sliceLength = fallbackLength;
        return true;
    }
    return false;
}

static bool zeroRange(NSMutableData *data, size_t offset, size_t length)
{
    if (offset > data.length || length > data.length - offset)
    {
        return false;
    }
    memset((uint8_t *)data.mutableBytes + offset, 0, length);
    return true;
}

static NSString *hexDigest(const uint8_t *digest)
{
    NSMutableString *result = [NSMutableString stringWithCapacity:64];
    for (NSUInteger index = 0; index < CC_SHA256_DIGEST_LENGTH; index++)
    {
        [result appendFormat:@"%02x", digest[index]];
    }
    return result;
}

static NSData *canonicalDigest(const uint8_t *slice, const AttestationSliceInfo *info)
{
    NSMutableData *canonical = [NSMutableData dataWithLength:info->boundary];
    memcpy(canonical.mutableBytes, slice, info->boundary);
    if (!zeroRange(canonical, info->sectionOffset + 24, 32) ||
        !zeroRange(canonical, info->sectionOffset + 56, 2) ||
        !zeroRange(canonical, info->sectionOffset + 60, ATTESTATION_SIGNATURE_CAPACITY))
    {
        return nil;
    }
    if (info->hasCodeSignature && !zeroRange(canonical, info->codeSignatureCommand + 8, 8))
    {
        return nil;
    }
    // Re-signers can grow the mapped __LINKEDIT range when the new blob is larger.
    if (info->hasLinkedit &&
        (!zeroRange(canonical, info->linkeditFilesize, 8) ||
         !zeroRange(canonical, info->linkeditVmsize, 8)))
    {
        return nil;
    }
    uint8_t digest[CC_SHA256_DIGEST_LENGTH] = {0};
    CC_SHA256(canonical.bytes, (CC_LONG)canonical.length, digest);
    return [NSData dataWithBytes:digest length:sizeof(digest)];
}

static NSData *publicKeyData(void)
{
    static NSData *data = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        data = [[NSData alloc] initWithBase64EncodedString:
                                      @"MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEQPX4NgN7w+oQW/t31KTzr45C8edXjinWB2pgvXhOqipWKRJ1wfnlfZmh4PwVtT9C/ng0bDA2RjvzxhHC6z0leA=="
                                      options:0];
    });
    return data;
}

static NSData *publicKeyBytes(void)
{
    NSData *data = publicKeyData();
    if (data.length == 65)
    {
        return data;
    }
    if (data.length > 65)
    {
        return [data subdataWithRange:NSMakeRange(data.length - 65, 65)];
    }
    return nil;
}

static bool failVerification(NSString *reason)
{
    [Logger error:LOG_CATEGORY_UTILITIES format:@"Embedded attestation failed: %@", reason];
    return false;
}

bool VerifyEmbeddedAttestation(void)
{
    Dl_info imageInfo = {0};
    if (dladdr((const void *)&VerifyEmbeddedAttestation, &imageInfo) == 0 || !imageInfo.dli_fname)
    {
        return failVerification(@"unable to resolve the loaded dylib path");
    }
    struct mach_header_64 *loadedHeader = (struct mach_header_64 *)imageInfo.dli_fbase;
    if (!loadedHeader || loadedHeader->magic != MH_MAGIC_64)
    {
        return failVerification(@"loaded image is not a 64-bit Mach-O");
    }
    NSError *fileError = nil;
    NSData *fileData = [NSData dataWithContentsOfFile:[NSString stringWithUTF8String:imageInfo.dli_fname]
                                               options:0
                                                 error:&fileError];
    if (!fileData)
    {
        return failVerification(fileError.localizedDescription ?: @"unable to read the loaded dylib");
    }
    const uint8_t *slice = NULL;
    size_t sliceLength = 0;
    if (!chooseLoadedSlice((const uint8_t *)fileData.bytes,
                           fileData.length,
                           loadedHeader->cputype,
                           loadedHeader->cpusubtype,
                           &slice,
                           &sliceLength))
    {
        return failVerification(@"unable to select the loaded architecture slice");
    }
    AttestationSliceInfo info = {0};
    if (!parseSlice(slice, sliceLength, &info))
    {
        return failVerification(@"invalid Mach-O attestation layout");
    }
    AttestationRecord attestation = {0};
    memcpy(&attestation, slice + info.sectionOffset, sizeof(attestation));
    if (attestation.magic != ATTESTATION_MAGIC || attestation.version != ATTESTATION_VERSION ||
        attestation.algorithm != ATTESTATION_ALGORITHM_P256_SHA256 ||
        attestation.size != ATTESTATION_SECTION_SIZE || attestation.keyId != ATTESTATION_KEY_ID ||
        attestation.cpuType != info.cpuType || attestation.cpuSubtype != info.cpuSubtype ||
        attestation.signatureLength == 0 || attestation.signatureLength > ATTESTATION_SIGNATURE_CAPACITY)
    {
        return failVerification(@"attestation metadata is invalid");
    }
    NSData *digest = canonicalDigest(slice, &info);
    if (!digest || memcmp(digest.bytes, attestation.digest, digest.length) != 0)
    {
        return failVerification(@"Mach-O digest mismatch");
    }
    CFErrorRef keyError = NULL;
    SecKeyRef publicKey = SecKeyCreateWithData(
        (__bridge CFDataRef)publicKeyBytes(),
        (__bridge CFDictionaryRef)@{
            (__bridge id)kSecAttrKeyType : (__bridge id)kSecAttrKeyTypeECSECPrimeRandom,
            (__bridge id)kSecAttrKeyClass : (__bridge id)kSecAttrKeyClassPublic,
            (__bridge id)kSecAttrKeySizeInBits : @256,
        },
        &keyError);
    if (!publicKey)
    {
        NSString *reason = keyError ? CFBridgingRelease(keyError) : @"unable to import the P-256 public key";
        return failVerification(reason);
    }
    NSData *signature = [NSData dataWithBytes:attestation.signature length:attestation.signatureLength];
    CFErrorRef verifyError = NULL;
    BOOL verified = SecKeyVerifySignature(publicKey,
                                          kSecKeyAlgorithmECDSASignatureDigestX962SHA256,
                                          (__bridge CFDataRef)digest,
                                          (__bridge CFDataRef)signature,
                                          &verifyError);
    CFRelease(publicKey);
    if (!verified)
    {
        NSString *reason = verifyError ? CFBridgingRelease(verifyError) : @"P-256 signature mismatch";
        return failVerification(reason);
    }
    [Logger info:LOG_CATEGORY_UTILITIES
          format:@"Embedded attestation verified for %@/%@ digest %@ commit %s",
                 @(attestation.cpuType),
                 @(attestation.cpuSubtype),
                 hexDigest((const uint8_t *)digest.bytes),
                 attestation.commitHash];
    return true;
}
