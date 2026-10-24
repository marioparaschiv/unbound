#include "NativeConversionBudget.h"

bool NativeConversionBudget::enter()
{
    if (depth >= maximumDepth || entries >= maximumEntries)
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
    return count <= maximumEntries - entries;
}

bool NativeConversionBudget::addBytes(size_t count)
{
    if (count > maximumBytes - bytes)
    {
        return false;
    }
    bytes += count;
    return true;
}
