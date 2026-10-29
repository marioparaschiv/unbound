#pragma once

#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>

namespace loader {
inline constexpr size_t kNativeCallLabelLimit = 96;

struct NativeCallSlot;

struct NativeCallSnapshot {
    std::string label;
    int64_t     startedAt = 0;
};

int64_t                           nativeCallClock();
std::optional<NativeCallSnapshot> nativeCallOnThread(uintptr_t thread);
std::string describeNativeCall(const std::optional<NativeCallSnapshot> &call, int64_t now);

class NativeCallScope
{
public:
    NativeCallScope(const std::string &name, const std::string &detail);
    ~NativeCallScope();

    NativeCallScope(const NativeCallScope &)            = delete;
    NativeCallScope &operator=(const NativeCallScope &) = delete;

private:
    NativeCallSlot *slot_                                 = nullptr;
    char            previousLabel_[kNativeCallLabelLimit] = {};
    int64_t         previousStartedAt_                    = 0;
};
}
