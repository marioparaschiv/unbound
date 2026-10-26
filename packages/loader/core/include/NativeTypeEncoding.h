#pragma once

#include <string>
#include <string_view>

char        normalizedType(const char *encoding);
std::string nativeFFITypeName(const char *encoding);
const char *nativeStructEncoding(std::string_view name);
