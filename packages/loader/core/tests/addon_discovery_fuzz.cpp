#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <nlohmann/json.hpp>
#include <random>
#include <string>
#include <system_error>
#include <vector>

#include "LoaderAddons.h"
#include "LoaderFonts.h"

namespace fs = std::filesystem;

static void require(bool condition, const char *invariant, const std::string &detail)
{
    if (!condition)
    {
        std::fprintf(stderr, "addon discovery fuzz invariant broken: %s (%s)\n", invariant,
                     detail.c_str());
        std::exit(1);
    }
}

static void appendU16(std::string &data, uint16_t value)
{
    data += static_cast<char>(value >> 8);
    data += static_cast<char>(value & 0xFF);
}

static void appendU32(std::string &data, uint32_t value)
{
    appendU16(data, static_cast<uint16_t>(value >> 16));
    appendU16(data, static_cast<uint16_t>(value & 0xFFFF));
}

static std::string syntheticFont(const std::string &fullName)
{
    std::string name;
    for (char character : fullName)
    {
        appendU16(name, static_cast<uint16_t>(static_cast<unsigned char>(character)));
    }
    std::string table;
    appendU16(table, 0);
    appendU16(table, 1);
    appendU16(table, 18);
    for (uint16_t value : {3, 1, 0x409, 4})
    {
        appendU16(table, value);
    }
    appendU16(table, static_cast<uint16_t>(name.size()));
    appendU16(table, 0);
    table += name;
    std::string font;
    appendU32(font, 0x00010000);
    for (uint16_t value : {1, 16, 0, 0})
    {
        appendU16(font, value);
    }
    appendU32(font, 0x6E616D65);
    appendU32(font, 0);
    appendU32(font, 28);
    appendU32(font, static_cast<uint32_t>(table.size()));
    return font + table;
}

class Generator
{
public:
    explicit Generator(uint32_t seed) : random_(seed) {}

    uint32_t next(uint32_t bound)
    {
        return bound == 0 ? 0 : random_() % bound;
    }

    std::string bytes(size_t count)
    {
        std::string data(count, '\0');
        for (char &byte : data)
        {
            byte = static_cast<char>(random_());
        }
        return data;
    }

    std::string folderName()
    {
        static const char *const names[] = {"plugin",       ".hidden",  "with space", "ünïcødé",
                                            "dots.in.name", "UPPER",    "-dash",      "x",
                                            "emoji-😀",     "trailing."};
        std::string              name    = names[next(sizeof(names) / sizeof(names[0]))];
        if (next(6) == 0)
        {
            name += std::string(180, 'l');
        }
        return name + "-" + std::to_string(next(100000));
    }

    std::string mutate(std::string data)
    {
        if (data.empty())
        {
            return bytes(next(64));
        }
        int edits = 1 + static_cast<int>(next(6));
        for (int edit = 0; edit < edits && !data.empty(); edit++)
        {
            size_t position = next(static_cast<uint32_t>(data.size()));
            switch (next(4))
            {
                case 0:
                    data[position] = static_cast<char>(data[position] ^ (1 << next(8)));
                    break;
                case 1:
                    data.resize(position);
                    break;
                case 2:
                    data.insert(position, bytes(1 + next(8)));
                    break;
                default:
                    data[position] = static_cast<char>(next(2) ? 0xFF : 0x00);
                    break;
            }
        }
        return data;
    }

private:
    std::mt19937 random_;
};

static void write(const fs::path &path, const std::string &data)
{
    std::ofstream(path, std::ios::binary) << data;
}

static std::string manifestFor(Generator &generator, const std::string &id)
{
    static const char *const mains[] = {
        "index.js", "index.js",   "../escape.js", "../../outside/secret.txt", "/etc/hosts", "",
        "sub",      "missing.js", "./index.js",   "sub/../index.js"};
    nlohmann::json manifest = {{"id", id}, {"name", id}, {"version", "1.0.0"}};
    switch (generator.next(8))
    {
        case 0:
            return generator.bytes(generator.next(200));
        case 1:
            return "[\"not an object\"]";
        case 2:
            return "{\"id\":";
        case 3:
            manifest["main"] = generator.next(1000);
            break;
        default:
            manifest["main"] = mains[generator.next(sizeof(mains) / sizeof(mains[0]))];
            break;
    }
    return manifest.dump();
}

static void addPlugin(Generator &generator, const fs::path &plugins, const fs::path &outside)
{
    fs::path        folder = plugins / generator.folderName();
    std::error_code error;
    switch (generator.next(10))
    {
        case 0:
            write(folder, "a plugin that is a file");
            return;
        case 1:
            fs::create_directory_symlink(outside, folder, error);
            return;
        case 2:
            fs::create_directory_symlink(plugins, folder, error);
            return;
        default:
            break;
    }
    fs::create_directories(folder / "sub", error);
    if (generator.next(5) == 0)
    {
        fs::create_directories(folder / "manifest.json", error);
    }
    else if (generator.next(8) != 0)
    {
        write(folder / "manifest.json", manifestFor(generator, folder.filename().string()));
    }
    if (generator.next(6) == 0)
    {
        fs::create_symlink(outside / "secret.txt", folder / "index.js", error);
    }
    else
    {
        write(folder / "index.js", generator.next(4) == 0 ? generator.bytes(generator.next(4096))
                                                          : "module.exports = {};");
    }
}

static void addTheme(Generator &generator, const fs::path &themes)
{
    fs::path        folder = themes / generator.folderName();
    std::error_code error;
    fs::create_directories(folder, error);
    write(folder / "manifest.json", generator.next(3) ? "{\"id\":\"theme\",\"name\":\"Theme\"}"
                                                      : generator.bytes(generator.next(80)));
    if (generator.next(4) != 0)
    {
        write(folder / "bundle.json", generator.next(3)
                                          ? "{\"semantic\":{},\"raw\":{}}"
                                          : generator.mutate("{\"semantic\":{\"a\":[1,2]}}"));
    }
}

static void addFont(Generator &generator, const fs::path &fonts)
{
    fs::path        file = fonts / (generator.folderName() + (generator.next(2) ? ".ttf" : ".otf"));
    std::error_code error;
    switch (generator.next(6))
    {
        case 0:
            write(file, generator.bytes(generator.next(2048)));
            return;
        case 1:
            write(file, "");
            return;
        case 2:
            fs::create_directories(file, error);
            return;
        default:
            write(file, generator.mutate(
                            syntheticFont("Fuzz Sans " + std::to_string(generator.next(100)))));
            return;
    }
}

static bool inside(const fs::path &root, const fs::path &path)
{
    std::error_code error;
    fs::path        canonicalRoot = fs::weakly_canonical(root, error);
    fs::path        canonicalPath = fs::weakly_canonical(path, error);
    auto            rootEnd       = canonicalRoot.end();
    return std::mismatch(canonicalRoot.begin(), rootEnd, canonicalPath.begin(), canonicalPath.end())
               .first == rootEnd;
}

static void scanRound(Generator &generator, const fs::path &base)
{
    fs::remove_all(base);
    fs::path documents = base / "Documents";
    fs::path outside   = base / "outside";
    fs::create_directories(outside);
    write(outside / "secret.txt", "secret outside the plugin folder");
    write(base / "escape.js", "outside");
    fs::path plugins = documents / "Plugins";
    fs::path themes  = documents / "Themes";
    fs::path fonts   = documents / "Fonts";
    fs::create_directories(plugins);
    fs::create_directories(themes);
    fs::create_directories(fonts);
    for (uint32_t count = generator.next(12); count > 0; count--)
    {
        addPlugin(generator, plugins, outside);
    }
    for (uint32_t count = generator.next(5); count > 0; count--)
    {
        addTheme(generator, themes);
    }
    for (uint32_t count = generator.next(6); count > 0; count--)
    {
        addFont(generator, fonts);
    }

    auto               started = std::chrono::steady_clock::now();
    loader::AddonState state;
    state.scan(documents.string());
    require(std::chrono::steady_clock::now() - started < std::chrono::seconds(5),
            "a scan finishes quickly", documents.string());

    for (const nlohmann::json &plugin : state.plugins())
    {
        const nlohmann::json &manifest = plugin["manifest"];
        fs::path              folder   = manifest["path"].get<std::string>();
        fs::path              entry    = manifest["entry"].get<std::string>();
        require(inside(plugins, folder), "a loaded plugin lives in the Plugins folder",
                folder.string());
        require(inside(folder, entry), "a plugin's entry stays inside its own folder",
                entry.string());
        require(plugin["bundle"].is_string(), "a loaded plugin carries its bundle", entry.string());
    }
    for (const nlohmann::json &theme : state.themes())
    {
        require(inside(themes, theme["manifest"]["path"].get<std::string>()),
                "a loaded theme lives in the Themes folder",
                theme["manifest"]["path"].get<std::string>());
    }
    for (const nlohmann::json &font : state.fonts())
    {
        require(font.contains("file") && font["file"].is_string(), "a font entry names its file",
                "font");
    }
}

int main()
{
    const char *roundsVariable = std::getenv("UNBOUND_FUZZ_ITERATIONS");
    const long  rounds         = roundsVariable ? std::strtol(roundsVariable, nullptr, 10) : 150;
    Generator   generator(0xadd0);
    fs::path    base = fs::temp_directory_path() / "unbound-addon-discovery-fuzz";

    for (long round = 0; round < rounds; round++)
    {
        scanRound(generator, base);
    }
    fs::remove_all(base);

    std::string font = syntheticFont("Seed Sans");
    for (long iteration = 0; iteration < rounds * 50; iteration++)
    {
        std::string data = generator.mutate(font);
        loader::fontNamesFromData(data);
        loader::fontFullNameFromData(data);
    }

    std::printf("addon discovery fuzz: %ld scanned folders, %ld mutated fonts\n", rounds,
                rounds * 50);
    return 0;
}
