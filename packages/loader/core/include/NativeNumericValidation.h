#pragma once

#include <string_view>

bool validNativeNumericValue(double value, std::string_view type);
bool isNativeScalarType(std::string_view type);
