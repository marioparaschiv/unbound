#include "LoaderSettings.h"

#include "LoaderFiles.h"
#include "LoaderLog.h"

#include <chrono>

namespace loader
{
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

        nlohmann::json parsed = nlohmann::json::parse(*contents, nullptr, false);
        if (parsed.is_discarded() || !parsed.is_object())
        {
            log(LogLevel::Error, "settings", "settings.json is corrupt, backing it up and resetting.");
            backupCorruptFile();
            data_ = nlohmann::json::object();
            writeTextFileAtomically(path_, "{}");
            return;
        }

        data_ = std::move(parsed);
    }

    bool SettingsStore::save() const
    {
        return writeTextFileAtomically(path_, serialize());
    }

    std::string SettingsStore::serialize() const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return data_.dump(2);
    }

    bool SettingsStore::replace(const std::string &json)
    {
        nlohmann::json parsed = nlohmann::json::parse(json, nullptr, false);
        if (parsed.is_discarded() || !parsed.is_object())
        {
            return false;
        }

        std::lock_guard<std::mutex> lock(mutex_);
        data_ = std::move(parsed);
        return true;
    }

    std::optional<nlohmann::json> SettingsStore::get(const std::string &store,
                                                     const std::string &key) const
    {
        std::lock_guard<std::mutex> lock(mutex_);

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

    const std::string &SettingsStore::path() const
    {
        return path_;
    }

    void SettingsStore::backupCorruptFile() const
    {
        auto timestamp = std::chrono::duration_cast<std::chrono::seconds>(
                             std::chrono::system_clock::now().time_since_epoch())
                             .count();
        std::string backup = path_ + ".corrupt-" + std::to_string(timestamp);
        if (!copyFile(path_, backup))
        {
            log(LogLevel::Error, "settings", "Failed to back up corrupt settings.json.");
            return;
        }

        log(LogLevel::Error, "settings", "Backed up corrupt settings.json to " + backup);
    }
}
