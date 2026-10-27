#include "LoaderCrashGuard.h"

#include <map>
#include <mutex>
#include <optional>
#include <set>

#include "LoaderFiles.h"
#include "LoaderLog.h"

namespace loader {
struct CrashRecord {
    CrashedAddon addon;
    int          crashes = 0;
};

static std::optional<CrashRecord> readRecord(const std::string &path)
{
    std::optional<std::string> contents = readTextFile(path);
    if (!contents)
    {
        return std::nullopt;
    }

    nlohmann::json parsed = nlohmann::json::parse(*contents, nullptr, false);
    if (parsed.is_discarded() || !parsed.is_object())
    {
        return std::nullopt;
    }

    auto id = parsed.find("id");
    if (id == parsed.end() || !id->is_string() || id->get<std::string>().empty())
    {
        return std::nullopt;
    }

    CrashRecord record;
    record.addon.id   = id->get<std::string>();
    record.addon.name = parsed.value("name", record.addon.id);
    auto crashes      = parsed.find("crashes");
    record.crashes =
        crashes != parsed.end() && crashes->is_number_integer() ? crashes->get<int>() : 0;
    return record;
}

static nlohmann::json recordJSON(const CrashedAddon &addon, int crashes)
{
    return {{"id", addon.id}, {"name", addon.name}, {"crashes", crashes}};
}

AddonCrashGuard::AddonCrashGuard(std::string directory) : directory_(std::move(directory)) {}

std::string AddonCrashGuard::startingPath() const
{
    return joinPath(directory_, kStartingFile);
}

std::string AddonCrashGuard::crashesPath() const
{
    return joinPath(directory_, kCrashesFile);
}

std::vector<CrashedAddon> AddonCrashGuard::recoverFromPreviousLaunch() const
{
    bool                       interrupted = fileExists(startingPath());
    std::optional<CrashRecord> starting    = readRecord(startingPath());
    removeFile(startingPath());

    if (!starting)
    {
        if (interrupted)
        {
            log(LogLevel::Warning, LOG_CATEGORY_PLUGINS,
                "Ignoring an unreadable addon start marker from the previous launch.");
        }
        removeFile(crashesPath());
        return {};
    }

    std::optional<CrashRecord> previous = readRecord(crashesPath());
    int crashes = previous && previous->addon.id == starting->addon.id ? previous->crashes + 1 : 1;

    log(LogLevel::Warning, LOG_CATEGORY_PLUGINS,
        "Discord exited while starting " + starting->addon.name + " (" + starting->addon.id +
            "), crash " + std::to_string(crashes) + " of " + std::to_string(kCrashLimit) + ".");

    if (crashes >= kCrashLimit)
    {
        removeFile(crashesPath());
        log(LogLevel::Error, LOG_CATEGORY_PLUGINS, crashDisabledNotice(starting->addon));
        return {starting->addon};
    }

    if (!writeTextFileAtomically(crashesPath(), recordJSON(starting->addon, crashes).dump()))
    {
        log(LogLevel::Error, LOG_CATEGORY_PLUGINS, "Addon crash count could not be saved.");
    }
    return {};
}

bool AddonCrashGuard::beginStart(const std::string &id, const std::string &name) const
{
    if (id.empty())
    {
        return false;
    }
    createDirectories(directory_);
    return writeTextFileAtomically(startingPath(),
                                   recordJSON({id, name.empty() ? id : name}, 0).dump());
}

bool AddonCrashGuard::finishStart(const std::string &id) const
{
    std::optional<CrashRecord> starting = readRecord(startingPath());
    if (!starting || starting->addon.id != id)
    {
        return false;
    }
    return removeFile(startingPath());
}

std::vector<CrashedAddon> crashDisabledAddons(const std::string &directory)
{
    static std::mutex                                       mutex;
    static std::map<std::string, std::vector<CrashedAddon>> verdicts;

    std::lock_guard<std::mutex> lock(mutex);
    auto                        found = verdicts.find(directory);
    if (found == verdicts.end())
    {
        found = verdicts.emplace(directory, AddonCrashGuard(directory).recoverFromPreviousLaunch())
                    .first;
    }
    return found->second;
}

std::vector<CrashedAddon> takeUnannouncedCrashDisabledAddons(const std::string &directory)
{
    static std::mutex            mutex;
    static std::set<std::string> announced;

    std::vector<CrashedAddon>   addons = crashDisabledAddons(directory);
    std::lock_guard<std::mutex> lock(mutex);
    if (!announced.insert(directory).second)
    {
        return {};
    }
    return addons;
}

std::string crashDisabledNotice(const CrashedAddon &addon)
{
    return "Disabled " + addon.name + " because Discord crashed while starting it.";
}

nlohmann::json crashedAddonsJSON(const std::vector<CrashedAddon> &addons)
{
    nlohmann::json result = nlohmann::json::array();
    for (const CrashedAddon &addon : addons)
    {
        result.push_back({{"id", addon.id}, {"name", addon.name}});
    }
    return result;
}
}
