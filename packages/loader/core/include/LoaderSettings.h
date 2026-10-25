#pragma once

#include <mutex>
#include <optional>
#include <string>

#include <nlohmann/json.hpp>

namespace loader
{
    class SettingsStore
    {
    public:
        explicit SettingsStore(std::string path);

        void load();
        bool save() const;

        std::string serialize() const;
        bool replace(const std::string &json);

        std::optional<nlohmann::json> get(const std::string &store, const std::string &key) const;
        bool getBoolean(const std::string &store, const std::string &key, bool fallback) const;
        std::string getString(const std::string &store, const std::string &key,
                              const std::string &fallback) const;
        void set(const std::string &store, const std::string &key, nlohmann::json value);

        const std::string &path() const;

    private:
        void backupCorruptFile() const;

        std::string        path_;
        nlohmann::json     data_ = nlohmann::json::object();
        mutable std::mutex mutex_;
    };
}
