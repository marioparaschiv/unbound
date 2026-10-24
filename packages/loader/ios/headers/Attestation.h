#ifndef Attestation_h
#define Attestation_h

#include <stdint.h>
#include <stdbool.h>

#define ATTESTATION_MAGIC 0x41545453u
#define ATTESTATION_VERSION 1u
#define ATTESTATION_ALGORITHM_P256_SHA256 1u
#define ATTESTATION_KEY_ID 0x3ce00b70u
#define ATTESTATION_SECTION_SIZE 256u
#define ATTESTATION_SIGNATURE_CAPACITY 96u

typedef struct __attribute__((packed)) {
    uint32_t magic;
    uint16_t version;
    uint16_t algorithm;
    uint32_t size;
    uint32_t keyId;
    int32_t cpuType;
    int32_t cpuSubtype;
    uint8_t digest[32];
    uint16_t signatureLength;
    uint16_t reservedHeader;
    uint8_t signature[ATTESTATION_SIGNATURE_CAPACITY];
    char commitHash[41];
    char packageVersion[32];
    uint8_t reserved[27];
} AttestationRecord;

typedef char AttestationRecordSizeCheck[(sizeof(AttestationRecord) == ATTESTATION_SECTION_SIZE) ? 1 : -1];

#ifdef __cplusplus
extern "C" {
#endif

bool VerifyEmbeddedAttestation(void);

#ifdef __cplusplus
}
#endif

#endif
