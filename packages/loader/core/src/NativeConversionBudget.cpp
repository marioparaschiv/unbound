#include "NativeConversionBudget.h"

NativeConversionBudget::NativeConversionBudget(const NativeConversionProfile &profile)
    : profile_(profile)
{
}

const NativeConversionProfile &NativeConversionBudget::profile() const
{
    return profile_;
}

bool NativeConversionBudget::enter()
{
    if (depth >= profile_.maximumDepth || entries >= profile_.maximumEntries)
    {
        return false;
    }
    depth++;
    entries++;
    return true;
}

void NativeConversionBudget::leave()
{
    if (depth > 0)
    {
        depth--;
    }
}

bool NativeConversionBudget::reserveEntries(size_t count) const
{
    return count <= profile_.maximumEntries - entries;
}

bool NativeConversionBudget::addBytes(size_t count)
{
    if (count > profile_.maximumBytes - bytes)
    {
        return false;
    }
    bytes += count;
    return true;
}

bool NativeConversionBudget::addString(size_t count)
{
    return count <= profile_.maximumStringBytes && addBytes(count);
}

bool NativeConversionBudget::addName(size_t count)
{
    return count > 0 && count <= profile_.maximumNameBytes && addBytes(count);
}
