#include "HermesBytecodeHeader.h"

#include <cstring>
#include <fstream>

namespace loader {
struct HermesHeaderPrefix {
    uint64_t magic;
    uint32_t version;
} __attribute__((packed));

bool isHermesBytecode(const void *data, size_t length)
{
    if (!data || length < sizeof(HermesHeaderPrefix))
    {
        return false;
    }

    uint64_t magic = 0;
    std::memcpy(&magic, data, sizeof(magic));
    return magic == kHermesMagic;
}

uint32_t hermesBytecodeVersion(const void *data, size_t length)
{
    if (!isHermesBytecode(data, length))
    {
        return 0;
    }

    HermesHeaderPrefix prefix{};
    std::memcpy(&prefix, data, sizeof(prefix));
    return prefix.version;
}

uint32_t hermesBytecodeVersionOfFile(const std::string &path)
{
    std::ifstream stream(path, std::ios::binary);
    char          buffer[sizeof(HermesHeaderPrefix)] = {};
    if (!stream.read(buffer, sizeof(buffer)))
    {
        return 0;
    }

    return hermesBytecodeVersion(buffer, sizeof(buffer));
}
}
