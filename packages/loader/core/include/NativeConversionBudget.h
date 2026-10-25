#pragma once

#include <cstddef>

struct NativeConversionProfile
{
    size_t maximumDepth;
    size_t maximumEntries;
    size_t maximumBytes;
    size_t maximumStringBytes;
    size_t maximumNameBytes;
};

inline constexpr NativeConversionProfile kNativeValueConversion = {
    32, 10000, 64 * 1024 * 1024, 64 * 1024 * 1024, 64 * 1024 * 1024,
};

inline constexpr NativeConversionProfile kNativePropertiesConversion = {8, 512, 16384, 4096, 64};

inline constexpr NativeConversionProfile kNativeArgumentsConversion = {8, 512, 16384, 4096, 64};

inline constexpr size_t kMaximumNativeArguments = 16;

class NativeConversionBudget
{
public:
    explicit NativeConversionBudget(const NativeConversionProfile &profile = kNativeValueConversion);

    const NativeConversionProfile &profile() const;

    bool enter();
    void leave();
    bool reserveEntries(size_t count) const;
    bool addBytes(size_t count);
    bool addString(size_t count);
    bool addName(size_t count);

private:
    NativeConversionProfile profile_;
    size_t                  depth   = 0;
    size_t                  entries = 0;
    size_t                  bytes   = 0;
};
