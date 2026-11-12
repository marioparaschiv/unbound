#pragma once

#include <atomic>
#include <cstdint>
#include <string_view>

#include "NativePluginRuntime.h"

namespace loader::native {
enum class MainWorkKind : uint32_t
{
    Synchronous,
    Posted,
    Asynchronous,
};

struct MainWaitRecord {
    std::atomic_uint64_t key{0};
    std::atomic_bool     ready{false};
    AddonSlot            addon                      = kNoAddon;
    uint32_t             kind                       = 0;
    char                 label[kMainWaitLabelLimit] = {};
    std::atomic_uint64_t posted{0};
    std::atomic_uint64_t started{0};
    std::atomic_uint64_t finished{0};
    std::atomic_uint64_t expired{0};
    std::atomic_uint64_t queuedNanos{0};
    std::atomic_uint64_t maxQueuedNanos{0};
    std::atomic_uint64_t runNanos{0};
    std::atomic_uint64_t maxRunNanos{0};
};

uint64_t        monotonicNanos();
void            raiseTo(std::atomic_uint64_t &maximum, uint64_t value);
MainWaitRecord &mainWaitRecord(AddonSlot addon, MainWorkKind kind, std::string_view label);
MainWaitRecord &currentCallRecord(AddonSlot addon, MainWorkKind kind);

class MainWaitTiming
{
public:
    explicit MainWaitTiming(MainWaitRecord &record) : record_(&record), postedAt_(monotonicNanos())
    {
        record_->posted.fetch_add(1, std::memory_order_relaxed);
    }

    uint64_t started() const
    {
        uint64_t now    = monotonicNanos();
        uint64_t queued = now > postedAt_ ? now - postedAt_ : 0;
        record_->started.fetch_add(1, std::memory_order_relaxed);
        record_->queuedNanos.fetch_add(queued, std::memory_order_relaxed);
        raiseTo(record_->maxQueuedNanos, queued);
        return now;
    }

    void finished(uint64_t startedAt) const
    {
        uint64_t now = monotonicNanos();
        uint64_t ran = now > startedAt ? now - startedAt : 0;
        record_->finished.fetch_add(1, std::memory_order_relaxed);
        record_->runNanos.fetch_add(ran, std::memory_order_relaxed);
        raiseTo(record_->maxRunNanos, ran);
    }

    void expired() const
    {
        record_->expired.fetch_add(1, std::memory_order_relaxed);
    }

private:
    MainWaitRecord *record_;
    uint64_t        postedAt_;
};
}
