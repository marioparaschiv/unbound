#include "LoaderAddons.h"
#include "LoaderThemes.h"
#include "LoaderFonts.h"

#include "LoaderFiles.h"
#include "LoaderLog.h"

#include <optional>

namespace loader
{
    template <typename Handler>
    static void scanAddonDirectory(const std::string &documents, const std::string &subfolder,
                                   const std::string &category, Handler handler)
    {
        std::string root = joinPath(documents, subfolder);
        createDirectories(root);

        for (const std::string &folder : listDirectory(root))
        {
            log(LogLevel::Info, category, "Attempting to load " + folder + "...");
            try
            {
                handler(folder, joinPath(root, folder));
            }
            catch (const std::exception &error)
            {
                log(LogLevel::Error, category,
                    "Failed to load " + folder + " (" + error.what() + ")");
            }
        }
    }

    static std::optional<nlohmann::json> parseObjectFile(const std::string &path,
                                                         const std::string &folder,
                                                         const std::string &category,
                                                         const std::string &label)
    {
        std::optional<std::string> contents = readTextFile(path);
        if (!contents)
        {
            log(LogLevel::Error, category,
                "Skipping " + folder + " as its " + label + " failed to be read.");
            return std::nullopt;
        }

        nlohmann::json parsed = nlohmann::json::parse(*contents, nullptr, false);
        if (parsed.is_discarded() || !parsed.is_object())
        {
            log(LogLevel::Info, category, "Skipping " + folder + " as its " + label + " is invalid.");
            return std::nullopt;
        }

        return parsed;
    }

    static std::optional<std::string> resolveManifestEntry(const std::string &directory,
                                                           const nlohmann::json &manifest,
                                                           const std::string &key)
    {
        auto value = manifest.find(key);
        if (value == manifest.end() || !value->is_string() || value->get<std::string>().empty())
        {
            return std::nullopt;
        }

        std::string path = joinPath(directory, value->get<std::string>());
        if (!fileExists(path) || isDirectory(path))
        {
            return std::nullopt;
        }

        return path;
    }

    nlohmann::json scanPlugins(const std::string &documents)
    {
        nlohmann::json plugins = nlohmann::json::array();

        scanAddonDirectory(
            documents, "Plugins", "plugins",
            [&](const std::string &folder, const std::string &directory) {
                if (!isDirectory(directory))
                {
                    log(LogLevel::Info, LOG_CATEGORY_PLUGINS,
                        "Skipping " + folder + " as it is not a directory.");
                    return;
                }

                std::string manifestPath = joinPath(directory, "manifest.json");
                if (!fileExists(manifestPath))
                {
                    log(LogLevel::Info, LOG_CATEGORY_PLUGINS,
                        "Skipping " + folder + " as it is missing a manifest.");
                    return;
                }

                std::optional<nlohmann::json> manifest =
                    parseObjectFile(manifestPath, folder, "plugins", "manifest");
                if (!manifest)
                {
                    return;
                }

                std::optional<std::string> entry =
                    resolveManifestEntry(directory, *manifest, "main");
                if (!entry)
                {
                    log(LogLevel::Info, LOG_CATEGORY_PLUGINS,
                        "Skipping " + folder + " as manifest.main is missing or invalid.");
                    return;
                }

                std::optional<std::string> bundle = readTextFile(*entry);
                if (!bundle)
                {
                    log(LogLevel::Error, LOG_CATEGORY_PLUGINS,
                        "Skipping " + folder + " as its entry failed to be read.");
                    return;
                }

                (*manifest)["folder"] = folder;
                (*manifest)["path"]   = directory;
                (*manifest)["entry"]  = *entry;

                plugins.push_back({{"manifest", *manifest}, {"bundle", *bundle}});
                log(LogLevel::Info, LOG_CATEGORY_PLUGINS, "Loaded " + folder + " from " + *entry + ".");
            });

        size_t count = plugins.size();
        log(LogLevel::Info, LOG_CATEGORY_PLUGINS,
            "Loaded " + std::to_string(count) + (count == 1 ? " plugin." : " plugins."));
        return plugins;
    }

    nlohmann::json scanThemes(const std::string &documents)
    {
        nlohmann::json themes = nlohmann::json::array();

        scanAddonDirectory(
            documents, "Themes", "themes",
            [&](const std::string &folder, const std::string &directory) {
                if (!isDirectory(directory))
                {
                    log(LogLevel::Info, LOG_CATEGORY_THEMES,
                        "Skipping " + folder + " as it is not a directory.");
                    return;
                }

                std::string manifestPath = joinPath(directory, "manifest.json");
                if (!fileExists(manifestPath))
                {
                    log(LogLevel::Info, LOG_CATEGORY_THEMES,
                        "Skipping " + folder + " as it is missing a manifest.");
                    return;
                }

                std::optional<nlohmann::json> manifest =
                    parseObjectFile(manifestPath, folder, "themes", "manifest");
                if (!manifest)
                {
                    return;
                }

                std::string bundlePath = joinPath(directory, "bundle.json");
                if (!fileExists(bundlePath))
                {
                    log(LogLevel::Info, LOG_CATEGORY_THEMES,
                        "Skipping " + folder + " as it is missing a bundle.");
                    return;
                }

                std::optional<nlohmann::json> bundle =
                    parseObjectFile(bundlePath, folder, "themes", "bundle");
                if (!bundle)
                {
                    return;
                }

                (*manifest)["folder"] = folder;
                (*manifest)["path"]   = directory;

                themes.push_back({{"manifest", *manifest}, {"bundle", *bundle}});
            });

        return themes;
    }

    nlohmann::json scanFonts(const std::string &documents)
    {
        nlohmann::json fonts = nlohmann::json::array();

        scanAddonDirectory(documents, "Fonts", "fonts",
                           [&](const std::string &file, const std::string &path) {
                               if (isDirectory(path))
                               {
                                   return;
                               }

                               nlohmann::json entry = fontEntry(path, "custom");
                               entry["file"]        = file;
                               log(LogLevel::Info, LOG_CATEGORY_FONTS, "Registering font: " + path);
                               fonts.push_back(std::move(entry));
                           });

        return fonts;
    }

    void AddonState::scan(const std::string &documents)
    {
        nlohmann::json plugins = scanPlugins(documents);
        nlohmann::json themes  = scanThemes(documents);
        nlohmann::json fonts   = scanFonts(documents);

        std::lock_guard<std::mutex> lock(mutex_);
        plugins_ = std::move(plugins);
        themes_  = std::move(themes);
        fonts_   = std::move(fonts);
    }

    nlohmann::json AddonState::plugins() const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return plugins_;
    }

    nlohmann::json AddonState::themes() const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return themes_;
    }

    nlohmann::json AddonState::fonts() const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return fonts_;
    }

    std::optional<nlohmann::json> AddonState::theme(const std::string &id) const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        const nlohmann::json *found = findTheme(themes_, id);
        return found ? std::optional<nlohmann::json>(*found) : std::nullopt;
    }
}
