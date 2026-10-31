#include "LoaderDocuments.h"

#include <filesystem>
#include <nlohmann/json.hpp>
#include <system_error>

#include "LoaderFiles.h"
#include "LoaderJSON.h"
#include "LoaderLog.h"
#include "LoaderPreferences.h"

namespace fs = std::filesystem;

namespace loader {
static constexpr const char *kLegacyDocumentsName = "astral";
static constexpr const char *kLegacyFilePrefix    = "astral.";
static constexpr const char *kFilePrefix          = "unbound.";

static std::string renamedRootFile(const std::string &name)
{
    const std::string prefix = kLegacyFilePrefix;
    return name.rfind(prefix, 0) == 0 ? kFilePrefix + name.substr(prefix.size()) : name;
}

static void fillMissing(nlohmann::json &current, const nlohmann::json &legacy)
{
    for (const auto &[key, value] : legacy.items())
    {
        auto existing = current.find(key);
        if (existing == current.end())
        {
            current[key] = value;
        }
        else if (existing->is_object() && value.is_object())
        {
            fillMissing(*existing, value);
        }
    }
}

static bool mergeSettings(const fs::path &legacy, const fs::path &current)
{
    const auto     legacyText  = readTextFile(legacy.string());
    const auto     currentText = readTextFile(current.string());
    nlohmann::json legacyData  = legacyText ? parseBoundedJSON(*legacyText) : nlohmann::json();
    nlohmann::json currentData = currentText ? parseBoundedJSON(*currentText) : nlohmann::json();
    if (!legacyData.is_object())
    {
        return true;
    }
    if (!currentData.is_object())
    {
        currentData = nlohmann::json::object();
    }

    fillMissing(currentData, legacyData);
    return writeTextFileAtomically(current.string(), currentData.dump(2));
}

static bool moveInto(const fs::path &from, const fs::path &to, bool root)
{
    std::error_code        error;
    fs::directory_iterator entries(from, error);
    bool                   moved = true;
    for (; !error && entries != fs::directory_iterator(); entries.increment(error))
    {
        const fs::path    source = entries->path();
        const std::string name   = source.filename().string();
        const fs::path    target = to / (root ? renamedRootFile(name) : name);
        std::error_code   entryError;

        const bool targetExists = fs::exists(target, entryError);
        if (!entryError && !targetExists)
        {
            fs::rename(source, target, entryError);
        }
        else if (!entryError && fs::is_directory(source, entryError) &&
                 fs::is_directory(target, entryError))
        {
            moved = moveInto(source, target, false) && moved;
            continue;
        }
        else if (!entryError && root && name == preferences::kSettingsFile)
        {
            moved = mergeSettings(source, target) && moved;
            continue;
        }
        else if (!entryError)
        {
            log(LogLevel::Warning, LOG_CATEGORY_FILESYSTEM,
                "Kept " + target.string() + ", dropping " + source.string());
            continue;
        }

        if (entryError)
        {
            log(LogLevel::Error, LOG_CATEGORY_FILESYSTEM,
                "Failed to move " + source.string() + ": " + entryError.message());
            moved = false;
        }
    }

    if (error)
    {
        log(LogLevel::Error, LOG_CATEGORY_FILESYSTEM,
            "Failed to read " + from.string() + ": " + error.message());
        return false;
    }
    return moved;
}

std::string documentsDirectory(const std::string &parent)
{
    const fs::path current = fs::path(parent) / preferences::kDocumentsName;
    const fs::path legacy  = fs::path(parent) / kLegacyDocumentsName;

    std::error_code error;
    if (!fs::is_directory(legacy, error))
    {
        return current.string();
    }

    fs::create_directories(current, error);
    if (!moveInto(legacy, current, true))
    {
        log(LogLevel::Error, LOG_CATEGORY_FILESYSTEM,
            "Failed to move everything out of " + legacy.string() + ", keeping it");
        return current.string();
    }

    fs::remove_all(legacy, error);
    log(LogLevel::Info, LOG_CATEGORY_FILESYSTEM,
        "Moved " + legacy.string() + " to " + current.string());
    return current.string();
}
}
