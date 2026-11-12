#pragma once

#include <memory>
#include <mutex>
#include <optional>
#include <string>

#include "NativeFabric.h"

namespace loader::native {
class FabricSurface final : public facebook::jsi::HostObject
{
public:
    explicit FabricSurface(std::shared_ptr<FabricAdapter> adapter) : adapter_(std::move(adapter)) {}

    void activate(std::string id, uint64_t generation, std::string reuseKey)
    {
        std::lock_guard<std::mutex> lock(mutex_);
        id_         = std::move(id);
        generation_ = generation;
        reuseKey_   = std::move(reuseKey);
        active_     = true;
    }

    std::string reuseKey() const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return reuseKey_;
    }

    bool deactivate()
    {
        std::lock_guard<std::mutex> lock(mutex_);
        bool                        wasActive = active_;
        active_                               = false;
        lastSetFrame_.reset();
        return wasActive;
    }

    void rememberSetFrame(const NativeFrame &frame)
    {
        std::lock_guard<std::mutex> lock(mutex_);
        lastSetFrame_ = frame;
    }

    void forgetSetFrame()
    {
        std::lock_guard<std::mutex> lock(mutex_);
        lastSetFrame_.reset();
    }

    std::optional<NativeFrame> knownFrame() const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return active_ ? lastSetFrame_ : std::nullopt;
    }

    bool active() const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return active_;
    }

    std::string id() const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return id_;
    }

    uint64_t generation() const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return generation_;
    }

    FabricAdapter &adapter() const
    {
        return *adapter_;
    }

private:
    std::shared_ptr<FabricAdapter> adapter_;
    mutable std::mutex             mutex_;
    std::string                    id_;
    std::string                    reuseKey_;
    uint64_t                       generation_ = 0;
    bool                           active_     = false;
    std::optional<NativeFrame>     lastSetFrame_;
};

using SurfacePointer = std::shared_ptr<FabricSurface>;
}
