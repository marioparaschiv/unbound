#include <cassert>
#include <limits>

#include "NativeAddressValidation.h"

int main()
{
    assert(addressWithinRegion(0x1000, 0x1000, 0x100));
    assert(addressWithinRegion(0x10ff, 0x1000, 0x100));
    assert(!addressWithinRegion(0x1100, 0x1000, 0x100));
    assert(!addressWithinRegion(0x0fff, 0x1000, 0x100));
    assert(!addressWithinRegion(0x1000, 0x1000, 0));
    assert(!addressWithinRegion(0, std::numeric_limits<std::uintptr_t>::max() - 2, 4));
}
