#pragma once

#include <cstddef>
#include <cstdint>
#include <functional>
#include <jsi/jsi.h>
#include <optional>
#include <string>
#include <vector>

namespace loader::ffi {
struct CallbackRegisters {
    std::uint64_t x[8];
    double        d[8];
};

struct CallbackResult {
    std::uint64_t x[2];
    double        d[4];
};

using CallbackHandler = std::function<CallbackResult(const CallbackRegisters &)>;

constexpr std::size_t kCallbackSlots = 32;

std::optional<void *> acquireCallbackSlot(CallbackHandler handler, bool floatReturn);
bool                  releaseCallbackSlot(void *code);
std::size_t           liveCallbackSlots();

void *allocateMemory(std::size_t size);
bool  freeMemory(void *pointer);
bool  isAllocatedRange(const void *pointer, std::size_t size);

struct Rebinding {
    void *slot;
    void *original;
};

std::vector<Rebinding> rebindImportedSymbol(const std::string &name, void *replacement,
                                            const void *skipImageContaining);
bool                   restoreRebindings(const std::vector<Rebinding> &rebindings);

facebook::jsi::Value allocate(facebook::jsi::Runtime &runtime, const facebook::jsi::Value *args,
                              std::size_t count);
facebook::jsi::Value release(facebook::jsi::Runtime &runtime, const facebook::jsi::Value *args,
                             std::size_t count);
facebook::jsi::Value read(facebook::jsi::Runtime &runtime, const facebook::jsi::Value *args,
                          std::size_t count);
facebook::jsi::Value write(facebook::jsi::Runtime &runtime, const facebook::jsi::Value *args,
                           std::size_t count);
facebook::jsi::Value callback(facebook::jsi::Runtime &runtime, const facebook::jsi::Value *args,
                              std::size_t count);
facebook::jsi::Value releaseCallback(facebook::jsi::Runtime     &runtime,
                                     const facebook::jsi::Value *args, std::size_t count);
facebook::jsi::Value rebind(facebook::jsi::Runtime &runtime, const facebook::jsi::Value *args,
                            std::size_t count);
facebook::jsi::Value restore(facebook::jsi::Runtime &runtime, const facebook::jsi::Value *args,
                             std::size_t count);
}
