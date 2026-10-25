#include "NativeAddressValidation.h"

bool addressWithinRegion(std::uintptr_t address, std::uintptr_t base, std::size_t size)
{
    return address >= base && address - base < size;
}
