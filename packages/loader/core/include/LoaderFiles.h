#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace loader {
std::optional<std::string> readTextFile(const std::string &path);
bool     writeTextFileAtomically(const std::string &path, const std::string &contents);
bool     copyFile(const std::string &source, const std::string &destination);
bool     removeFile(const std::string &path);
bool     removeTree(const std::string &root, const std::string &relative);
uint64_t fileSize(const std::string &path);
bool     fileExists(const std::string &path);
bool     isDirectory(const std::string &path);
bool     createDirectories(const std::string &path);
std::vector<std::string> listDirectory(const std::string &path);
std::string              joinPath(const std::string &base, const std::string &component);
}
