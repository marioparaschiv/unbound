#pragma once

#include <string>

namespace loader {
/**
 * Returns the loader's documents folder inside `parent`, first moving in anything the folder the
 * loader used under its legacy `astral` name holds. A file or setting the current folder already
 * has is kept; the legacy folder is removed once everything in it has moved.
 */
std::string documentsDirectory(const std::string &parent);
}
