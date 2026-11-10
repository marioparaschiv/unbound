#pragma once

#include <nlohmann/json.hpp>
#include <optional>
#include <string>

namespace loader {
// Size, times and inode of a file: equal identities mean the file was not rewritten in between.
std::optional<nlohmann::json> fileIdentity(const std::string &path);
std::string                   cachedSha512(const std::string &directory, const std::string &path,
                                           const std::string &contents);
std::string                   cachedSha256(const std::string &directory, const std::string &path,
                                           const std::string &contents);
}
