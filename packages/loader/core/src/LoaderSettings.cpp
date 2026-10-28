#include "LoaderSettings.h"

#include <chrono>
#include <filesystem>
#include <system_error>

#include "LoaderFiles.h"
#include "LoaderJSON.h"
#include "LoaderLog.h"

namespace loader {
static std::vector<std::string> splitKeyPath(const std::string &key)
{
    std::vector<std::string> parts;
    size_t                   start = 0;
    while (start <= key.size())
    {
        size_t end = key.find('.', start);
        if (end == std::string::npos)
        {
            parts.push_back(key.substr(start));
            break;
        }
        parts.push_back(key.substr(start, end - start));
        start = end + 1;
    }
    return parts;
}

SettingsStore::SettingsStore(std::string path) : path_(std::move(path)) {}

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

void SettingsStore::refreshLocked() const
{
    if (dirty_)
    {
        return;
    }
    const FileStamp current = stampOnDisk();
    if (current == stamp_ || !current.exists)
    {
        return;
    }
    std::optional<std::string> contents = readTextFile(path_);
    nlohmann::json             parsed   = contents ? parseBoundedJSON(*contents) : nlohmann::json();
    if (parsed.is_object())
    {
        data_ = std::move(parsed);
    }
    stamp_ = current;
}

void SettingsStore::load()
{
    std::lock_guard<std::mutex> lock(mutex_);

    std::optional<std::string> contents = readTextFile(path_);
    if (!contents)
    {
        data_ = nlohmann::json::object();
        writeTextFileAtomically(path_, "{}");
        return;
    }

    nlohmann::json parsed = parseBoundedJSON(*contents);
    if (parsed.is_discarded() || !parsed.is_object())
    {
        log(LogLevel::Error, LOG_CATEGORY_SETTINGS,
            "settings.json is corrupt, backing it up and resetting.");
        backupCorruptFile();
        data_ = nlohmann::json::object();
        writeTextFileAtomically(path_, "{}");
        return;
    }

    data_  = std::move(parsed);
    stamp_ = stampOnDisk();
    dirty_ = false;
}

bool SettingsStore::save() const
{
    std::lock_guard<std::mutex> lock(mutex_);
    if (!writeTextFileAtomically(path_, data_.dump(2)))
    {
        return false;
    }
    stamp_ = stampOnDisk();
    dirty_ = false;
    return true;
}

nlohmann::json SettingsStore::snapshot() const
{
    std::lock_guard<std::mutex> lock(mutex_);
    refreshLocked();
    return data_;
}

std::string SettingsStore::serialize() const
{
    std::lock_guard<std::mutex> lock(mutex_);
    refreshLocked();
    return data_.dump(2);
}

bool SettingsStore::replace(const std::string &json)
{
    nlohmann::json parsed = parseBoundedJSON(json);
    if (parsed.is_discarded() || !parsed.is_object())
    {
        return false;
    }

    std::lock_guard<std::mutex> lock(mutex_);
    data_  = std::move(parsed);
    dirty_ = true;
    return true;
}

std::optional<nlohmann::json> SettingsStore::get(const std::string &store,
                                                 const std::string &key) const
{
    std::lock_guard<std::mutex> lock(mutex_);
    refreshLocked();

    auto storeEntry = data_.find(store);
    if (storeEntry == data_.end() || !storeEntry->is_object())
    {
        return std::nullopt;
    }

    const nlohmann::json *current = &*storeEntry;
    for (const std::string &part : splitKeyPath(key))
    {
        if (!current->is_object())
        {
            return std::nullopt;
        }

        auto next = current->find(part);
        if (next == current->end())
        {
            return std::nullopt;
        }
        current = &*next;
    }

    if (current->is_null())
    {
        return std::nullopt;
    }

    return *current;
}

bool SettingsStore::getBoolean(const std::string &store, const std::string &key,
                               bool fallback) const
{
    std::optional<nlohmann::json> value = get(store, key);
    if (!value)
    {
        return fallback;
    }

    if (value->is_boolean())
    {
        return value->get<bool>();
    }

    if (value->is_number())
    {
        return value->get<double>() != 0;
    }

    if (value->is_string())
    {
        const std::string text = value->get<std::string>();
        return text == "true" || text == "1" || text == "yes";
    }

    return fallback;
}

std::string SettingsStore::getString(const std::string &store, const std::string &key,
                                     const std::string &fallback) const
{
    std::optional<nlohmann::json> value = get(store, key);
    if (!value || !value->is_string())
    {
        return fallback;
    }

    return value->get<std::string>();
}

void SettingsStore::set(const std::string &store, const std::string &key, nlohmann::json value)
{
    std::lock_guard<std::mutex> lock(mutex_);
    refreshLocked();
    setLocked(store, key, std::move(value));
}

void SettingsStore::remove(const std::string &store, const std::string &key)
{
    std::lock_guard<std::mutex> lock(mutex_);
    refreshLocked();
    removeLocked(store, key);
}

bool SettingsStore::apply(const nlohmann::json &changes)
{
    if (!changes.is_array() || jsonNestsTooDeeply(changes))
    {
        return false;
    }

    {
        std::lock_guard<std::mutex> lock(mutex_);
        refreshLocked();
        for (const nlohmann::json &change : changes)
        {
            if (!change.is_object() || !change.contains("store") || !change["store"].is_string())
            {
                continue;
            }
            if (change.contains("clear") && change["clear"].is_boolean() &&
                change["clear"].get<bool>())
            {
                dirty_ = data_.erase(change["store"].get<std::string>()) > 0 || dirty_;
                continue;
            }
            if (!change.contains("key") || !change["key"].is_string())
            {
                continue;
            }

            const std::string store = change["store"].get<std::string>();
            const std::string key   = change["key"].get<std::string>();
            if (change.contains("remove") && change["remove"].is_boolean() &&
                change["remove"].get<bool>())
            {
                removeLocked(store, key);
            }
            else
            {
                setLocked(store, key,
                          change.contains("value") ? change["value"] : nlohmann::json(nullptr));
            }
        }
    }
    return save();
}

void SettingsStore::setLocked(const std::string &store, const std::string &key,
                              nlohmann::json value)
{
    dirty_ = true;

    nlohmann::json &payload = data_[store];
    if (!payload.is_object())
    {
        payload = nlohmann::json::object();
    }

    std::vector<std::string> parts   = splitKeyPath(key);
    nlohmann::json          *current = &payload;
    for (size_t index = 0; index + 1 < parts.size(); index++)
    {
        nlohmann::json &next = (*current)[parts[index]];
        if (!next.is_object())
        {
            next = nlohmann::json::object();
        }
        current = &next;
    }

    (*current)[parts.back()] = std::move(value);
}

void SettingsStore::removeLocked(const std::string &store, const std::string &key)
{
    auto payload = data_.find(store);
    if (payload == data_.end() || !payload->is_object())
    {
        return;
    }

    std::vector<std::string> parts   = splitKeyPath(key);
    nlohmann::json          *current = &*payload;
    for (size_t index = 0; index + 1 < parts.size(); index++)
    {
        auto next = current->find(parts[index]);
        if (next == current->end() || !next->is_object())
        {
            return;
        }
        current = &*next;
    }

    if (current->erase(parts.back()) > 0)
    {
        dirty_ = true;
    }
}

const std::string &SettingsStore::path() const
{
    return path_;
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
}
}
