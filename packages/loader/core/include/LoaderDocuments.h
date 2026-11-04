#pragma once

#include <string>

namespace loader {
/** Returns the loader's documents folder inside `parent`. */
std::string documentsDirectory(const std::string &parent);
}
