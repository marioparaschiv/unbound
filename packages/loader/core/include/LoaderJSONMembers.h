#pragma once

#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "LoaderJSON.h"

namespace loader {
// One member of a JSON object: its decoded key and the raw text of its value.
struct JSONMember {
    std::string      key;
    std::string_view value;
};

// Splits a JSON object into its members without parsing their values, so a caller can parse
// only the members it needs. Checks the structure (strings, bracket nesting up to
// `maximumDepth`, separators) but not the contents of numbers and literals; returns nothing
// when `text` is not one well-formed object.
std::optional<std::vector<JSONMember>> splitJSONObject(std::string_view text,
                                                       size_t maximumDepth = kMaximumJSONDepth);
}
