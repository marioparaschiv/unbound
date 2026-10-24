#pragma once

#import <stddef.h>
#import <stdint.h>


static const uint64_t HERMES_MAGIC = 0x1F1903C103BC1FC6ULL;

#pragma pack(push, 1)
typedef struct
{
    uint64_t magic;
    uint32_t version;
} HermesBytecodeFileHeaderPrefix;
#pragma pack(pop)

static inline BOOL HermesDataIsBytecode(const void *data, size_t length)
{
    if (!data || length < sizeof(HermesBytecodeFileHeaderPrefix))
        return NO;
    return ((const HermesBytecodeFileHeaderPrefix *) data)->magic == HERMES_MAGIC;
}

static inline uint32_t HermesDataBytecodeVersion(const void *data, size_t length)
{
    if (!HermesDataIsBytecode(data, length))
        return 0;
    return ((const HermesBytecodeFileHeaderPrefix *) data)->version;
}
