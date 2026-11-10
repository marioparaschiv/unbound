#pragma once

#include <chrono>
#include <cstdint>
#include <functional>
#include <map>
#include <mutex>
#include <nlohmann/json.hpp>
#include <optional>
#include <string>
#include <vector>

#include "LoaderSettingsCache.h"

namespace loader {
// settings.json, by store. Loading only splits the file into stores, taking them from the binary
// cache beside it when that matches the file; a store is decoded the first time it is read or
// written, and saving writes stores never decoded back as their original text.
class SettingsStore
{
public:
    explicit SettingsStore(std::string               path,
                           std::chrono::milliseconds diskRecheck = std::chrono::milliseconds(500));

    void load();
    // Loads again only when the file changed on disk or unsaved changes would be discarded.
    void reload();
    bool save() const;
    // Rebuilds the binary cache when loading found it missing or stale. Slow; call it off the
    // main thread.
    void refreshCache();

    std::string    serialize() const;
    nlohmann::json snapshot() const;
    bool           replace(const std::string &json);

    std::optional<nlohmann::json> get(const std::string &store, const std::string &key) const;
    // Passes the value to `reader` in place, without copying it; false when there is none.
    bool        read(const std::string &store, const std::string &key,
                     const std::function<void(const nlohmann::json &)> &reader) const;
    bool        getBoolean(const std::string &store, const std::string &key, bool fallback) const;
    std::string getString(const std::string &store, const std::string &key,
                          const std::string &fallback) const;
    void        set(const std::string &store, const std::string &key, nlohmann::json value);
    void        remove(const std::string &store, const std::string &key);
    bool        apply(const nlohmann::json &changes);
    bool        stage(const nlohmann::json &changes);
    bool        flush();

    const std::string &path() const;

private:
    static constexpr size_t kCorruptBackupsKept = 3;

    struct FileStamp {
        bool     exists   = false;
        int64_t  modified = 0;
        uint64_t size     = 0;

        bool operator==(const FileStamp &other) const = default;
    };

    // A store not decoded yet: its JSON text, and its MessagePack when the cache had it.
    struct RawStore {
        std::string json;
        std::string packed;
    };

    void                  backupCorruptFile() const;
    void                  pruneCorruptBackups() const;
    std::string           lastGoodPath() const;
    void                  keepLastGoodLocked(const std::string &contents) const;
    bool                  restoreLastGoodLocked() const;
    std::string           cachePath() const;
    FileStamp             stampOnDisk() const;
    void                  refreshLocked(bool beforeWrite = false) const;
    bool                  adoptLocked(const std::string &contents) const;
    void                  resetLocked() const;
    void                  parseStoreLocked(const std::string &store) const;
    void                  parseAllLocked() const;
    std::string           dumpLocked(std::vector<CachedStore> &layout) const;
    const nlohmann::json *findLocked(const std::string &store, const std::string &key) const;
    void setLocked(const std::string &store, const std::string &key, nlohmann::json value);
    void removeLocked(const std::string &store, const std::string &key);
    void applyLocked(const nlohmann::json &changes);

    std::string            path_;
    mutable nlohmann::json data_ = nlohmann::json::object();
    // Stores not decoded yet; a store is in `data_` or here, never both.
    mutable std::map<std::string, RawStore> raw_;
    mutable FileStamp                       stamp_;
    // Hash of settings.json as last read or written, and whether the cache beside it is behind.
    mutable uint64_t                              jsonHash_   = 0;
    mutable bool                                  cacheStale_ = true;
    mutable bool                                  dirty_      = false;
    mutable std::mutex                            mutex_;
    std::chrono::milliseconds                     diskRecheck_;
    mutable std::chrono::steady_clock::time_point checkedAt_{};
};
}
