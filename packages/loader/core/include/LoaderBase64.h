#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace loader {
std::string base64Encode(const std::uint8_t *bytes, std::size_t length);
std::optional<std::vector<std::uint8_t>> base64Decode(std::string_view text);
}
