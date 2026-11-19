#pragma once

#include <optional>
#include <string>

namespace loader {
bool gzipFile(const std::string &source, const std::string &destination);
std::optional<std::string> gunzipFile(const std::string &path);
}
