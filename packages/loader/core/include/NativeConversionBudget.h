#pragma once

#include <cstddef>

class NativeConversionBudget
{
public:
    static constexpr size_t maximumDepth = 32;
    static constexpr size_t maximumEntries = 10000;
    static constexpr size_t maximumBytes = 64 * 1024 * 1024;

    bool enter();
    void leave();
    bool reserveEntries(size_t count) const;
    bool addBytes(size_t count);

private:
    size_t depth = 0;
    size_t entries = 0;
    size_t bytes = 0;
};
