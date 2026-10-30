#import <Foundation/Foundation.h>
#import <Security/Security.h>
#import <dlfcn.h>
#import <mach-o/loader.h>

#import "Attestation.h"
#import "CoreConversions.h"
#include "LoaderAttestation.h"
#include "LoaderCrypto.h"
#import "Logger.h"

namespace attestation = loader::attestation;

#if ATTESTATION_ENABLED
extern "C" __attribute__((section("__TEXT,__attestation"), used))
const unsigned char AttestationPlaceholder[attestation::kSectionSize] = {0};
#endif

static NSData *dataOf(const std::string &bytes)
{
    return [NSData dataWithBytes:bytes.data() length:bytes.size()];
}

static bool failVerification(NSString *reason)
{
    [Logger error:LOG_CATEGORY_UTILITIES format:@"Embedded attestation failed: %@", reason];
    return false;
}

static SecKeyRef createPublicKey(CFErrorRef *error)
{
    std::optional<std::string> point = attestation::publicKeyPoint();
    if (!point)
    {
        return NULL;
    }
    return SecKeyCreateWithData((__bridge CFDataRef) dataOf(*point), (__bridge CFDictionaryRef) @{
        (__bridge id) kSecAttrKeyType : (__bridge id) kSecAttrKeyTypeECSECPrimeRandom,
        (__bridge id) kSecAttrKeyClass : (__bridge id) kSecAttrKeyClassPublic,
        (__bridge id) kSecAttrKeySizeInBits : @256,
    },
                                error);
}

bool VerifyEmbeddedAttestation(void)
{
    Dl_info imageInfo = {0};
    if (dladdr((const void *) &VerifyEmbeddedAttestation, &imageInfo) == 0 || !imageInfo.dli_fname)
    {
        return failVerification(@"unable to resolve the loaded dylib path");
    }
    const struct mach_header_64 *loadedHeader = (const struct mach_header_64 *) imageInfo.dli_fbase;
    if (!loadedHeader || loadedHeader->magic != MH_MAGIC_64)
    {
        return failVerification(@"loaded image is not a 64-bit Mach-O");
    }
    NSError *fileError = nil;
    NSData  *fileData =
        [NSData dataWithContentsOfFile:[NSString stringWithUTF8String:imageInfo.dli_fname]
                               options:0
                                 error:&fileError];
    if (!fileData)
    {
        return failVerification(fileError.localizedDescription
                                    ?: @"unable to read the loaded dylib");
    }

    attestation::Evaluation evaluation = attestation::evaluate(
        std::string_view(static_cast<const char *>(fileData.bytes), fileData.length),
        loadedHeader->cputype, loadedHeader->cpusubtype);
    if (evaluation.failure)
    {
        return failVerification(astral::ios::toNSString(*evaluation.failure));
    }

    CFErrorRef keyError  = NULL;
    SecKeyRef  publicKey = createPublicKey(&keyError);
    if (!publicKey)
    {
        NSString *reason =
            keyError ? CFBridgingRelease(keyError) : @"unable to import the P-256 public key";
        return failVerification(reason);
    }
    CFErrorRef verifyError = NULL;
    BOOL verified = SecKeyVerifySignature(publicKey, kSecKeyAlgorithmECDSASignatureDigestX962SHA256,
                                          (__bridge CFDataRef) dataOf(evaluation.digest),
                                          (__bridge CFDataRef) dataOf(evaluation.record.signature),
                                          &verifyError);
    CFRelease(publicKey);
    if (!verified)
    {
        NSString *reason =
            verifyError ? CFBridgingRelease(verifyError) : @"P-256 signature mismatch";
        return failVerification(reason);
    }
    [Logger info:LOG_CATEGORY_UTILITIES
          format:@"Embedded attestation verified for %@/%@ digest %s commit %s",
                 @(evaluation.record.cpuType), @(evaluation.record.cpuSubtype),
                 loader::crypto::hex(evaluation.digest).c_str(),
                 evaluation.record.commitHash.c_str()];
    return true;
}
