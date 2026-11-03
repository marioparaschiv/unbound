#include <cassert>
#include <limits>

#include "NativeConversionBudget.h"

static void exhaustsProfile(const NativeConversionProfile &profile)
{
    NativeConversionBudget budget(profile);
    assert(budget.profile().maximumDepth == profile.maximumDepth);
    assert(!budget.reserveEntries(profile.maximumEntries + 1));
    assert(!budget.reserveEntries(std::numeric_limits<size_t>::max()));
    assert(budget.reserveEntries(profile.maximumEntries - 1));
    assert(!budget.reserveEntries(2));
    assert(budget.reserveEntries(1));
    assert(!budget.reserveEntries(1));
    assert(budget.reserveEntries(0));

    for (size_t index = 0; index < profile.maximumDepth; index++)
    {
        assert(budget.enter());
    }
    assert(!budget.enter());
    for (size_t index = 0; index < profile.maximumDepth; index++)
    {
        budget.leave();
    }
    assert(budget.enter());
    budget.leave();
}

static void reservesRegardlessOfOrder(const NativeConversionProfile &profile)
{
    NativeConversionBudget wideFirst(profile);
    NativeConversionBudget wideLast(profile);
    size_t                 wide   = profile.maximumEntries / 2;
    size_t                 narrow = profile.maximumEntries - wide;
    assert(wideFirst.reserveEntries(wide) && wideFirst.reserveEntries(narrow));
    assert(wideLast.reserveEntries(narrow) && wideLast.reserveEntries(wide));
    assert(!wideFirst.reserveEntries(1) && !wideLast.reserveEntries(1));
}

int main()
{
    NativeConversionBudget defaults;
    assert(defaults.profile().maximumDepth == kNativeValueConversion.maximumDepth);
    assert(kNativeValueConversion.maximumDepth == 32);
    assert(kNativeValueConversion.maximumEntries == 10000);
    assert(kNativeValueConversion.maximumBytes == 64 * 1024 * 1024);
    assert(defaults.addBytes(kNativeValueConversion.maximumBytes));
    assert(!defaults.addBytes(1));
    assert(!defaults.addBytes(std::numeric_limits<size_t>::max()));

    exhaustsProfile(kNativeValueConversion);
    exhaustsProfile(kNativePropertiesConversion);
    exhaustsProfile(kNativeArgumentsConversion);
    exhaustsProfile(kNativeBatchConversion);
    reservesRegardlessOfOrder(kNativeValueConversion);
    reservesRegardlessOfOrder(kNativeBatchConversion);

    assert(kNativePropertiesConversion.maximumDepth == 8);
    assert(kNativePropertiesConversion.maximumEntries == 512);
    assert(kNativePropertiesConversion.maximumBytes == 16384);
    assert(kNativeArgumentsConversion.maximumBytes == 16384);
    assert(kMaximumNativeArguments == 16);

    NativeConversionBudget properties(kNativePropertiesConversion);
    assert(properties.addString(4096));
    assert(!properties.addString(4097));
    assert(properties.addName(64));
    assert(!properties.addName(65));
    assert(!properties.addName(0));
    assert(properties.addBytes(16384 - 4096 - 64));
    assert(!properties.addString(1));

    NativeConversionBudget values;
    assert(values.addName(1));
    assert(values.addString(1024 * 1024));
}
