#include "LoaderCrashGuard.h"

#include <map>
#include <mutex>
#include <optional>
#include <set>

#include "LoaderCrashHandler.h"
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

std::string AddonCrashGuard::runningPath() const
{
    return joinPath(directory_, kRunningFile);
}

std::string AddonCrashGuard::crashesPath() const
{
    return joinPath(directory_, kCrashesFile);
}

static std::optional<CrashRecord> takeMarker(const std::string &path, CrashPhase phase,
                                             bool &unreadable)
{
    bool                       present = fileExists(path) && fileSize(path) > 0;
    std::optional<CrashRecord> record  = readRecord(path);
    removeFile(path);
    if (record)
    {
        record->addon.phase = phase;
    }
    else if (present)
    {
        unreadable = true;
    }
    return record;
}

static std::string crashActivity(CrashPhase phase)
{
    return phase == CrashPhase::Running ? "running" : "starting";
}

std::vector<CrashedAddon> AddonCrashGuard::recoverFromPreviousLaunch() const
{
    bool                       unreadable = false;
    std::optional<CrashRecord> starting =
        takeMarker(startingPath(), CrashPhase::Starting, unreadable);
    std::optional<CrashRecord> running = takeMarker(runningPath(), CrashPhase::Running, unreadable);
    std::optional<CrashRecord> crashed = starting ? starting : running;

    if (!crashed)
    {
        if (unreadable)
        {
            log(LogLevel::Warning, LOG_CATEGORY_PLUGINS,
                "Ignoring an unreadable addon crash marker from the previous launch.");
        }
        removeFile(crashesPath());
        return {};
    }

    std::optional<CrashRecord> previous = readRecord(crashesPath());
    int crashes = previous && previous->addon.id == crashed->addon.id ? previous->crashes + 1 : 1;

    log(LogLevel::Warning, LOG_CATEGORY_PLUGINS,
        "Discord exited while " + crashActivity(crashed->addon.phase) + " " + crashed->addon.name +
            " (" + crashed->addon.id + "), crash " + std::to_string(crashes) + " of " +
            std::to_string(kCrashLimit) + ".");

    if (crashes >= kCrashLimit)
    {
        removeFile(crashesPath());
        log(LogLevel::Error, LOG_CATEGORY_PLUGINS, crashDisabledNotice(crashed->addon));
        return {crashed->addon};
    }

    if (!writeTextFileAtomically(crashesPath(), recordJSON(crashed->addon, crashes).dump()))
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

bool armAddonCrashAttribution(const std::string &directory)
{
    if (directory.empty())
    {
        return false;
    }
    crashDisabledAddons(directory);
    createDirectories(directory);
    return installAddonCrashHandler(joinPath(directory, AddonCrashGuard::kRunningFile));
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
    return "Disabled " + addon.name + " because Discord crashed while " +
           crashActivity(addon.phase) + " it.";
}

nlohmann::json crashedAddonsJSON(const std::vector<CrashedAddon> &addons)
{
    nlohmann::json result = nlohmann::json::array();
    for (const CrashedAddon &addon : addons)
    {
        result.push_back(
            {{"id", addon.id}, {"name", addon.name}, {"phase", crashActivity(addon.phase)}});
    }
    return result;
}
}
