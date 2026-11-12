#pragma once

// Real fonts from tests/vectors/fonts, made by make-vector-sans.py: Vector Sans, a variable font
// with `wght` 100-900 and `wdth` 75-100 and the instances Regular, Bold and Condensed, as TTF, WOFF
// and WOFF2.

#include <cassert>
#include <fstream>
#include <sstream>
#include <string>

namespace font_vectors {
inline std::string read(const std::string &name)
{
    std::ifstream file(std::string(UNBOUND_CORE_TEST_VECTORS_DIR) + "/fonts/" + name,
                       std::ios::binary);
    assert(file);
    std::stringstream contents;
    contents << file.rdbuf();
    return contents.str();
}

inline std::string variable()
{
    return read("vector-sans-variable.ttf");
}

inline std::string woff()
{
    return read("vector-sans-variable.woff");
}

inline std::string woff2()
{
    return read("vector-sans-variable.woff2");
}
}
