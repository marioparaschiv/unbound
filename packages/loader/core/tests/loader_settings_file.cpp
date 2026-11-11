#include <cassert>
#include <chrono>
#include <filesystem>
#include <string>
#include <unistd.h>

#include "LoaderFiles.h"
#include "LoaderSettings.h"
#include "LoaderSettingsCache.h"

namespace {
std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-settings-file-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

std::string settingsPath(const std::filesystem::path &root)
{
    return (root / "settings.json").string();
}

void touchLater(const std::string &path)
{
    std::filesystem::last_write_time(path, std::filesystem::file_time_type::clock::now() +
                                               std::chrono::seconds(2));
}

int countPrefixed(const std::filesystem::path &root, const std::string &prefix)
{
    int count = 0;
    for (const auto &entry : std::filesystem::directory_iterator(root))
    {
        count += entry.path().filename().string().rfind(prefix, 0) == 0;
    }
    return count;
}

void emptySettingsAreNotKeptAsTheLastGoodCopy(const std::filesystem::path &root)
{
    const std::string path = settingsPath(root);
    assert(loader::writeTextFileAtomically(path, "{}"));
    loader::SettingsStore store(path);
    store.load();
    assert(!loader::fileExists(path + ".good"));

    assert(loader::writeTextFileAtomically(path, R"({"a":{"x":1}})"));
    store.load();
    assert(loader::readTextFile(path + ".good") == R"({"a":{"x":1}})");

    assert(loader::writeTextFileAtomically(path, "{}"));
    store.load();
    assert(loader::readTextFile(path + ".good") == R"({"a":{"x":1}})");
}

void corruptLastGoodCopyResets(const std::filesystem::path &root)
{
    const std::string path = settingsPath(root);
    assert(loader::writeTextFileAtomically(path + ".good", "{also broken"));
    assert(loader::writeTextFileAtomically(path, "{broken"));

    loader::SettingsStore store(path);
    store.load();
    assert(loader::readTextFile(path) == "{}");
    assert(loader::readTextFile(path + ".good") == "{also broken");
    assert(countPrefixed(root, "settings.json.corrupt-") == 1);
}

void undecodablePackedStoreReadsFromTheJson(const std::filesystem::path &root)
{
    const std::string path = settingsPath(root);
    const std::string json = R"({"unbound":{"recovery":true}})";
    assert(loader::writeTextFileAtomically(path, json));
    const uint64_t offset = json.find("{\"recovery\"");
    assert(loader::writeTextFileAtomically(
        path + ".bin",
        loader::encodeSettingsCache(loader::settingsHash(json), json.size(),
                                    {{"unbound", offset, json.size() - offset - 1, "\xc1"}})));

    loader::SettingsStore store(path);
    store.load();
    assert(store.getBoolean("unbound", "recovery", false));
}

void refreshCacheSkipsMalformedStores(const std::filesystem::path &root)
{
    const std::string path = settingsPath(root);
    assert(loader::writeTextFileAtomically(path, R"({"a":{"x":1},"bad":{"x":tru}})"));
    loader::SettingsStore store(path);
    store.load();
    store.refreshCache();
    assert(!loader::fileExists(path + ".bin"));
    assert(store.get("a", "x") == nlohmann::json(1));
    assert(!store.get("bad", "x"));
}

void refreshCacheSkipsAFileChangedSinceLoading(const std::filesystem::path &root)
{
    const std::string path = settingsPath(root);
    assert(loader::writeTextFileAtomically(path, R"({"a":{"x":1}})"));
    loader::SettingsStore store(path);
    store.load();
    assert(loader::writeTextFileAtomically(path, R"({"a":{"x":2}})"));
    store.refreshCache();
    assert(!loader::fileExists(path + ".bin"));
}

void saveLeavesTheCacheToRefreshWhenAStoreWasNeverDecoded(const std::filesystem::path &root)
{
    const std::string path = settingsPath(root);
    assert(loader::writeTextFileAtomically(path, R"({"a":{"x":1},"b":{"y":2}})"));
    loader::SettingsStore store(path);
    store.load();
    assert(store.set("a", "x", 3));
    assert(store.save());
    assert(!loader::fileExists(path + ".bin"));

    store.refreshCache();
    const std::string json  = loader::readTextFile(path).value();
    const std::string cache = loader::readTextFile(path + ".bin").value();
    auto stores = loader::decodeSettingsCache(cache, loader::settingsHash(json), json.size());
    assert(stores && stores->size() == 2);

    store.refreshCache();
    assert(loader::readTextFile(path + ".bin") == cache);

    assert(store.get("b", "y") == nlohmann::json(2));
    assert(store.set("b", "y", 4));
    assert(store.save());
    const std::string saved = loader::readTextFile(path).value();
    assert(loader::decodeSettingsCache(loader::readTextFile(path + ".bin").value(),
                                       loader::settingsHash(saved), saved.size()));
}

void readsWaitForTheRecheckInterval(const std::filesystem::path &root)
{
    const std::string path = settingsPath(root);
    assert(loader::writeTextFileAtomically(path, R"({"a":{"x":1}})"));
    loader::SettingsStore store(path, std::chrono::hours(1));
    store.load();
    assert(store.get("a", "x") == nlohmann::json(1));

    assert(loader::writeTextFileAtomically(path, R"({"a":{"x":2}})"));
    touchLater(path);
    assert(store.get("a", "x") == nlohmann::json(1));

    store.reload();
    assert(store.get("a", "x") == nlohmann::json(2));
}

void writesPickUpExternalEditsFirst(const std::filesystem::path &root)
{
    const std::string path = settingsPath(root);
    assert(loader::writeTextFileAtomically(path, R"({"a":{"x":1}})"));
    loader::SettingsStore store(path, std::chrono::hours(1));
    store.load();

    assert(loader::writeTextFileAtomically(path, R"({"a":{"x":1},"b":{"external":true}})"));
    touchLater(path);
    assert(store.set("a", "x", 5));
    assert(store.save());

    loader::SettingsStore reader(path);
    reader.load();
    assert(reader.get("a", "x") == nlohmann::json(5));
    assert(reader.getBoolean("b", "external", false));
}

void reloadSkipsAnUnchangedFile(const std::filesystem::path &root)
{
    const std::string path = settingsPath(root);
    assert(loader::writeTextFileAtomically(path, R"({"a":{"x":1}})"));
    loader::SettingsStore store(path);
    store.load();
    assert(loader::removeFile(path + ".good"));

    store.reload();
    assert(!loader::fileExists(path + ".good"));
}

void saveFailsWhenTheDirectoryIsAFile(const std::filesystem::path &root)
{
    const auto blocker = root / "blocker";
    assert(loader::writeTextFileAtomically(blocker.string(), "file"));
    const std::string     path = settingsPath(blocker);
    loader::SettingsStore store(path);
    store.load();
    assert(store.set("a", "x", 1));

    assert(!store.save());
    assert(store.get("a", "x") == nlohmann::json(1));
    assert(loader::readTextFile(blocker.string()) == "file");
}
}

int main()
{
    const auto root = makeTemporaryDirectory();
    const auto run  = [&](const char *name, void (*test)(const std::filesystem::path &)) {
        std::filesystem::path directory = root / name;
        std::filesystem::create_directories(directory);
        test(directory);
    };

    run("empty-good", emptySettingsAreNotKeptAsTheLastGoodCopy);
    run("corrupt-good", corruptLastGoodCopyResets);
    run("packed", undecodablePackedStoreReadsFromTheJson);
    run("malformed", refreshCacheSkipsMalformedStores);
    run("changed", refreshCacheSkipsAFileChangedSinceLoading);
    run("partial", saveLeavesTheCacheToRefreshWhenAStoreWasNeverDecoded);
    run("recheck", readsWaitForTheRecheckInterval);
    run("external", writesPickUpExternalEditsFirst);
    run("reload", reloadSkipsAnUnchangedFile);
    run("blocked", saveFailsWhenTheDirectoryIsAFile);

    std::filesystem::remove_all(root);
    return 0;
}
