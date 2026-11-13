#include <cassert>
#include <cstdint>
#include <unistd.h>
#include <vector>

#include "NativeFFIExtras.h"

namespace {
pid_t replacementPid()
{
    return 4242;
}

void allocationsBoundWrites()
{
    void *memory = loader::ffi::allocateMemory(16);
    assert(memory);
    assert(loader::ffi::isAllocatedRange(memory, 16));
    assert(loader::ffi::isAllocatedRange(static_cast<char *>(memory) + 8, 8));
    assert(!loader::ffi::isAllocatedRange(static_cast<char *>(memory) + 8, 9));
    assert(!loader::ffi::isAllocatedRange(&memory, 8));
    assert(loader::ffi::freeMemory(memory));
    assert(!loader::ffi::freeMemory(memory));
    assert(!loader::ffi::allocateMemory(0));
}

void callbackSlotsRunTheirHandler()
{
    auto code = loader::ffi::acquireCallbackSlot(
        [](const loader::ffi::CallbackRegisters &registers) {
            loader::ffi::CallbackResult result{};
            result.x[0] = registers.x[0] + registers.x[1];
            return result;
        },
        false);
    assert(code);
    auto add = reinterpret_cast<std::uint64_t (*)(std::uint64_t, std::uint64_t)>(*code);
    assert(add(40, 2) == 42);
    assert(loader::ffi::liveCallbackSlots() == 1);
    assert(loader::ffi::releaseCallbackSlot(*code));
    assert(add(40, 2) == 0);
    assert(!loader::ffi::releaseCallbackSlot(*code));
}

void floatCallbacksReturnInFloatRegisters()
{
    auto code = loader::ffi::acquireCallbackSlot(
        [](const loader::ffi::CallbackRegisters &registers) {
            loader::ffi::CallbackResult result{};
            result.d[0] = registers.d[0] * 2;
            return result;
        },
        true);
    assert(code);
    auto twice = reinterpret_cast<double (*)(double)>(*code);
    assert(twice(1.25) == 2.5);
    loader::ffi::releaseCallbackSlot(*code);
}

void rebindingPointsImportsAtTheReplacement()
{
    pid_t (*volatile pid)()                  = getpid;
    pid_t                               real = pid();
    std::vector<loader::ffi::Rebinding> done = loader::ffi::rebindImportedSymbol(
        "getpid", reinterpret_cast<void *>(&replacementPid), nullptr);
    if (done.empty())
    {
        return;
    }
    assert(getpid() == 4242);
    assert(loader::ffi::restoreRebindings(done));
    assert(getpid() == real);
}
}

int main()
{
    allocationsBoundWrites();
    callbackSlotsRunTheirHandler();
    floatCallbacksReturnInFloatRegisters();
    rebindingPointsImportsAtTheReplacement();
    return 0;
}
