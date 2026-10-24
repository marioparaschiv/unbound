#pragma once

#include <cstddef>
#include <cstdint>
#include <string>

namespace loader
{
    constexpr uint64_t kHermesMagic = 0x1F1903C103BC1FC6ULL;

    bool isHermesBytecode(const void *data, size_t length);
    uint32_t hermesBytecodeVersion(const void *data, size_t length);
    uint32_t hermesBytecodeVersionOfFile(const std::string &path);
}
