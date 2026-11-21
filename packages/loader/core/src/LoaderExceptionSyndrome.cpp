#include "LoaderExceptionSyndrome.h"

#include <cstdlib>

namespace loader {
static std::string hex(uint64_t value)
{
    static const char *const kDigits = "0123456789abcdef";
    std::string text;
    do
    {
        text.insert(text.begin(), kDigits[value & 0xF]);
        value >>= 4;
    } while (value);

    return "0x" + text;
}

static std::string faultStatus(uint32_t status)
{
    uint32_t kind  = status & 0x3C;
    uint32_t level = status & 0x3;
    std::string at = " at level " + std::to_string(level);
    switch (kind)
    {
        case 0x04:
            return "translation fault (unmapped address)" + at;
        case 0x08:
            return "access flag fault" + at;
        case 0x0C:
            return "permission fault" + at;
        default:
            break;
    }

    switch (status)
    {
        case 0x10:
            return "synchronous external abort";
        case 0x21:
            return "alignment fault";
        case 0x30:
            return "TLB conflict";
        default:
            return "fault status " + hex(status);
    }
}

std::string describeExceptionSyndrome(uint64_t esr)
{
    uint32_t exceptionClass = static_cast<uint32_t>((esr >> 26) & 0x3F);
    uint32_t iss            = static_cast<uint32_t>(esr & 0x1FFFFFF);
    switch (exceptionClass)
    {
        case 0x3C:
            return "BRK #" + hex(iss & 0xFFFF)
                   + " (trap instruction, such as a failed Swift check)";
        case 0x24:
        case 0x25:
            return std::string("data abort on ") + ((iss >> 6) & 1 ? "write" : "read") + ": "
                   + faultStatus(iss & 0x3F);
        case 0x20:
        case 0x21:
            return "instruction abort: " + faultStatus(iss & 0x3F);
        case 0x22:
            return "PC alignment fault";
        case 0x26:
            return "SP alignment fault";
        case 0x0E:
            return "illegal execution state";
        case 0x2C:
            return "floating-point exception";
        case 0x15:
            return "SVC #" + hex(iss & 0xFFFF);
        case 0x00:
            return "unknown instruction (undefined or not allowed here)";
        default:
            return "exception class " + hex(exceptionClass);
    }
}

std::optional<uint64_t> syndromeOfRegisters(const std::string &registersLine)
{
    size_t at = registersLine.find(" esr=0x");
    if (registersLine.rfind("Registers", 0) != 0 || at == std::string::npos)
    {
        return std::nullopt;
    }

    const char *start = registersLine.c_str() + at + 7;
    char *end         = nullptr;
    uint64_t value    = std::strtoull(start, &end, 16);
    return end == start ? std::nullopt : std::optional<uint64_t>(value);
}
}
