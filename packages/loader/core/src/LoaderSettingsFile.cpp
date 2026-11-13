#include <algorithm>
#include <charconv>
#include <chrono>
#include <filesystem>
#include <system_error>
#include <utility>

#include "LoaderFiles.h"
#include "LoaderJSON.h"
#include "LoaderJSONMembers.h"
#include "LoaderLaunchReport.h"
#include "LoaderLog.h"
#include "LoaderSettings.h"
#include "LoaderSettingsCache.h"

// SettingsStore's side that reads and writes settings.json and its binary cache.
namespace loader {
static std::string packStore(const nlohmann::json &value)
{
    std::string packed;
    nlohmann::json::to_msgpack(value, packed);
    return packed;
}

static std::optional<int64_t> corruptBackupTimestamp(const std::string &name,
                                                     const std::string &prefix)
{
    if (name.size() <= prefix.size() || name.rfind(prefix, 0) != 0)
    {
        return std::nullopt;
    }
    const char *first     = name.data() + prefix.size();
    const char *last      = name.data() + name.size();
    int64_t     timestamp = 0;
    auto [end, error]     = std::from_chars(first, last, timestamp);
    if (error != std::errc() || end != last)
    {
        return std::nullopt;
    }
    return timestamp;
}

std::string SettingsStore::cachePath() const
{
    return path_ + ".bin";
}

SettingsStore::FileStamp SettingsStore::stampOnDisk() const
{
    std::error_code error;
    const auto      size = std::filesystem::file_size(path_, error);
    if (error)
    {
        return {};
    }
    const auto modified = std::filesystem::last_write_time(path_, error);
    if (error)
    {
        return {};
    }
    return {true, static_cast<int64_t>(modified.time_since_epoch().count()),
            static_cast<uint64_t>(size)};
}

void SettingsStore::refreshLocked(bool beforeWrite) const
{
    if (dirty_)
    {
        return;
    }
    auto now = std::chrono::steady_clock::now();
    if (!beforeWrite && now - checkedAt_ < diskRecheck_)
    {
        return;
    }
    checkedAt_              = now;
    const FileStamp current = stampOnDisk();
    if (current == stamp_ || !current.exists)
    {
        return;
    }
    std::optional<std::string> contents = readTextFile(path_);
    if (contents)
    {
        adoptLocked(*contents);
    }
    stamp_ = current;
}

bool SettingsStore::adoptLocked(const std::string &contents) const
{
    const uint64_t                          hash  = settingsHash(contents);
    std::optional<std::string>              cache = readTextFile(cachePath());
    std::optional<std::vector<CachedStore>> stores =
        cache ? decodeSettingsCache(*cache, hash, contents.size()) : std::nullopt;
    if (stores)
    {
        data_ = nlohmann::json::object();
        raw_.clear();
        for (CachedStore &store : *stores)
        {
            raw_.insert_or_assign(std::move(store.name),
                                  RawStore{contents.substr(store.jsonOffset, store.jsonLength),
                                           std::move(store.packed)});
        }
        jsonHash_   = hash;
        cacheStale_ = false;
        return true;
    }

    // No cache for these exact bytes: settings.json was edited outside the store, or a save
    // stopped between the two files.
    std::optional<std::vector<JSONMember>> members = splitJSONObject(contents);
    if (!members)
    {
        return false;
    }
    data_ = nlohmann::json::object();
    raw_.clear();
    for (JSONMember &member : *members)
    {
        raw_.insert_or_assign(std::move(member.key), RawStore{std::string(member.value), {}});
    }
    jsonHash_   = hash;
    cacheStale_ = true;
    return true;
}

void SettingsStore::resetLocked() const
{
    data_ = nlohmann::json::object();
    raw_.clear();
    removeFile(cachePath());
    writeTextFileAtomically(path_, "{}");
    jsonHash_   = settingsHash("{}");
    cacheStale_ = true;
}

void SettingsStore::parseStoreLocked(const std::string &store) const
{
    auto raw = raw_.find(store);
    if (raw == raw_.end())
    {
        return;
    }

    nlohmann::json parsed = raw->second.packed.empty()
                                ? nlohmann::json(nlohmann::json::value_t::discarded)
                                : nlohmann::json::from_msgpack(raw->second.packed, true, false);
    if (parsed.is_discarded())
    {
        parsed = parseBoundedJSON(raw->second.json);
    }
    if (parsed.is_discarded())
    {
        log(LogLevel::Error, LOG_CATEGORY_SETTINGS,
            "Failed to parse settings store " + store + "; it reads as empty.");
    }
    else
    {
        data_[store] = std::move(parsed);
    }
    raw_.erase(raw);
}

void SettingsStore::parseAllLocked() const
{
    while (!raw_.empty())
    {
        parseStoreLocked(raw_.begin()->first);
    }
}

std::string SettingsStore::dumpLocked(std::vector<CachedStore> &layout) const
{
    std::string text = "{";
    auto append      = [&](const std::string &store, const std::string &value, std::string packed) {
        if (text.size() > 1)
        {
            text += ',';
        }
        text += nlohmann::json(store).dump();
        text += ':';
        layout.push_back({store, text.size(), value.size(), std::move(packed)});
        text += value;
    };

    for (const auto &[store, value] : data_.items())
    {
        append(store, value.dump(), packStore(value));
    }
    // Stores never read since loading go back out as the text they were read as.
    for (const auto &[store, raw] : raw_)
    {
        append(store, raw.json, raw.packed);
    }
    text += '}';
    return text;
}

void SettingsStore::load()
{
    std::lock_guard<std::mutex> lock(mutex_);

    std::optional<std::string> contents = readTextFile(path_);
    unreadable_                         = !contents && fileExists(path_);
    if (unreadable_)
    {
        log(LogLevel::Warning, LOG_CATEGORY_SETTINGS,
            "settings.json exists but cannot be read, as before the first unlock; leaving it "
            "untouched.");
    }
    if (!contents)
    {
        resetLocked();
        return;
    }

    if (!adoptLocked(*contents))
    {
        backupCorruptFile();
        if (!restoreLastGoodLocked())
        {
            log(LogLevel::Error, LOG_CATEGORY_SETTINGS,
                "settings.json is corrupt and has no last good copy; resetting it.");
            recordSettingsRecovery("reset");
            resetLocked();
            return;
        }
    }
    else
    {
        keepLastGoodLocked(*contents);
    }

    stamp_ = stampOnDisk();
    dirty_ = false;
}

std::string SettingsStore::lastGoodPath() const
{
    return path_ + ".good";
}

// A copy of the last settings.json that parsed, so a corrupt file restores instead of resetting.
void SettingsStore::keepLastGoodLocked(const std::string &contents) const
{
    if (contents.size() <= 2 || readTextFile(lastGoodPath()) == contents)
    {
        return;
    }
    if (!writeTextFileAtomically(lastGoodPath(), contents))
    {
        log(LogLevel::Warning, LOG_CATEGORY_SETTINGS,
            "Failed to save the last good settings.json.");
    }
}

bool SettingsStore::restoreLastGoodLocked() const
{
    removeFile(cachePath());
    std::optional<std::string> good = readTextFile(lastGoodPath());
    if (!good || !adoptLocked(*good) || !writeTextFileAtomically(path_, *good))
    {
        return false;
    }
    log(LogLevel::Error, LOG_CATEGORY_SETTINGS,
        "settings.json was corrupt; restored the last good copy.");
    recordSettingsRecovery("restored");
    return true;
}

void SettingsStore::reload()
{
    {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!dirty_ && stamp_.exists && stampOnDisk() == stamp_)
        {
            return;
        }
    }
    load();
}

bool SettingsStore::readable() const
{
    std::lock_guard<std::mutex> lock(mutex_);
    return !unreadable_;
}

bool SettingsStore::save() const
{
    std::lock_guard<std::mutex> lock(mutex_);
    if (unreadable_)
    {
        return false;
    }
    std::vector<CachedStore> layout;
    const std::string        text = dumpLocked(layout);
    // settings.json first: a crash before the cache is written leaves a cache for other bytes,
    // which the next load ignores.
    if (!writeTextFileAtomically(path_, text))
    {
        return false;
    }
    stamp_     = stampOnDisk();
    dirty_     = false;
    jsonHash_  = settingsHash(text);
    bool whole = true;
    for (const CachedStore &store : layout)
    {
        whole = whole && !store.packed.empty();
    }
    // A store loaded without the cache has no MessagePack yet; refreshCache() packs it later.
    cacheStale_ = !whole || !writeTextFileAtomically(
                                cachePath(), encodeSettingsCache(jsonHash_, text.size(), layout));
    return true;
}

void SettingsStore::refreshCache()
{
    {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!cacheStale_)
        {
            return;
        }
    }

    // Read and pack outside the lock so readers on other threads are not held up.
    std::optional<std::string>             contents = readTextFile(path_);
    std::optional<std::vector<JSONMember>> members =
        contents ? splitJSONObject(*contents) : std::nullopt;
    if (!members)
    {
        return;
    }
    std::vector<CachedStore> stores;
    for (const JSONMember &member : *members)
    {
        nlohmann::json parsed = parseBoundedJSON(std::string(member.value));
        if (parsed.is_discarded())
        {
            // A malformed store has no MessagePack form; it keeps loading from JSON.
            return;
        }
        stores.push_back({member.key, static_cast<uint64_t>(member.value.data() - contents->data()),
                          member.value.size(), packStore(parsed)});
    }
    const uint64_t hash = settingsHash(*contents);

    std::lock_guard<std::mutex> lock(mutex_);
    // Skip when a save wrote the cache meanwhile, or the file is no longer the one loaded.
    if (!cacheStale_ || hash != jsonHash_)
    {
        return;
    }
    for (const CachedStore &store : stores)
    {
        auto raw = raw_.find(store.name);
        if (raw != raw_.end() && raw->second.packed.empty())
        {
            raw->second.packed = store.packed;
        }
    }
    cacheStale_ =
        !writeTextFileAtomically(cachePath(), encodeSettingsCache(hash, contents->size(), stores));
}

void SettingsStore::backupCorruptFile() const
{
    auto        timestamp = std::chrono::duration_cast<std::chrono::seconds>(
                                std::chrono::system_clock::now().time_since_epoch())
                                .count();
    std::string backup    = path_ + ".corrupt-" + std::to_string(timestamp);
    if (!copyFile(path_, backup))
    {
        log(LogLevel::Error, LOG_CATEGORY_SETTINGS, "Failed to back up corrupt settings.json.");
        return;
    }

    log(LogLevel::Error, LOG_CATEGORY_SETTINGS, "Backed up corrupt settings.json to " + backup);
    pruneCorruptBackups();
}

// Keeps the newest few corrupt backups; their names sort by timestamp.
void SettingsStore::pruneCorruptBackups() const
{
    const std::filesystem::path settings(path_);
    const std::string           prefix = settings.filename().string() + ".corrupt-";
    std::vector<std::pair<int64_t, std::string>> backups;
    for (const std::string &name : listDirectory(settings.parent_path().string()))
    {
        if (std::optional<int64_t> timestamp = corruptBackupTimestamp(name, prefix))
        {
            backups.emplace_back(*timestamp, name);
        }
    }
    std::sort(backups.begin(), backups.end());
    for (size_t index = 0; index + kCorruptBackupsKept < backups.size(); index++)
    {
        removeFile((settings.parent_path() / backups[index].second).string());
    }
}
}
