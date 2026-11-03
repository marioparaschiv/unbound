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

#include "NativeOperationGate.h"

namespace loader::native {
class RuntimeResourceRegistry;
class RuntimeResourceOperationScope;

class RuntimeResourceOperation
{
public:
    ~RuntimeResourceOperation();

    bool start(uint64_t identity);
    bool cancel();
    void finish();
    bool active() const;

private:
    friend class RuntimeResourceRegistry;
    friend class RuntimeResourceOperationScope;

    RuntimeResourceOperation(std::weak_ptr<RuntimeResourceRegistry> registry, uint64_t identity,
                             uint64_t identifier);
    void expireFromRuntime();
    void forgetFromScope();

    std::weak_ptr<RuntimeResourceRegistry>       registry_;
    std::weak_ptr<RuntimeResourceOperationScope> scope_;
    std::mutex                                   scopeMutex_;
    uint64_t                                     identity_;
    uint64_t                                     identifier_;
    loader::NativeOperationGate                  gate_;
};

class RuntimeResourceOperationScope
    : public std::enable_shared_from_this<RuntimeResourceOperationScope>
{
public:
    ~RuntimeResourceOperationScope();

    bool   active() const;
    bool   track(const std::shared_ptr<RuntimeResourceOperation> &operation);
    size_t pendingOperationCount() const;
    void   cancelPending();

private:
    friend class RuntimeResourceOperation;

    void forget(const RuntimeResourceOperation *operation);

    std::atomic_bool                                     active_{true};
    mutable std::mutex                                   mutex_;
    std::vector<std::weak_ptr<RuntimeResourceOperation>> operations_;
};

class RuntimeResourceRegistry : public std::enable_shared_from_this<RuntimeResourceRegistry>
{
public:
    RuntimeResourceRegistry();
    ~RuntimeResourceRegistry();

    uint64_t                                  identity() const;
    bool                                      active() const;
    bool                                      onOwnerThread() const;
    std::unique_lock<std::recursive_mutex>    lockRuntime() const;
    void                                      invalidate();
    std::shared_ptr<RuntimeResourceOperation> beginOperation(uint64_t identity);
    size_t                                    pendingOperationCount() const;
    bool                  retain(const std::string &key, std::shared_ptr<void> resource);
    bool                  release(const std::string &key);
    bool                  releaseOnOwnerThread(const std::string &key);
    bool                  deferRelease(const std::string &key);
    std::shared_ptr<void> find(const std::string &key) const;
    size_t                size() const;
    size_t                drainDeferredReleases();
    void                  clear();

private:
    friend class RuntimeResourceOperation;

    void finishOperation(uint64_t identifier);

    uint64_t                                                              identity_;
    std::thread::id                                                       ownerThread_;
    std::atomic_bool                                                      active_{true};
    mutable std::recursive_mutex                                          runtimeMutex_;
    mutable std::mutex                                                    mutex_;
    uint64_t                                                              nextOperationId_ = 1;
    std::unordered_map<uint64_t, std::weak_ptr<RuntimeResourceOperation>> pendingOperations_;
    std::unordered_map<std::string, std::shared_ptr<void>>                resources_;
    std::vector<std::shared_ptr<void>>                                    deferredReleases_;
};

std::shared_ptr<RuntimeResourceRegistry> runtimeResourceRegistry(facebook::jsi::Runtime &runtime);
void retainRuntimeResource(facebook::jsi::Runtime &runtime, const std::string &key,
                           std::shared_ptr<void> resource);
bool releaseRuntimeResource(facebook::jsi::Runtime &runtime, const std::string &key);
bool deferRuntimeResourceRelease(const std::weak_ptr<RuntimeResourceRegistry> &registry,
                                 const std::string                            &key);
bool releaseRuntimeResource(const std::weak_ptr<RuntimeResourceRegistry> &registry,
                            const std::string                            &key);
bool releaseRuntimeResourceOnOwnerThread(const std::weak_ptr<RuntimeResourceRegistry> &registry,
                                         const std::string                            &key);
bool invalidateRuntimeResources(const std::weak_ptr<RuntimeResourceRegistry> &registry);
std::shared_ptr<RuntimeResourceOperation>
beginRuntimeResourceOperation(const std::weak_ptr<RuntimeResourceRegistry> &registry,
                              uint64_t                                      identity);
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

template <typename Callback>
bool withRuntimeResource(const std::weak_ptr<RuntimeResourceRegistry> &registry, uint64_t identity,
                         const std::shared_ptr<RuntimeResourceOperation> &operation,
                         Callback                                       &&callback)
{
    if (!operation || !operation->start(identity))
    {
        if (operation)
        {
            operation->finish();
        }
        return false;
    }
    struct OperationCompletion {
        std::shared_ptr<RuntimeResourceOperation> operation;
        ~OperationCompletion()
        {
            operation->finish();
        }
    } completion{operation};
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
