#pragma once

#include <cstdint>
#include <optional>
#include <string>

namespace loader {
struct RGBAColor {
    double red   = 0;
    double green = 0;
    double blue  = 0;
    double alpha = 1;
};

std::optional<RGBAColor> parseColor(const std::string &value);
uint32_t                 toARGB(const RGBAColor &color);
bool                     isDarkColor(const RGBAColor &color);
}
