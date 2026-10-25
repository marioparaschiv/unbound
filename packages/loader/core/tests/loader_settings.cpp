#include "LoaderFiles.h"
#include "LoaderSettings.h"

#include <cassert>
#include <chrono>
#include <filesystem>
#include <string>
#include <unistd.h>

static std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-settings-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

int main()
{
    const auto root = makeTemporaryDirectory();
    const auto path = (root / "settings.json").string();

    loader::SettingsStore missing(path);
    missing.load();
    assert(loader::readTextFile(path).value() == "{}");
    assert(missing.getBoolean("unbound", "loader.enabled", true));

    assert(loader::writeTextFileAtomically(
        path, R"({"unbound":{"loader":{"enabled":false,"update":{"url":"http://host/unbound.js"}}}})"));
    loader::SettingsStore store(path);
    store.load();
    assert(!store.getBoolean("unbound", "loader.enabled", true));
    assert(store.getString("unbound", "loader.update.url", "") == "http://host/unbound.js");
    assert(store.getString("unbound", "loader.update.etag", "fallback") == "fallback");
    assert(!store.get("other", "loader.enabled"));

    store.set("unbound", "loader.update.etag", "\"abc\"");
    store.set("unbound", "debugger.enabled", true);
    assert(store.save());

    loader::SettingsStore reloaded(path);
    reloaded.load();
    assert(reloaded.getString("unbound", "loader.update.etag", "") == "\"abc\"");
    assert(reloaded.getBoolean("unbound", "debugger.enabled", false));
    assert(reloaded.getString("unbound", "loader.update.url", "") == "http://host/unbound.js");

    assert(loader::writeTextFileAtomically(path, "{not json"));
    loader::SettingsStore corrupt(path);
    corrupt.load();
    assert(loader::readTextFile(path).value() == "{}");
    bool foundBackup = false;
    for (const auto &entry : std::filesystem::directory_iterator(root))
    {
        foundBackup |= entry.path().filename().string().rfind("settings.json.corrupt-", 0) == 0;
    }
    assert(foundBackup);

    assert(!corrupt.replace("[]"));
    assert(corrupt.replace(R"({"unbound":{"recovery":true}})"));
    assert(corrupt.getBoolean("unbound", "recovery", false));

    {
        const auto fresh = (root / "fresh.json").string();
        assert(loader::writeTextFileAtomically(fresh, R"({"unbound":{"recovery":false}})"));
        loader::SettingsStore native(fresh);
        native.load();
        assert(!native.getBoolean("unbound", "recovery", true));

        assert(loader::writeTextFileAtomically(
            fresh, R"({"unbound":{"recovery":false,"toasts":{"enabled":false}},"plugins":{"a":1}})"));
        std::filesystem::last_write_time(fresh, std::filesystem::file_time_type::clock::now() +
                                                    std::chrono::seconds(2));
        assert(!native.getBoolean("unbound", "toasts.enabled", true));

        native.set("unbound", "recovery", true);
        assert(native.save());
        const std::string written = loader::readTextFile(fresh).value();
        assert(written.find("\"plugins\"") != std::string::npos);
        assert(written.find("\"toasts\"") != std::string::npos);
        assert(native.getBoolean("unbound", "recovery", false));
    }

    std::filesystem::remove_all(root);
    return 0;
}
