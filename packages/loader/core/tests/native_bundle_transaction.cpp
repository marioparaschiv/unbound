#include <cassert>
#include <filesystem>
#include <fstream>
#include <string>
#include <unistd.h>

#include "NativeBundleTransaction.h"

static void writeFile(const std::filesystem::path &path, const std::string &value)
{
    std::ofstream stream(path, std::ios::binary);
    stream << value;
    assert(stream.good());
}

static std::string readFile(const std::filesystem::path &path)
{
    std::ifstream stream(path, std::ios::binary);
    return std::string(std::istreambuf_iterator<char>(stream), std::istreambuf_iterator<char>());
}

int main()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "native-bundle-transaction-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    const std::filesystem::path root(directory);
    const auto                  candidate = root / "unbound.bundle.candidate";
    const auto                  target    = root / "unbound.bundle";
    const auto                  backup    = root / "unbound.bundle.previous";

    writeFile(target, "old bundle");
    writeFile(candidate, "new bundle");
    assert(promoteNativeBundle(candidate.c_str(), target.c_str(), backup.c_str()));
    assert(readFile(target) == "new bundle");
    assert(readFile(backup) == "old bundle");
    assert(!std::filesystem::exists(candidate));

    assert(restoreNativeBundle(backup.c_str(), target.c_str()));
    assert(readFile(target) == "old bundle");
    assert(readFile(backup) == "old bundle");

    writeFile(candidate, "new bundle");
    assert(promoteNativeBundle(candidate.c_str(), target.c_str(), backup.c_str()));
    assert(readFile(target) == "new bundle");

    assert(!promoteNativeBundle(candidate.c_str(), target.c_str(), backup.c_str()));
    assert(readFile(target) == "new bundle");
    assert(readFile(backup) == "old bundle");

    writeFile(candidate, "later bundle");
    assert(promoteNativeBundle(candidate.c_str(), target.c_str(), backup.c_str()));
    assert(readFile(target) == "later bundle");
    assert(readFile(backup) == "new bundle");

    std::filesystem::remove(target);
    std::filesystem::remove(backup);
    writeFile(candidate, "first bundle");
    assert(promoteNativeBundle(candidate.c_str(), target.c_str(), backup.c_str()));
    assert(readFile(target) == "first bundle");
    assert(!std::filesystem::exists(backup));

    writeFile(candidate, "blocked bundle");
    const auto missingBackup = root / "missing" / "unbound.bundle.previous";
    assert(!promoteNativeBundle(candidate.c_str(), target.c_str(), missingBackup.c_str()));
    assert(readFile(target) == "first bundle");
    assert(readFile(candidate) == "blocked bundle");

    assert(!restoreNativeBundle(missingBackup.c_str(), target.c_str()));
    assert(readFile(target) == "first bundle");

    std::filesystem::remove_all(root);
}
