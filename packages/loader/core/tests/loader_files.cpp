#include <cassert>
#include <filesystem>
#include <string>
#include <unistd.h>

#include "LoaderFiles.h"

static std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-files-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

static void touch(const std::filesystem::path &path)
{
    std::filesystem::create_directories(path.parent_path());
    assert(loader::writeTextFileAtomically(path.string(), "x"));
}

int main()
{
    const auto parent = makeTemporaryDirectory();
    const auto root   = parent / "Unbound";

    touch(root / "Themes" / "a" / "manifest.json");
    touch(root / "Themes" / "a" / "nested" / "bundle.json");
    touch(root / "Themes" / "b" / "manifest.json");
    touch(parent / "outside.txt");

    assert(loader::removeTree(root.string(), "Themes/a"));
    assert(!std::filesystem::exists(root / "Themes" / "a"));
    assert(std::filesystem::exists(root / "Themes" / "b" / "manifest.json"));

    assert(loader::removeTree(root.string(), "Themes/b/manifest.json"));
    assert(!std::filesystem::exists(root / "Themes" / "b" / "manifest.json"));

    assert(!loader::removeTree(root.string(), "Themes/missing"));
    assert(!loader::removeTree(root.string(), ""));
    assert(!loader::removeTree(root.string(), "."));
    assert(!loader::removeTree(root.string(), "../outside.txt"));
    assert(!loader::removeTree(root.string(), "Themes/../../outside.txt"));
    assert(!loader::removeTree(root.string(), (parent / "outside.txt").string()));
    assert(std::filesystem::exists(parent / "outside.txt"));
    assert(std::filesystem::exists(root / "Themes"));

    std::filesystem::remove_all(parent);
    return 0;
}
