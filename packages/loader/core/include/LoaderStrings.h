#pragma once

#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace loader {
using TextValues = std::vector<std::pair<std::string, std::string>>;

constexpr const char *kLoaderStringsFile = "i18n/loader.json";

void loadStrings(const std::string &documents);
void setStrings(const std::string &json);
std::string text(std::string_view key, std::string_view english, const TextValues &values = {});
}
