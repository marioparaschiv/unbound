#include <cassert>
#include <cmath>
#include <limits>

#include "NativeNumericValidation.h"

int main()
{
    assert(validNativeNumericValue(0, "i8"));
    assert(validNativeNumericValue(-128, "i8"));
    assert(validNativeNumericValue(127, "i8"));
    assert(!validNativeNumericValue(-129, "i8"));
    assert(!validNativeNumericValue(128, "i8"));
    assert(validNativeNumericValue(255, "u8"));
    assert(!validNativeNumericValue(-1, "u8"));
    assert(!validNativeNumericValue(256, "u8"));
    assert(validNativeNumericValue(-32768, "i16"));
    assert(!validNativeNumericValue(32768, "i16"));
    assert(validNativeNumericValue(65535, "u16"));
    assert(!validNativeNumericValue(65536, "u16"));
    assert(validNativeNumericValue(-2147483648.0, "i32"));
    assert(!validNativeNumericValue(2147483648.0, "i32"));
    assert(validNativeNumericValue(4294967295.0, "u32"));
    assert(!validNativeNumericValue(4294967296.0, "u32"));
    assert(validNativeNumericValue(9007199254740991.0, "i64"));
    assert(!validNativeNumericValue(9007199254740992.0, "i64"));
    assert(!validNativeNumericValue(-1, "u64"));
    assert(!validNativeNumericValue(1.5, "i32"));
    assert(!validNativeNumericValue(std::nan(""), "double"));
    assert(!validNativeNumericValue(std::numeric_limits<double>::infinity(), "float"));
    assert(!validNativeNumericValue(std::numeric_limits<double>::max(), "float"));
    assert(validNativeNumericValue(std::numeric_limits<float>::max(), "float"));
    assert(validNativeNumericValue(std::numeric_limits<double>::max(), "double"));
    assert(!validNativeNumericValue(1, "void"));
}
