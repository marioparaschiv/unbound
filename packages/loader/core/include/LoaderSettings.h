#pragma once

#include <cstdint>
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
        void remove(const std::string &store, const std::string &key);
        bool apply(const nlohmann::json &changes);

        const std::string &path() const;

    private:
        struct FileStamp
        {
            bool     exists   = false;
            int64_t  modified = 0;
            uint64_t size     = 0;

            bool operator==(const FileStamp &other) const = default;
        };

        void      backupCorruptFile() const;
        FileStamp stampOnDisk() const;
        void      refreshLocked() const;
        void      setLocked(const std::string &store, const std::string &key, nlohmann::json value);
        void      removeLocked(const std::string &store, const std::string &key);

        std::string            path_;
        mutable nlohmann::json data_ = nlohmann::json::object();
        mutable FileStamp      stamp_;
        mutable bool           dirty_ = false;
        mutable std::mutex     mutex_;
    };
}
