#pragma once

#include <jsi/jsi.h>
#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>

namespace loader::native {
class RuntimeResourceRegistry
{
public:
    ~RuntimeResourceRegistry();

    bool                  retain(const std::string &key, std::shared_ptr<void> resource);
    bool                  release(const std::string &key);
    bool                  deferRelease(const std::string &key);
    std::shared_ptr<void> find(const std::string &key) const;
    size_t                size() const;
    size_t                drainDeferredReleases();
    void                  clear();

private:
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
size_t drainRuntimeResourceReleases(facebook::jsi::Runtime &runtime);
std::shared_ptr<void> runtimeResource(facebook::jsi::Runtime &runtime, const std::string &key);
}
