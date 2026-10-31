#include <cassert>
#include <filesystem>
#include <nlohmann/json.hpp>
#include <string>
#include <unistd.h>

#include "LoaderDocuments.h"
#include "LoaderFiles.h"

namespace fs = std::filesystem;

static fs::path makeTemporaryDirectory()
{
    std::string templatePath = (fs::temp_directory_path() / "loader-documents-XXXXXX").string();
    char       *directory    = mkdtemp(templatePath.data());
    assert(directory);
    return fs::path(directory);
}

static void write(const fs::path &path, const std::string &contents)
{
    assert(loader::writeTextFileAtomically(path.string(), contents));
}

static std::string read(const fs::path &path)
{
    return loader::readTextFile(path.string()).value_or("");
}

static void leavesAFolderWithNoLegacyCopyAlone()
{
    const auto parent = makeTemporaryDirectory();
    write(parent / "Unbound" / "settings.json", R"({"unbound":{"recovery":true}})");

    assert(loader::documentsDirectory(parent.string()) == (parent / "Unbound").string());
    assert(read(parent / "Unbound" / "settings.json") == R"({"unbound":{"recovery":true}})");
    fs::remove_all(parent);
}

static void movesTheLegacyFolderWhenThereIsNoCurrentOne()
{
    const auto parent = makeTemporaryDirectory();
    write(parent / "astral" / "settings.json", R"({"astral":{"developer-mode":true}})");
    write(parent / "astral" / "astral.bundle", "bundle");
    write(parent / "astral" / "astral.bundle.trust", "trust");
    write(parent / "astral" / "Plugins" / "astral.moyai" / "manifest.json", "{}");

    const std::string documents = loader::documentsDirectory(parent.string());

    assert(documents == (parent / "Unbound").string());
    assert(!fs::exists(parent / "astral"));
    assert(read(parent / "Unbound" / "settings.json") == R"({"astral":{"developer-mode":true}})");
    assert(read(parent / "Unbound" / "unbound.bundle") == "bundle");
    assert(read(parent / "Unbound" / "unbound.bundle.trust") == "trust");
    assert(fs::exists(parent / "Unbound" / "Plugins" / "astral.moyai" / "manifest.json"));
    fs::remove_all(parent);
}

static void keepsWhatTheCurrentFolderHasAndMovesTheRest()
{
    const auto parent = makeTemporaryDirectory();
    write(parent / "Unbound" / "settings.json",
          R"({"unbound":{"recovery":true},"plugins":{"states":{"unbound.moyai":false}}})");
    write(parent / "Unbound" / "unbound.bundle", "current");
    write(parent / "Unbound" / "Plugins" / "mp.clean-embeds" / "manifest.json", "current");
    write(
        parent / "astral" / "settings.json",
        R"({"astral":{"developer-mode":true},"plugins":{"states":{"unbound.moyai":true,"astral.translate":true}}})");
    write(parent / "astral" / "astral.bundle", "legacy");
    write(parent / "astral" / "Plugins" / "mp.clean-embeds" / "manifest.json", "legacy");
    write(parent / "astral" / "Plugins" / "astral.translate" / "manifest.json", "legacy");

    loader::documentsDirectory(parent.string());

    const auto settings = nlohmann::json::parse(read(parent / "Unbound" / "settings.json"));
    assert(settings == nlohmann::json::parse(R"({
        "unbound": {"recovery": true},
        "astral": {"developer-mode": true},
        "plugins": {"states": {"unbound.moyai": false, "astral.translate": true}}
    })"));
    assert(read(parent / "Unbound" / "unbound.bundle") == "current");
    assert(read(parent / "Unbound" / "Plugins" / "mp.clean-embeds" / "manifest.json") == "current");
    assert(read(parent / "Unbound" / "Plugins" / "astral.translate" / "manifest.json") == "legacy");
    assert(!fs::exists(parent / "astral"));
    fs::remove_all(parent);
}

int main()
{
    leavesAFolderWithNoLegacyCopyAlone();
    movesTheLegacyFolderWhenThereIsNoCurrentOne();
    keepsWhatTheCurrentFolderHasAndMovesTheRest();
    return 0;
}
