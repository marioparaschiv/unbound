#include <cassert>
#include <cstdint>
#include <string>

#include "LoaderCrashHandler.h"
#include "LoaderTombstone.h"

namespace {
std::string varint(uint64_t value)
{
    std::string bytes;
    do
    {
        uint8_t byte = value & 0x7f;
        value >>= 7;
        bytes.push_back(static_cast<char>(byte | (value ? 0x80 : 0)));
    } while (value);
    return bytes;
}

std::string number(uint32_t field, uint64_t value)
{
    return varint(field << 3) + varint(value);
}

std::string bytes(uint32_t field, const std::string &payload)
{
    return varint((field << 3) | 2) + varint(payload.size()) + payload;
}

std::string frame(uint64_t relativePC, uint64_t pc, const std::string &function, uint64_t offset,
                  const std::string &file)
{
    std::string encoded = number(1, relativePC) + number(2, pc) + number(3, 0x7ff0);
    if (!function.empty())
    {
        encoded += bytes(4, function) + number(5, offset);
    }
    return encoded + bytes(6, file) + bytes(8, "abcdef");
}

std::string thread(uint32_t id, const std::string &name, const std::string &frames)
{
    std::string registers = bytes(1, "x0") + number(2, 42);
    return number(1, id) + bytes(2, name) + bytes(3, registers) + frames;
}

std::string threadEntry(uint32_t id, const std::string &encodedThread)
{
    return bytes(16, number(1, id) + bytes(2, encodedThread));
}
}

int main()
{
    std::string crashing = thread(1234, "mqt_js",
                                  bytes(4, frame(0x1a2b, 0x7100001a2b, "hermes::vm::Runtime::crash",
                                                 12, "/data/app/libhermes.so")) +
                                      bytes(4, frame(0x20, 0x7200000020, "", 0, "/apex/libc.so")));
    std::string other    = thread(1000, "main", bytes(4, frame(1, 2, "main", 0, "/system/app")));

    std::string tombstone = number(1, 1) + bytes(2, "google/fingerprint") + number(5, 1000) +
                            number(6, 1234) + bytes(10, number(1, 11) + bytes(2, "SIGSEGV")) +
                            bytes(14, "assertion failed") + threadEntry(1000, other) +
                            threadEntry(1234, crashing) + varint((99 << 3) | 1) +
                            std::string(8, '\x01');

    std::optional<std::string> stack = loader::tombstoneStack(tombstone);
    assert(stack);
    assert(*stack == "Signal 11 (SIGSEGV) in thread 1234 (mqt_js), from Android's tombstone\n"
                     "Abort message: assertion failed\n"
                     "#0 0x7100001a2b /data/app/libhermes.so + 0x1a2b "
                     "hermes::vm::Runtime::crash+12\n"
                     "#1 0x7200000020 /apex/libc.so + 0x20\n");

    assert(!loader::tombstoneStack(number(6, 5) + threadEntry(1000, other)));
    assert(!loader::tombstoneStack(tombstone.substr(0, tombstone.size() / 2)) ||
           loader::tombstoneStack(tombstone.substr(0, tombstone.size() / 2))->find("#0") == 0);
    assert(!loader::tombstoneStack(""));
    assert(
        !loader::tombstoneStack(std::string("\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff", 11)));
    assert(!loader::tombstoneStack(varint((16 << 3) | 2) + varint(1000)));

    assert(!loader::adoptPreviousNativeCrash(""));
    assert(loader::adoptPreviousNativeCrash(*stack));
    assert(loader::previousNativeCrash() == *stack);
    assert(!loader::adoptPreviousNativeCrash("later"));
    return 0;
}
