#include <cstdio>
#include <cstdlib>
#include <exception>
#include <filesystem>
#include <fstream>
#include <nlohmann/json.hpp>
#include <random>
#include <sstream>
#include <string>
#include <vector>

#include "LoaderAddons.h"
#include "LoaderDevOverlay.h"
#include "LoaderPreferences.h"
#include "LoaderPreload.h"
#include "LoaderSettings.h"
#include "LoaderToolbox.h"

namespace fs = std::filesystem;

static void require(bool condition, const char *invariant, const std::string &detail)
{
    if (!condition)
    {
        std::fprintf(stderr, "settings fuzz invariant broken: %s (%s)\n", invariant,
                     detail.substr(0, 200).c_str());
        std::exit(1);
    }
}

static const char *const kKeyPaths[] = {"loader.enabled",
                                        "loader.update.url",
                                        "loader.update.etag",
                                        "loader.update.force",
                                        "loader.update.hmr",
                                        "loader.update.unsigned",
                                        "loader.update.baseline",
                                        "toolbox.shake",
                                        "toolbox.threeFinger",
                                        "recovery",
                                        "developer",
                                        "dev-overlay.position",
                                        "fonts.overrides",
                                        "applied",
                                        "active",
                                        "states"};

static const char *const kStores[] = {"unbound", "themes", "plugins", "fonts", "icons", "settings"};

class Generator
{
public:
    explicit Generator(uint32_t seed) : random_(seed) {}

    uint32_t next(uint32_t bound)
    {
        return bound == 0 ? 0 : random_() % bound;
    }

    nlohmann::json value(int depth)
    {
        switch (next(depth > 3 ? 8 : 11))
        {
            case 0:
                return nullptr;
            case 1:
                return next(2) == 0;
            case 2:
                return static_cast<int>(next(2000)) - 1000;
            case 3:
                return next(2) ? 1e308 : -0.0;
            case 4:
                return std::string(next(3) ? next(40) : 70000, 'x');
            case 5:
                return "true";
            case 6:
                return "#ff00ff";
            case 7:
                return "https://example.invalid/bundle";
            case 8: {
                nlohmann::json array = nlohmann::json::array();
                for (uint32_t index = next(4); index > 0; index--)
                {
                    array.push_back(value(depth + 1));
                }
                return array;
            }
            default: {
                nlohmann::json object = nlohmann::json::object();
                for (uint32_t index = next(4); index > 0; index--)
                {
                    object[kKeyPaths[next(sizeof(kKeyPaths) / sizeof(kKeyPaths[0]))]] =
                        value(depth + 1);
                }
                return object;
            }
        }
    }

    nlohmann::json settings()
    {
        nlohmann::json root = nlohmann::json::object();
        for (uint32_t index = 1 + next(5); index > 0; index--)
        {
            const char *store = kStores[next(sizeof(kStores) / sizeof(kStores[0]))];
            if (next(5) == 0)
            {
                root[store] = value(2);
                continue;
            }
            nlohmann::json &entries = root[store];
            if (!entries.is_object())
            {
                entries = nlohmann::json::object();
            }
            for (uint32_t key = 1 + next(6); key > 0; key--)
            {
                std::string       path = kKeyPaths[next(sizeof(kKeyPaths) / sizeof(kKeyPaths[0]))];
                nlohmann::json   *cursor = &entries;
                std::stringstream parts(path);
                std::string       part;
                std::vector<std::string> segments;
                while (std::getline(parts, part, '.'))
                {
                    segments.push_back(part);
                }
                for (size_t segment = 0; segment + 1 < segments.size(); segment++)
                {
                    nlohmann::json &child = (*cursor)[segments[segment]];
                    if (!child.is_object())
                    {
                        child = next(4) == 0 ? value(3) : nlohmann::json::object();
                    }
                    if (!child.is_object())
                    {
                        break;
                    }
                    cursor = &child;
                }
                if (cursor->is_object())
                {
                    (*cursor)[segments.back()] = value(2);
                }
            }
        }
        return root;
    }

    std::string fileContents()
    {
        switch (next(10))
        {
            case 0: {
                std::string data(next(300), '\0');
                for (char &byte : data)
                {
                    byte = static_cast<char>(random_());
                }
                return data;
            }
            case 1: {
                size_t depth = next(2) ? 5000 + next(20000) : 200000;
                return std::string(depth, next(2) ? '[' : '{').substr(0) +
                       (next(2) ? "" : std::string(depth, ']'));
            }
            case 2: {
                size_t      depth = 1000 + next(100000);
                std::string text  = "{\"unbound\":{\"loader\":";
                for (size_t level = 0; level < depth; level++)
                {
                    text += "{\"a\":";
                }
                text += "1";
                text += std::string(depth, '}');
                return text + "}}";
            }
            case 3:
                return next(2) ? "[1,2,3]" : "\"just a string\"";
            case 4: {
                std::string text = settings().dump();
                text.resize(text.size() / 2);
                return text;
            }
            default:
                return settings().dump();
        }
    }

private:
    std::mt19937 random_;
};

static void exercise(loader::SettingsStore &store)
{
    loader::preferences::loaderEnabled(store);
    loader::preferences::recoveryEnabled(store);
    loader::preferences::developerMode(store);
    loader::preferences::devOverlayVisible(store, true, true);
    loader::preferences::hotReloadEnabled(store);
    loader::preferences::appliedThemeId(store);
    loader::preferences::activeThemeId(store);
    loader::preferences::fontOverrides(store);
    loader::preferences::gestureEnabled(store, loader::preferences::ToolboxGesture::Shake);
    loader::preferences::gestureEnabled(store, loader::preferences::ToolboxGesture::ThreeFinger);
    loader::toolbox::menuJSON(store, loader::toolbox::MenuOptions{});
    loader::devoverlay::menuJSON(store);
    loader::AddonState addons;
    loader::makePreloadPayload(store, addons, nlohmann::json::array(), "https://example.invalid",
                               98);
    store.serialize();
    store.snapshot();
    store.getString("unbound", "loader.update.url", "");
    store.getBoolean("unbound", "loader.update.force", false);
    store.apply(nlohmann::json::array(
        {{{"store", "unbound"}, {"key", "loader.enabled"}, {"value", true}}}));
}

static std::string readFile(const fs::path &path)
{
    std::ifstream     file(path, std::ios::binary);
    std::stringstream buffer;
    buffer << file.rdbuf();
    return buffer.str();
}

int main()
{
    const char *roundsVariable = std::getenv("UNBOUND_FUZZ_ITERATIONS");
    const long  rounds         = roundsVariable ? std::strtol(roundsVariable, nullptr, 10) : 150;
    Generator   generator(0x5e771);
    fs::path    directory = fs::temp_directory_path() / "unbound-settings-fuzz";

    for (long round = 0; round < rounds; round++)
    {
        fs::remove_all(directory);
        fs::create_directories(directory);
        fs::path    path     = directory / "settings.json";
        std::string contents = generator.fileContents();
        std::ofstream(path, std::ios::binary) << contents;

        nlohmann::json parsed  = nlohmann::json::parse(contents, nullptr, false);
        bool           corrupt = parsed.is_discarded() || !parsed.is_object();

        try
        {
            loader::SettingsStore store(path.string());
            store.load();
            require(store.snapshot().is_object(), "loaded settings are an object", contents);
            if (corrupt)
            {
                require(readFile(path) == "{}" || readFile(path).find('{') == 0,
                        "a corrupt file is reset", contents);
                bool backedUp = false;
                for (const auto &entry : fs::directory_iterator(directory))
                {
                    backedUp =
                        backedUp || entry.path().filename().string().find("settings.json.") == 0;
                }
                require(backedUp || contents.empty(), "a corrupt file is kept aside", contents);
            }
            exercise(store);
            std::ofstream(path, std::ios::binary) << generator.fileContents();
            exercise(store);
        }
        catch (const std::exception &error)
        {
            require(false, "reading settings never throws",
                    std::string(error.what()) + " for " + contents);
        }
    }
    fs::remove_all(directory);
    std::printf("settings fuzz: %ld settings files\n", rounds);
    return 0;
}
