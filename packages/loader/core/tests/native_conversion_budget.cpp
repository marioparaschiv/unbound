#include "NativeConversionBudget.h"

#include <cassert>
#include <limits>

int main()
{
    NativeConversionBudget budget;
    assert(budget.enter());
    assert(budget.reserveEntries(NativeConversionBudget::maximumEntries - 1));
    assert(!budget.reserveEntries(NativeConversionBudget::maximumEntries));
    assert(!budget.reserveEntries(std::numeric_limits<size_t>::max()));
    assert(budget.addBytes(NativeConversionBudget::maximumBytes));
    assert(!budget.addBytes(1));
    assert(!budget.addBytes(std::numeric_limits<size_t>::max()));

    for (size_t index = 1; index < NativeConversionBudget::maximumDepth; index++)
    {
        assert(budget.enter());
    }
    assert(!budget.enter());
    for (size_t index = 0; index < NativeConversionBudget::maximumDepth; index++)
    {
        budget.leave();
    }

    for (size_t index = NativeConversionBudget::maximumDepth;
         index < NativeConversionBudget::maximumEntries; index++)
    {
        assert(budget.enter());
        budget.leave();
    }
    assert(!budget.enter());
    assert(!budget.reserveEntries(1));
}
