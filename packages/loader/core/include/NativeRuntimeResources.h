#pragma once

#include <atomic>
#include <cstdint>
#include <jsi/jsi.h>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <unordered_map>
#include <utility>
#include <vector>

namespace loader::native {
class RuntimeResourceRegistry
{
public:
    RuntimeResourceRegistry();
    ~RuntimeResourceRegistry();

    uint64_t                               identity() const;
    bool                                   active() const;
    bool                                   onOwnerThread() const;
    std::unique_lock<std::recursive_mutex> lockRuntime() const;
    void                                   invalidate();
    bool                  retain(const std::string &key, std::shared_ptr<void> resource);
    bool                  release(const std::string &key);
    bool                  releaseOnOwnerThread(const std::string &key);
    bool                  deferRelease(const std::string &key);
    std::shared_ptr<void> find(const std::string &key) const;
    size_t                size() const;
    size_t                drainDeferredReleases();
    void                  clear();

private:
    uint64_t                                               identity_;
    std::thread::id                                        ownerThread_;
    std::atomic_bool                                       active_{true};
    mutable std::recursive_mutex                           runtimeMutex_;
    mutable std::mutex                                     mutex_;
    std::unordered_map<std::string, std::shared_ptr<void>> resources_;
    std::vector<std::shared_ptr<void>>                     deferredReleases_;
};

std::shared_ptr<RuntimeResourceRegistry> runtimeResourceRegistry(facebook::jsi::Runtime &runtime);
void   retainRuntimeResource(facebook::jsi::Runtime &runtime, const std::string &key,
                             std::shared_ptr<void> resource);
bool   releaseRuntimeResource(facebook::jsi::Runtime &runtime, const std::string &key);
bool   deferRuntimeResourceRelease(const std::weak_ptr<RuntimeResourceRegistry> &registry,
                                   const std::string                            &key);
bool   releaseRuntimeResource(const std::weak_ptr<RuntimeResourceRegistry> &registry,
                              const std::string                            &key);
bool   releaseRuntimeResourceOnOwnerThread(const std::weak_ptr<RuntimeResourceRegistry> &registry,
                                           const std::string                            &key);
bool   invalidateRuntimeResources(const std::weak_ptr<RuntimeResourceRegistry> &registry);
size_t drainRuntimeResourceReleases(facebook::jsi::Runtime &runtime);
size_t drainRuntimeResourceReleases(const std::weak_ptr<RuntimeResourceRegistry> &registry);
std::shared_ptr<void> runtimeResource(facebook::jsi::Runtime &runtime, const std::string &key);

template <typename Callback>
bool withRuntimeResource(const std::weak_ptr<RuntimeResourceRegistry> &registry, uint64_t identity,
                         Callback &&callback)
{
    auto resources = registry.lock();
    if (!resources)
    {
        return false;
    }
    auto runtimeLock = resources->lockRuntime();
    if (!resources->active() || !resources->onOwnerThread() || resources->identity() != identity)
    {
        return false;
    }
    std::forward<Callback>(callback)(*resources);
    return true;
}
}
