#include "NativeRuntimeResources.h"

namespace loader::native {
namespace jsi = facebook::jsi;

static constexpr jsi::UUID kRuntimeResourcesId(0x64e8b209, 0x6e91, 0x4c70, 0x913a, 0x72d489a45c21);

RuntimeResourceRegistry::~RuntimeResourceRegistry()
{
    clear();
}

bool RuntimeResourceRegistry::retain(const std::string &key, std::shared_ptr<void> resource)
{
    if (!resource)
    {
        return false;
    }
    std::lock_guard<std::mutex> lock(mutex_);
    return resources_.emplace(key, std::move(resource)).second;
}

bool RuntimeResourceRegistry::release(const std::string &key)
{
    std::shared_ptr<void>              released;
    std::vector<std::shared_ptr<void>> deferred;
    {
        std::lock_guard<std::mutex> lock(mutex_);
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

bool RuntimeResourceRegistry::deferRelease(const std::string &key)
{
    std::lock_guard<std::mutex> lock(mutex_);
    auto                        found = resources_.find(key);
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
    std::vector<std::shared_ptr<void>> released;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        released.swap(deferredReleases_);
    }
    return released.size();
}

void RuntimeResourceRegistry::clear()
{
    std::unordered_map<std::string, std::shared_ptr<void>> released;
    std::vector<std::shared_ptr<void>>                     deferred;
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
        return std::static_pointer_cast<RuntimeResourceRegistry>(existing);
    }
    auto created = std::make_shared<RuntimeResourceRegistry>();
    runtime.setRuntimeData(kRuntimeResourcesId, created);
    return created;
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
    return existing && std::static_pointer_cast<RuntimeResourceRegistry>(existing)->release(key);
}

bool deferRuntimeResourceRelease(const std::weak_ptr<RuntimeResourceRegistry> &registry,
                                 const std::string                            &key)
{
    auto resources = registry.lock();
    return resources && resources->deferRelease(key);
}

size_t drainRuntimeResourceReleases(jsi::Runtime &runtime)
{
    auto existing = runtime.getRuntimeData(kRuntimeResourcesId);
    return existing ? std::static_pointer_cast<RuntimeResourceRegistry>(existing)
                          ->drainDeferredReleases()
                    : 0;
}

std::shared_ptr<void> runtimeResource(jsi::Runtime &runtime, const std::string &key)
{
    auto existing = runtime.getRuntimeData(kRuntimeResourcesId);
    return existing ? std::static_pointer_cast<RuntimeResourceRegistry>(existing)->find(key)
                    : nullptr;
}
}
