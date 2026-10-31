#pragma once

#include <string>

namespace loader {
std::string cachedSha512(const std::string &directory, const std::string &path,
                         const std::string &contents);
}
