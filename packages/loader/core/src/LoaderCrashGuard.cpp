#include "LoaderCrashGuard.h"

#include <fcntl.h>
#include <map>
#include <mutex>
#include <optional>
#include <set>
#include <sys/stat.h>
#include <unistd.h>

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
    record.addon.id = id->get<std::string>();
    auto name       = parsed.find("name");
    record.addon.name =
        name != parsed.end() && name->is_string() ? name->get<std::string>() : record.addon.id;
    auto crashes = parsed.find("crashes");
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

std::string AddonCrashGuard::frozenPath() const
{
    return joinPath(directory_, kFrozenFile);
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
    switch (phase)
    {
        case CrashPhase::Running:
            return "running";
        case CrashPhase::Frozen:
            return "frozen";
        case CrashPhase::Starting:
            return "starting";
    }
    return "starting";
}

std::vector<CrashedAddon> AddonCrashGuard::recoverFromPreviousLaunch() const
{
    bool                       unreadable = false;
    std::optional<CrashRecord> starting =
        takeMarker(startingPath(), CrashPhase::Starting, unreadable);
    std::optional<CrashRecord> running = takeMarker(runningPath(), CrashPhase::Running, unreadable);
    std::optional<CrashRecord> frozen  = takeMarker(frozenPath(), CrashPhase::Frozen, unreadable);
    std::optional<CrashRecord> crashed = starting ? starting : running ? running : frozen;

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

    std::string exited = crashed->addon.phase == CrashPhase::Frozen
                             ? "Discord was closed while frozen in "
                             : "Discord exited while " + crashActivity(crashed->addon.phase) + " ";
    log(LogLevel::Warning, LOG_CATEGORY_PLUGINS,
        exited + crashed->addon.name + " (" + crashed->addon.id + "), crash " +
            std::to_string(crashes) + " of " + std::to_string(kCrashLimit) + ".");

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

class StartMarker
{
public:
    bool write(const std::string &directory, const std::string &path, const std::string &id,
               const std::string &record)
    {
        if (!reopenIfUnlinked(directory, path))
        {
            return false;
        }
        bool written = pwrite(descriptor_, record.data(), record.size(), 0) ==
                           static_cast<ssize_t>(record.size()) &&
                       ftruncate(descriptor_, static_cast<off_t>(record.size())) == 0;
        id_          = written ? id : std::string();
        return written;
    }

    bool clear(const std::string &id)
    {
        if (id_.empty() || id_ != id || descriptor_ < 0)
        {
            return false;
        }
        id_.clear();
        return ftruncate(descriptor_, 0) == 0;
    }

private:
    bool reopenIfUnlinked(const std::string &directory, const std::string &path)
    {
        struct stat status = {};
        if (descriptor_ >= 0 && fstat(descriptor_, &status) == 0 && status.st_nlink > 0)
        {
            return true;
        }
        if (descriptor_ >= 0)
        {
            close(descriptor_);
        }
        id_.clear();
        createDirectories(directory);
        descriptor_ = open(path.c_str(), O_RDWR | O_CREAT | O_CLOEXEC, 0600);
        return descriptor_ >= 0;
    }

    int         descriptor_ = -1;
    std::string id_;
};

static std::mutex                         gStartMarkersMutex;
static std::map<std::string, StartMarker> gStartMarkers;

bool AddonCrashGuard::beginStart(const std::string &id, const std::string &name) const
{
    if (id.empty())
    {
        return false;
    }
    std::string                 record = recordJSON({id, name.empty() ? id : name}, 0).dump();
    std::lock_guard<std::mutex> lock(gStartMarkersMutex);
    return gStartMarkers[startingPath()].write(directory_, startingPath(), id, record);
}

bool AddonCrashGuard::finishStart(const std::string &id) const
{
    std::lock_guard<std::mutex> lock(gStartMarkersMutex);
    auto                        marker = gStartMarkers.find(startingPath());
    return marker != gStartMarkers.end() && marker->second.clear(id);
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
    static std::mutex            mutex;
    static std::set<std::string> armed;

    if (directory.empty())
    {
        return false;
    }
    {
        std::lock_guard<std::mutex> lock(mutex);
        if (armed.count(directory))
        {
            return true;
        }
    }
    crashDisabledAddons(directory);
    createDirectories(directory);
    bool installed = installAddonCrashHandler(joinPath(directory, AddonCrashGuard::kRunningFile));
    if (installed)
    {
        std::lock_guard<std::mutex> lock(mutex);
        armed.insert(directory);
    }
    return installed;
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
    if (addon.phase == CrashPhase::Frozen)
    {
        return "Disabled " + addon.name + " because Discord froze in it and had to be closed.";
    }
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
