#include "NativeNumericValidation.h"

#include <cmath>
#include <limits>

bool validNativeNumericValue(double value, std::string_view type)
{
    if (!std::isfinite(value))
    {
        return false;
    }
    if (type == "double")
    {
        return true;
    }
    if (type == "float")
    {
        return std::abs(value) <= std::numeric_limits<float>::max();
    }
    if (std::trunc(value) != value)
    {
        return false;
    }
    if (type == "i8") return value >= -128 && value <= 127;
    if (type == "u8") return value >= 0 && value <= 255;
    if (type == "i16") return value >= -32768 && value <= 32767;
    if (type == "u16") return value >= 0 && value <= 65535;
    if (type == "i32") return value >= -2147483648.0 && value <= 2147483647.0;
    if (type == "u32") return value >= 0 && value <= 4294967295.0;
    if (type == "i64") return value >= -9007199254740991.0 && value <= 9007199254740991.0;
    if (type == "u64") return value >= 0 && value <= 9007199254740991.0;
    return false;
}
