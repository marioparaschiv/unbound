#include "LoaderColor.h"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <sstream>
#include <vector>

namespace loader {
static std::string trim(const std::string &value)
{
    size_t start = value.find_first_not_of(" \t\n\r");
    size_t end   = value.find_last_not_of(" \t\n\r");
    return start == std::string::npos ? std::string() : value.substr(start, end - start + 1);
}

static std::optional<RGBAColor> parseHex(const std::string &value)
{
    std::string digits = value.substr(1);
    if (digits.size() == 3)
    {
        digits = {digits[0], digits[0], digits[1], digits[1], digits[2], digits[2]};
    }
    if (digits.size() == 6)
    {
        digits += "FF";
    }
    if (digits.size() != 8 || !std::all_of(digits.begin(), digits.end(), [](unsigned char c) {
            return std::isxdigit(c);
        }))
    {
        return std::nullopt;
    }

    uint32_t packed = static_cast<uint32_t>(std::stoul(digits, nullptr, 16));
    return RGBAColor{((packed >> 24) & 0xFF) / 255.0, ((packed >> 16) & 0xFF) / 255.0,
                     ((packed >> 8) & 0xFF) / 255.0, (packed & 0xFF) / 255.0};
}

static std::optional<RGBAColor> parseFunction(const std::string &value)
{
    size_t open  = value.find('(');
    size_t close = value.rfind(')');
    if (open == std::string::npos || close == std::string::npos || close <= open)
    {
        return std::nullopt;
    }

    std::vector<double> components;
    std::stringstream   stream(value.substr(open + 1, close - open - 1));
    std::string         part;
    while (std::getline(stream, part, ','))
    {
        try
        {
            double component = std::stod(trim(part));
            if (!std::isfinite(component))
            {
                return std::nullopt;
            }
            components.push_back(component);
        }
        catch (...)
        {
            return std::nullopt;
        }
    }

    if (components.size() != 3 && components.size() != 4)
    {
        return std::nullopt;
    }

    double alpha = components.size() == 4 ? components[3] : 1.0;
    return RGBAColor{components[0] / 255.0, components[1] / 255.0, components[2] / 255.0,
                     std::clamp(alpha, 0.0, 1.0)};
}

std::optional<RGBAColor> parseColor(const std::string &input)
{
    std::string value = trim(input);
    if (value.empty())
    {
        return std::nullopt;
    }
    if (value.front() == '#')
    {
        return parseHex(value);
    }
    if (value.rfind("rgb", 0) == 0)
    {
        return parseFunction(value);
    }
    return std::nullopt;
}

uint32_t toARGB(const RGBAColor &color)
{
    auto channel = [](double component) {
        return static_cast<uint32_t>(std::lround(std::clamp(component, 0.0, 1.0) * 255.0));
    };
    return (channel(color.alpha) << 24) | (channel(color.red) << 16) | (channel(color.green) << 8) |
           channel(color.blue);
}

bool isDarkColor(const RGBAColor &color)
{
    return 0.299 * color.red + 0.587 * color.green + 0.114 * color.blue < 0.5;
}
}
