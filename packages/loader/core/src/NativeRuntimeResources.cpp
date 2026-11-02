#include "NativeRuntimeResources.h"

#include <algorithm>
#include <atomic>
#include <iterator>

namespace loader::native {
namespace jsi = facebook::jsi;

static constexpr jsi::UUID  kRuntimeResourcesId(0x64e8b209, 0x6e91, 0x4c70, 0x913a, 0x72d489a45c21);
static std::atomic_uint64_t gNextRuntimeResourceIdentity{1};

static std::mutex &runtimeResourceQuarantineMutex()
{
    static auto *mutex = new std::mutex();
    return *mutex;
}

static std::vector<std::shared_ptr<void>> &runtimeResourceQuarantine()
{
    static auto *resources = new std::vector<std::shared_ptr<void>>();
    return *resources;
}

struct RuntimeResourceRuntimeData {
    std::shared_ptr<RuntimeResourceRegistry> resources =
        std::make_shared<RuntimeResourceRegistry>();

    ~RuntimeResourceRuntimeData()
    {
        resources->invalidate();
        resources->clear();
    }
};

RuntimeResourceRegistry::RuntimeResourceRegistry()
    : identity_(gNextRuntimeResourceIdentity.fetch_add(1, std::memory_order_relaxed)),
      ownerThread_(std::this_thread::get_id())
{
}

RuntimeResourceRegistry::~RuntimeResourceRegistry()
{
    invalidate();
    clear();
}

RuntimeResourceOperation::RuntimeResourceOperation(std::weak_ptr<RuntimeResourceRegistry> registry,
                                                   uint64_t identity, uint64_t identifier)
    : registry_(std::move(registry)), identity_(identity), identifier_(identifier)
{
}

RuntimeResourceOperation::~RuntimeResourceOperation()
{
    finish();
}

bool RuntimeResourceOperation::start(uint64_t identity)
{
    if (identity != identity_)
    {
        return false;
    }
    auto registry = registry_.lock();
    return registry && registry->active() && registry->identity() == identity_ && gate_.start();
}

bool RuntimeResourceOperation::cancel()
{
    bool expired = gate_.expire();
    if (expired)
    {
        if (auto registry = registry_.lock())
        {
            registry->finishOperation(identifier_);
        }
        forgetFromScope();
    }
    return expired;
}

void RuntimeResourceOperation::finish()
{
    NativeOperationPhase phase = gate_.phase();
    if (phase == NativeOperationPhase::queued)
    {
        gate_.expire();
    }
    else if (phase == NativeOperationPhase::running)
    {
        gate_.finish();
    }
    if (auto registry = registry_.lock())
    {
        registry->finishOperation(identifier_);
    }
    forgetFromScope();
}

bool RuntimeResourceOperation::active() const
{
    NativeOperationPhase phase = gate_.phase();
    if (phase != NativeOperationPhase::queued && phase != NativeOperationPhase::running)
    {
        return false;
    }
    auto registry = registry_.lock();
    return registry && registry->active() && registry->identity() == identity_;
}

void RuntimeResourceOperation::expireFromRuntime()
{
    gate_.expire();
    forgetFromScope();
}

void RuntimeResourceOperation::forgetFromScope()
{
    std::shared_ptr<RuntimeResourceOperationScope> scope;
    {
        std::lock_guard<std::mutex> lock(scopeMutex_);
        scope = scope_.lock();
    }
    if (scope)
    {
        scope->forget(this);
    }
}

RuntimeResourceOperationScope::~RuntimeResourceOperationScope()
{
    cancelPending();
}

bool RuntimeResourceOperationScope::active() const
{
    return active_.load(std::memory_order_acquire);
}

bool RuntimeResourceOperationScope::track(
    const std::shared_ptr<RuntimeResourceOperation> &operation)
{
    std::weak_ptr<RuntimeResourceOperationScope> scope = weak_from_this();
    if (!operation || scope.expired())
    {
        return false;
    }
    std::lock_guard<std::mutex> lock(mutex_);
    if (!active())
    {
        return false;
    }
    {
        std::lock_guard<std::mutex> operationLock(operation->scopeMutex_);
        operation->scope_ = scope;
    }
    operations_.erase(std::remove_if(operations_.begin(), operations_.end(),
                                     [](const auto &entry) {
                                         auto current = entry.lock();
                                         return !current || !current->active();
                                     }),
                      operations_.end());
    operations_.push_back(operation);
    return true;
}

size_t RuntimeResourceOperationScope::pendingOperationCount() const
{
    std::lock_guard<std::mutex> lock(mutex_);
    return operations_.size();
}

void RuntimeResourceOperationScope::forget(const RuntimeResourceOperation *operation)
{
    std::lock_guard<std::mutex> lock(mutex_);
    operations_.erase(std::remove_if(operations_.begin(), operations_.end(),
                                     [operation](const auto &entry) {
                                         auto current = entry.lock();
                                         return !current || current.get() == operation;
                                     }),
                      operations_.end());
}

void RuntimeResourceOperationScope::cancelPending()
{
    active_.store(false, std::memory_order_release);
    std::vector<std::shared_ptr<RuntimeResourceOperation>> pending;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        for (const auto &entry : operations_)
        {
            if (auto operation = entry.lock())
            {
                pending.push_back(std::move(operation));
            }
        }
        operations_.clear();
    }
    for (const auto &operation : pending)
    {
        operation->cancel();
    }
}

uint64_t RuntimeResourceRegistry::identity() const
{
    return identity_;
}

bool RuntimeResourceRegistry::active() const
{
    return active_.load(std::memory_order_acquire);
}

bool RuntimeResourceRegistry::onOwnerThread() const
{
    return std::this_thread::get_id() == ownerThread_;
}

std::unique_lock<std::recursive_mutex> RuntimeResourceRegistry::lockRuntime() const
{
    return std::unique_lock<std::recursive_mutex>(runtimeMutex_);
}

void RuntimeResourceRegistry::invalidate()
{
    auto                                                   runtimeLock = lockRuntime();
    std::vector<std::shared_ptr<RuntimeResourceOperation>> pending;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        active_.store(false, std::memory_order_release);
        for (const auto &entry : pendingOperations_)
        {
            if (auto pendingOperation = entry.second.lock())
            {
                pendingOperation->expireFromRuntime();
                pending.push_back(std::move(pendingOperation));
            }
        }
        pendingOperations_.clear();
    }
}

std::shared_ptr<RuntimeResourceOperation> RuntimeResourceRegistry::beginOperation(uint64_t identity)
{
    std::lock_guard<std::mutex> lock(mutex_);
    if (!active() || identity != identity_)
    {
        return nullptr;
    }
    auto registry = weak_from_this();
    if (registry.expired())
    {
        return nullptr;
    }
    uint64_t identifier = nextOperationId_++;
    auto     operation  = std::shared_ptr<RuntimeResourceOperation>(
        new RuntimeResourceOperation(registry, identity_, identifier));
    pendingOperations_.emplace(identifier, operation);
    return operation;
}

size_t RuntimeResourceRegistry::pendingOperationCount() const
{
    std::lock_guard<std::mutex> lock(mutex_);
    return pendingOperations_.size();
}

void RuntimeResourceRegistry::finishOperation(uint64_t identifier)
{
    std::lock_guard<std::mutex> lock(mutex_);
    pendingOperations_.erase(identifier);
}

bool RuntimeResourceRegistry::retain(const std::string &key, std::shared_ptr<void> resource)
{
    if (!resource)
    {
        return false;
    }
    auto                        runtimeLock = lockRuntime();
    std::lock_guard<std::mutex> lock(mutex_);
    if (!active())
    {
        return false;
    }
    return resources_.emplace(key, std::move(resource)).second;
}

bool RuntimeResourceRegistry::release(const std::string &key)
{
    if (!onOwnerThread())
    {
        return false;
    }
    auto                               runtimeLock = lockRuntime();
    std::shared_ptr<void>              released;
    std::vector<std::shared_ptr<void>> deferred;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!active())
        {
            return false;
        }
        deferred.swap(deferredReleases_);
        auto found = resources_.find(key);
        if (found == resources_.end())
        {
            return false;
        }
        released = std::move(found->second);
        resources_.erase(found);
    }
    return true;
}

bool RuntimeResourceRegistry::releaseOnOwnerThread(const std::string &key)
{
    return onOwnerThread() && release(key);
}

bool RuntimeResourceRegistry::deferRelease(const std::string &key)
{
    std::lock_guard<std::mutex> lock(mutex_);
    if (!active())
    {
        return false;
    }
    auto found = resources_.find(key);
    if (found == resources_.end())
    {
        return false;
    }
    deferredReleases_.push_back(std::move(found->second));
    resources_.erase(found);
    return true;
}

std::shared_ptr<void> RuntimeResourceRegistry::find(const std::string &key) const
{
    std::lock_guard<std::mutex> lock(mutex_);
    auto                        found = resources_.find(key);
    return found == resources_.end() ? nullptr : found->second;
}

size_t RuntimeResourceRegistry::size() const
{
    std::lock_guard<std::mutex> lock(mutex_);
    return resources_.size();
}

size_t RuntimeResourceRegistry::drainDeferredReleases()
{
    if (!onOwnerThread())
    {
        return 0;
    }
    auto                               runtimeLock = lockRuntime();
    std::vector<std::shared_ptr<void>> released;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        released.swap(deferredReleases_);
    }
    return released.size();
}

void RuntimeResourceRegistry::clear()
{
    auto                                                   runtimeLock = lockRuntime();
    std::unordered_map<std::string, std::shared_ptr<void>> released;
    std::vector<std::shared_ptr<void>>                     deferred;
    if (!onOwnerThread())
    {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            released.swap(resources_);
            deferred.swap(deferredReleases_);
        }
        std::lock_guard<std::mutex> lock(runtimeResourceQuarantineMutex());
        auto                       &quarantine = runtimeResourceQuarantine();
        for (auto &[key, resource] : released)
        {
            quarantine.push_back(std::move(resource));
        }
        quarantine.insert(quarantine.end(), std::make_move_iterator(deferred.begin()),
                          std::make_move_iterator(deferred.end()));
        return;
    }
    {
        std::lock_guard<std::mutex> lock(mutex_);
        released.swap(resources_);
        deferred.swap(deferredReleases_);
    }
}

std::shared_ptr<RuntimeResourceRegistry> runtimeResourceRegistry(jsi::Runtime &runtime)
{
    std::shared_ptr<void> existing = runtime.getRuntimeData(kRuntimeResourcesId);
    if (existing)
    {
        return std::static_pointer_cast<RuntimeResourceRuntimeData>(existing)->resources;
    }
    auto created = std::make_shared<RuntimeResourceRuntimeData>();
    runtime.setRuntimeData(kRuntimeResourcesId, created);
    return created->resources;
}

void retainRuntimeResource(jsi::Runtime &runtime, const std::string &key,
                           std::shared_ptr<void> resource)
{
    auto resources = runtimeResourceRegistry(runtime);
    resources->drainDeferredReleases();
    if (!resources->retain(key, std::move(resource)))
    {
        throw std::invalid_argument("The runtime resource key is already retained");
    }
}

bool releaseRuntimeResource(jsi::Runtime &runtime, const std::string &key)
{
    auto existing = runtime.getRuntimeData(kRuntimeResourcesId);
    return existing &&
           std::static_pointer_cast<RuntimeResourceRuntimeData>(existing)->resources->release(key);
}

bool deferRuntimeResourceRelease(const std::weak_ptr<RuntimeResourceRegistry> &registry,
                                 const std::string                            &key)
{
    auto resources = registry.lock();
    return resources && resources->deferRelease(key);
}

bool releaseRuntimeResource(const std::weak_ptr<RuntimeResourceRegistry> &registry,
                            const std::string                            &key)
{
    auto resources = registry.lock();
    return resources && resources->release(key);
}

bool releaseRuntimeResourceOnOwnerThread(const std::weak_ptr<RuntimeResourceRegistry> &registry,
                                         const std::string                            &key)
{
    auto resources = registry.lock();
    return resources && resources->releaseOnOwnerThread(key);
}

bool invalidateRuntimeResources(const std::weak_ptr<RuntimeResourceRegistry> &registry)
{
    auto resources = registry.lock();
    if (!resources || !resources->active())
    {
        return false;
    }
    resources->invalidate();
    return true;
}

std::shared_ptr<RuntimeResourceOperation>
beginRuntimeResourceOperation(const std::weak_ptr<RuntimeResourceRegistry> &registry,
                              uint64_t                                      identity)
{
    auto resources = registry.lock();
    return resources ? resources->beginOperation(identity) : nullptr;
}

size_t drainRuntimeResourceReleases(jsi::Runtime &runtime)
{
    auto existing = runtime.getRuntimeData(kRuntimeResourcesId);
    return existing ? std::static_pointer_cast<RuntimeResourceRuntimeData>(existing)
                          ->resources->drainDeferredReleases()
                    : 0;
}

size_t drainRuntimeResourceReleases(const std::weak_ptr<RuntimeResourceRegistry> &registry)
{
    auto resources = registry.lock();
    return resources ? resources->drainDeferredReleases() : 0;
}

std::shared_ptr<void> runtimeResource(jsi::Runtime &runtime, const std::string &key)
{
    auto existing = runtime.getRuntimeData(kRuntimeResourcesId);
    return existing
               ? std::static_pointer_cast<RuntimeResourceRuntimeData>(existing)->resources->find(
                     key)
               : nullptr;
}
}
