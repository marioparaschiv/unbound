#include <cassert>
#include <chrono>
#include <filesystem>
#include <string>
#include <unistd.h>

#include "LoaderFiles.h"
#include "LoaderSettings.h"
#include "LoaderSettingsCache.h"

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
        path,
        R"({"unbound":{"loader":{"enabled":false,"update":{"url":"http://host/unbound.js"}}}})"));
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

    // A corrupt file restores the last copy that loaded.
    const std::string lastLoaded = loader::readTextFile(path).value();
    assert(loader::readTextFile(path + ".good") == lastLoaded);
    assert(loader::writeTextFileAtomically(path, "{not json"));
    loader::SettingsStore restored(path);
    restored.load();
    assert(loader::readTextFile(path).value() == lastLoaded);
    assert(restored.getString("unbound", "loader.update.etag", "") == "\"abc\"");

    // Without a last good copy, it resets.
    assert(loader::removeFile(path + ".good"));
    assert(loader::writeTextFileAtomically(path, "{not json"));
    loader::SettingsStore corrupt(path);
    corrupt.load();
    assert(loader::readTextFile(path).value() == "{}");

    // Only the newest corrupt backups are kept.
    for (int index = 0; index < 5; index++)
    {
        assert(loader::writeTextFileAtomically(path + ".corrupt-" + std::to_string(index), "x"));
    }
    assert(loader::writeTextFileAtomically(path, "{not json"));
    loader::SettingsStore pruned(path);
    pruned.load();
    int backups = 0;
    for (const auto &entry : std::filesystem::directory_iterator(root))
    {
        backups += entry.path().filename().string().rfind("settings.json.corrupt-", 0) == 0;
    }
    assert(backups == 3);
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
        loader::SettingsStore native(fresh, std::chrono::milliseconds(0));
        native.load();
        assert(!native.getBoolean("unbound", "recovery", true));

        assert(loader::writeTextFileAtomically(
            fresh,
            R"({"unbound":{"recovery":false,"toasts":{"enabled":false}},"plugins":{"a":1}})"));
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
    {
        const auto applied = std::filesystem::temp_directory_path() / "loader-settings-apply.json";
        std::filesystem::remove(applied);
        loader::SettingsStore owner(applied.string());
        owner.set("unbound", "loader.update.etag", std::string("native"));
        owner.set("obsolete", "key", true);
        owner.save();

        loader::SettingsStore client(applied.string());
        client.load();
        assert(client.apply(nlohmann::json::array({
            {{"store", "plugins"}, {"key", "states"}, {"value", {{"unbound.test", true}}}},
            {{"store", "unbound"}, {"key", "recovery"}, {"value", false}},
            {{"store", "unbound"}, {"key", "missing"}, {"remove", true}},
            {{"store", "obsolete"}, {"clear", true}},
        })));

        loader::SettingsStore reader(applied.string());
        reader.load();
        assert(reader.getString("unbound", "loader.update.etag", "") == "native");
        assert(reader.get("plugins", "states") == nlohmann::json({{"unbound.test", true}}));
        assert(!reader.getBoolean("unbound", "recovery", true));
        assert(!reader.get("obsolete", "key"));

        owner.set("unbound", "loader.update.etag", std::string("newer"));
        owner.save();
        assert(client.apply(nlohmann::json::array(
            {{{"store", "unbound"}, {"key", "recovery"}, {"remove", true}}})));
        reader.load();
        assert(!reader.get("unbound", "recovery"));
        assert(reader.getString("unbound", "loader.update.etag", "") == "newer");
        assert(!client.apply(nlohmann::json::object()));
        std::filesystem::remove(applied);
    }

    {
        // A store nobody reads is written back byte for byte, and a malformed one reads as empty.
        const auto lazy = std::filesystem::temp_directory_path() / "loader-settings-lazy.json";
        const std::string cache = R"({ "assets" : {"a.png": 1, "b\u0041": [1, {"c": "}"}]} })";
        assert(loader::writeTextFileAtomically(
            lazy, std::string(R"({"unbound":{"recovery":true},"cache":)") + cache +
                      R"(,"bad":{"x":tru},"esc\"aped":{"k":1}})"));
        loader::SettingsStore store(lazy.string());
        store.load();
        assert(store.getBoolean("unbound", "recovery", false));
        assert(store.getString("esc\"aped", "k", "x") == "x");
        assert(store.get("esc\"aped", "k") == nlohmann::json(1));
        store.set("unbound", "recovery", false);
        assert(store.save());
        const std::string written = loader::readTextFile(lazy).value();
        assert(written.find(std::string("\"cache\":") + cache) != std::string::npos);

        bool found = store.read("cache", "assets.a\\.png", [](const nlohmann::json &) {});
        assert(!found);
        nlohmann::json seen;
        assert(store.read("cache", "assets", [&](const nlohmann::json &value) {
            seen = value;
        }));
        assert(seen["bA"][1]["c"] == "}");
        assert(!store.get("bad", "x"));

        loader::SettingsStore reread(lazy.string());
        reread.load();
        assert(!reread.getBoolean("unbound", "recovery", true));
        assert(reread.snapshot()["cache"]["assets"]["a.png"] == 1);

        // Unsaved changes still make a reload read the file; saved ones survive it.
        reread.set("unbound", "recovery", true);
        reread.reload();
        assert(!reread.getBoolean("unbound", "recovery", true));
        reread.set("unbound", "recovery", true);
        assert(reread.save());
        reread.reload();
        assert(reread.getBoolean("unbound", "recovery", false));

        loader::removeFile(lazy.string() + ".good");
        for (const char *corrupt : {"{\"a\":{}", "{\"a\" 1}", "{\"a\":1,}", "{\"a\":[}]}", "{} x"})
        {
            assert(loader::writeTextFileAtomically(lazy, corrupt));
            loader::SettingsStore broken(lazy.string());
            broken.load();
            assert(loader::readTextFile(lazy).value() == "{}");
        }
        for (const auto &entry : std::filesystem::directory_iterator(lazy.parent_path()))
        {
            if (entry.path().filename().string().rfind("loader-settings-lazy.json", 0) == 0)
            {
                std::filesystem::remove(entry.path());
            }
        }
    }

    {
        // The binary cache: written on save, used while settings.json is unchanged, ignored once
        // it is edited, and rebuilt by refreshCache().
        const auto cached = std::filesystem::temp_directory_path() / "loader-settings-cache.json";
        const auto bin    = cached.string() + ".bin";
        std::filesystem::remove(bin);
        assert(loader::writeTextFileAtomically(
            cached, R"({"unbound":{"n":1.5,"s":"x","list":[1,-2,null]},"big":{"k":true}})"));
        loader::SettingsStore first(cached.string());
        first.load();
        assert(!std::filesystem::exists(bin));
        first.refreshCache();
        assert(std::filesystem::exists(bin));
        const std::string packed = loader::readTextFile(bin).value();

        // A hit decodes from the cache, not the JSON: a cache naming the right hash wins.
        {
            const std::string json = loader::readTextFile(cached).value();
            auto              stores =
                loader::decodeSettingsCache(packed, loader::settingsHash(json), json.size());
            assert(stores);
            for (loader::CachedStore &store : *stores)
            {
                store.packed.clear();
                nlohmann::json::to_msgpack(nlohmann::json({{"from", "cache"}}), store.packed);
            }
            assert(loader::writeTextFileAtomically(
                bin,
                loader::encodeSettingsCache(loader::settingsHash(json), json.size(), *stores)));
            loader::SettingsStore forged(cached.string());
            forged.load();
            assert(forged.getString("big", "from", "") == "cache");
            assert(loader::writeTextFileAtomically(bin, packed));
        }
        loader::SettingsStore hit(cached.string());
        hit.load();
        assert(hit.get("unbound", "n") == nlohmann::json(1.5));
        assert(hit.get("unbound", "list") == nlohmann::json({1, -2, nullptr}));
        assert(hit.getString("unbound", "s", "") == "x");
        hit.set("unbound", "s", "y");
        assert(hit.save());
        assert(loader::readTextFile(cached).value().find(R"("big":{"k":true})") !=
               std::string::npos);
        assert(loader::readTextFile(bin).value() != packed);

        const std::string json = loader::readTextFile(cached).value();
        auto stores = loader::decodeSettingsCache(loader::readTextFile(bin).value(),
                                                  loader::settingsHash(json), json.size());
        assert(stores && stores->size() == 2);
        for (const loader::CachedStore &store : *stores)
        {
            assert(nlohmann::json::from_msgpack(store.packed) ==
                   nlohmann::json::parse(json.substr(store.jsonOffset, store.jsonLength)));
        }

        // The cache only answers for the exact bytes it was built from.
        const std::string current = loader::readTextFile(bin).value();
        assert(!loader::decodeSettingsCache(current, loader::settingsHash(json) + 1, json.size()));
        assert(!loader::decodeSettingsCache(current, loader::settingsHash(json), json.size() + 1));
        for (size_t length = 0; length < current.size(); length++)
        {
            assert(!loader::decodeSettingsCache(current.substr(0, length),
                                                loader::settingsHash(json), json.size()));
        }
        assert(
            !loader::decodeSettingsCache(current + "x", loader::settingsHash(json), json.size()));

        // An edit outside the store leaves the cache behind; the JSON wins.
        assert(loader::writeTextFileAtomically(cached,
                                               R"({"unbound":{"s":"edited"},"big":{"k":false}})"));
        loader::SettingsStore edited(cached.string());
        edited.load();
        assert(edited.getString("unbound", "s", "") == "edited");
        assert(!edited.getBoolean("big", "k", true));
        edited.refreshCache();
        loader::SettingsStore rebuilt(cached.string());
        rebuilt.load();
        assert(!rebuilt.getBoolean("big", "k", true));

        // A save into a store loaded without the cache still leaves a usable pair once refreshed.
        assert(loader::writeTextFileAtomically(cached, R"({"a":{"x":1},"b":{"y":2}})"));
        loader::SettingsStore partial(cached.string());
        partial.load();
        partial.set("a", "x", 3);
        assert(partial.save());
        partial.refreshCache();
        loader::SettingsStore after(cached.string());
        after.load();
        assert(after.get("a", "x") == nlohmann::json(3));
        assert(after.get("b", "y") == nlohmann::json(2));

        // A garbage or stale cache is ignored, and a corrupt settings.json takes its cache with it.
        assert(loader::writeTextFileAtomically(bin, "UBSC garbage"));
        loader::SettingsStore garbage(cached.string());
        garbage.load();
        assert(garbage.get("b", "y") == nlohmann::json(2));
        assert(loader::writeTextFileAtomically(cached, "{broken"));
        loader::SettingsStore broken(cached.string());
        broken.load();
        assert(!std::filesystem::exists(bin));
        for (const auto &entry : std::filesystem::directory_iterator(cached.parent_path()))
        {
            if (entry.path().filename().string().rfind("loader-settings-cache.json", 0) == 0)
            {
                std::filesystem::remove(entry.path());
            }
        }
    }

    return 0;
}
