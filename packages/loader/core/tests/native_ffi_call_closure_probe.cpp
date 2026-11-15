#include <cassert>

#include "NativeFFIClosureProbe.h"

int main()
{
    const bool first = loader::ffi::closuresExecutable();
    assert(first);
    assert(loader::ffi::closuresExecutable() == first);
    return 0;
}
