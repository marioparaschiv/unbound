#include "LoaderFileWatcher.h"

#include <utility>

namespace loader {
std::string parentDirectory(const std::string &path)
{
    const size_t separator = path.find_last_of('/');
    if (separator == std::string::npos)
    {
        return "";
    }
    return separator == 0 ? "/" : path.substr(0, separator);
}

std::string lastPathComponent(const std::string &path)
{
    const size_t separator = path.find_last_of('/');
    return separator == std::string::npos ? path : path.substr(separator + 1);
}

FileWatcher::FileWatcher(std::shared_ptr<FileWatchBackend> backend, FileWatchScheduler schedule,
                         double debounceSeconds)
    : backend_(std::move(backend)), schedule_(std::move(schedule)),
      debounceSeconds_(debounceSeconds)
{
}

bool FileWatcher::watch(const std::string &path, FileWatchCallback onChange)
{
    std::lock_guard<std::mutex> lock(mutex_);
    if (monitors_.count(path))
    {
        return false;
    }
    Monitor &monitor = monitors_[path];
    monitor.onChange = std::move(onChange);

    const std::string directory = parentDirectory(path);
    auto [files, created]       = directories_.try_emplace(directory);
    if (created)
    {
        backend_->watchDirectory(directory);
    }
    files->second.insert(path);

    arm(path, monitor);
    return true;
}

void FileWatcher::unwatch(const std::string &path)
{
    std::lock_guard<std::mutex> lock(mutex_);
    const auto                  monitor = monitors_.find(path);
    if (monitor == monitors_.end())
    {
        return;
    }
    if (monitor->second.armed)
    {
        backend_->unwatchFile(path);
    }
    monitors_.erase(monitor);

    const std::string directory = parentDirectory(path);
    const auto        files     = directories_.find(directory);
    if (files == directories_.end())
    {
        return;
    }
    files->second.erase(path);
    if (files->second.empty())
    {
        backend_->unwatchDirectory(directory);
        directories_.erase(files);
    }
}

bool FileWatcher::isWatching(const std::string &path) const
{
    std::lock_guard<std::mutex> lock(mutex_);
    return monitors_.count(path) != 0;
}

void FileWatcher::fileChanged(const std::string &path, FileWatchEvent event)
{
    std::vector<Pending> pending;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        const auto                  monitor = monitors_.find(path);
        if (monitor == monitors_.end())
        {
            return;
        }
        pending.push_back(stamp(path, monitor->second));
        if (event == FileWatchEvent::Removed && monitor->second.armed)
        {
            monitor->second.armed = false;
            backend_->unwatchFile(path);
        }
    }
    schedule(pending);
}

void FileWatcher::directoryChanged(const std::string                &directory,
                                   const std::optional<std::string> &name)
{
    std::vector<Pending> pending;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        const auto                  files = directories_.find(directory);
        if (files == directories_.end())
        {
            return;
        }
        for (const std::string &path : files->second)
        {
            if (name && lastPathComponent(path) != *name)
            {
                continue;
            }
            Monitor &monitor = monitors_[path];
            if (!monitor.armed)
            {
                arm(path, monitor);
            }
            pending.push_back(stamp(path, monitor));
        }
    }
    schedule(pending);
}

void FileWatcher::arm(const std::string &path, Monitor &monitor)
{
    monitor.armed = backend_->watchFile(path);
}

FileWatcher::Pending FileWatcher::stamp(const std::string &path, Monitor &monitor)
{
    monitor.generation = ++nextGeneration_;
    return {path, monitor.generation};
}

void FileWatcher::schedule(const std::vector<Pending> &pending)
{
    const std::weak_ptr<FileWatcher> weak = weak_from_this();
    for (const Pending &entry : pending)
    {
        schedule_(debounceSeconds_, [weak, entry] {
            if (auto watcher = weak.lock())
            {
                watcher->notify(entry.path, entry.generation);
            }
        });
    }
}

void FileWatcher::notify(const std::string &path, uint64_t generation)
{
    FileWatchCallback onChange;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        const auto                  monitor = monitors_.find(path);
        if (monitor == monitors_.end() || monitor->second.generation != generation)
        {
            return;
        }
        onChange = monitor->second.onChange;
    }
    if (onChange)
    {
        onChange();
    }
}
}
