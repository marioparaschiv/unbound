#pragma once

#include <cstdint>
#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <optional>
#include <set>
#include <string>
#include <vector>

namespace loader {
constexpr double kDispatchSourceDebounceSeconds = 0.25;
constexpr double kFileObserverDebounceSeconds   = 0.3;

enum class FileWatchEvent
{
    Changed,
    Removed,
};

class FileWatchBackend
{
public:
    virtual ~FileWatchBackend() = default;

    virtual bool watchFile(const std::string &path)        = 0;
    virtual void unwatchFile(const std::string &path)      = 0;
    virtual bool watchDirectory(const std::string &path)   = 0;
    virtual void unwatchDirectory(const std::string &path) = 0;
};

using FileWatchScheduler = std::function<void(double seconds, std::function<void()> work)>;
using FileWatchCallback  = std::function<void()>;

std::string parentDirectory(const std::string &path);
std::string lastPathComponent(const std::string &path);

class FileWatcher : public std::enable_shared_from_this<FileWatcher>
{
public:
    FileWatcher(std::shared_ptr<FileWatchBackend> backend, FileWatchScheduler schedule,
                double debounceSeconds);

    bool watch(const std::string &path, FileWatchCallback onChange);
    void unwatch(const std::string &path);
    bool isWatching(const std::string &path) const;

    void fileChanged(const std::string &path, FileWatchEvent event);
    void directoryChanged(const std::string                &directory,
                          const std::optional<std::string> &name = std::nullopt);

private:
    struct Monitor {
        FileWatchCallback onChange;
        bool              armed      = false;
        uint64_t          generation = 0;
    };

    struct Pending {
        std::string path;
        uint64_t    generation = 0;
    };

    void    arm(const std::string &path, Monitor &monitor);
    Pending stamp(const std::string &path, Monitor &monitor);
    void    schedule(const std::vector<Pending> &pending);
    void    notify(const std::string &path, uint64_t generation);

    std::shared_ptr<FileWatchBackend>            backend_;
    FileWatchScheduler                           schedule_;
    double                                       debounceSeconds_;
    std::map<std::string, Monitor>               monitors_;
    std::map<std::string, std::set<std::string>> directories_;
    uint64_t                                     nextGeneration_ = 0;
    mutable std::mutex                           mutex_;
};
}
