#include "NativeMainWaits.h"

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstdint>
#include <cstring>
#include <string_view>

#include "LoaderThreadWarnings.h"
#include "NativeCallActivity.h"

namespace loader::native {
static const char *mainWorkKindName(uint32_t kind)
{
    switch (static_cast<MainWorkKind>(kind))
    {
        case MainWorkKind::Synchronous:
            return "sync";
        case MainWorkKind::Posted:
            return "posted";
        case MainWorkKind::Asynchronous:
            return "async";
    }
    return "unknown";
}

static MainWaitRecord gMainWaits[kMainWaitRecordLimit];
static MainWaitRecord gOverflowMainWaits;

static std::atomic_uint64_t gMainDrains{0};
static std::atomic_uint64_t gMainDrainedItems{0};
static std::atomic_uint64_t gMainDrainNanos{0};
static std::atomic_uint64_t gMaxMainDrainNanos{0};
static std::atomic_uint64_t gMaxMainDrainItems{0};

uint64_t monotonicNanos()
{
    return static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::nanoseconds>(
                                     std::chrono::steady_clock::now().time_since_epoch())
                                     .count());
}

void raiseTo(std::atomic_uint64_t &maximum, uint64_t value)
{
    uint64_t current = maximum.load(std::memory_order_relaxed);
    while (value > current &&
           !maximum.compare_exchange_weak(current, value, std::memory_order_relaxed))
    {
    }
}

static uint64_t mainWaitKey(AddonSlot addon, MainWorkKind kind, std::string_view label)
{
    uint64_t hash = 14695981039346656037ull;
    auto     mix  = [&hash](uint64_t value) {
        hash ^= value;
        hash *= 1099511628211ull;
    };
    mix(addon);
    mix(static_cast<uint64_t>(kind));
    for (char character : label)
    {
        mix(static_cast<unsigned char>(character));
    }
    return hash == 0 ? 1 : hash;
}

static std::string_view boundedLabel(std::string_view label)
{
    return label.substr(0, kMainWaitLabelLimit - 1);
}

MainWaitRecord &mainWaitRecord(AddonSlot addon, MainWorkKind kind, std::string_view label)
{
    label        = boundedLabel(label);
    uint64_t key = mainWaitKey(addon, kind, label);
    for (size_t probe = 0; probe < kMainWaitRecordLimit; probe++)
    {
        MainWaitRecord &record   = gMainWaits[(key + probe) % kMainWaitRecordLimit];
        uint64_t        existing = record.key.load(std::memory_order_acquire);
        if (existing == key)
        {
            return record;
        }
        if (existing != 0)
        {
            continue;
        }
        if (record.key.compare_exchange_strong(existing, key, std::memory_order_acq_rel))
        {
            record.addon = addon;
            record.kind  = static_cast<uint32_t>(kind);
            std::memcpy(record.label, label.data(), label.size());
            record.label[label.size()] = '\0';
            record.ready.store(true, std::memory_order_release);
            return record;
        }
        if (existing == key)
        {
            return record;
        }
    }
    return gOverflowMainWaits;
}

struct CachedMainWaitRecord {
    MainWaitRecord *record   = nullptr;
    uint32_t        sequence = 0;
    AddonSlot       addon    = kNoAddon;
    MainWorkKind    kind     = MainWorkKind::Synchronous;
};

static thread_local CachedMainWaitRecord tCachedMainWait;

MainWaitRecord &currentCallRecord(AddonSlot addon, MainWorkKind kind)
{
    CurrentNativeCall     call   = currentNativeCall();
    CachedMainWaitRecord &cached = tCachedMainWait;
    if (cached.record && cached.sequence == call.sequence && cached.addon == addon &&
        cached.kind == kind)
    {
        return *cached.record;
    }
    MainWaitRecord &record = mainWaitRecord(addon, kind, call.label);
    cached                 = {&record, call.sequence, addon, kind};
    return record;
}

static double milliseconds(uint64_t nanos)
{
    return static_cast<double>(nanos) / 1e6;
}

static nlohmann::json describeMainWaits(const MainWaitRecord &record, const std::string &label,
                                        const std::string &addon, const char *kind)
{
    return {{"addon", addon},
            {"kind", kind},
            {"label", label},
            {"posted", record.posted.load(std::memory_order_relaxed)},
            {"started", record.started.load(std::memory_order_relaxed)},
            {"finished", record.finished.load(std::memory_order_relaxed)},
            {"expired", record.expired.load(std::memory_order_relaxed)},
            {"queuedMs", milliseconds(record.queuedNanos.load(std::memory_order_relaxed))},
            {"maxQueuedMs", milliseconds(record.maxQueuedNanos.load(std::memory_order_relaxed))},
            {"runMs", milliseconds(record.runNanos.load(std::memory_order_relaxed))},
            {"maxRunMs", milliseconds(record.maxRunNanos.load(std::memory_order_relaxed))}};
}

static void resetMainWaits(MainWaitRecord &record)
{
    record.posted.store(0, std::memory_order_relaxed);
    record.started.store(0, std::memory_order_relaxed);
    record.finished.store(0, std::memory_order_relaxed);
    record.expired.store(0, std::memory_order_relaxed);
    record.queuedNanos.store(0, std::memory_order_relaxed);
    record.maxQueuedNanos.store(0, std::memory_order_relaxed);
    record.runNanos.store(0, std::memory_order_relaxed);
    record.maxRunNanos.store(0, std::memory_order_relaxed);
}

void recordMainDrain(size_t items, std::chrono::nanoseconds duration)
{
    uint64_t nanos = duration.count() > 0 ? static_cast<uint64_t>(duration.count()) : 0;
    gMainDrains.fetch_add(1, std::memory_order_relaxed);
    gMainDrainedItems.fetch_add(items, std::memory_order_relaxed);
    gMainDrainNanos.fetch_add(nanos, std::memory_order_relaxed);
    raiseTo(gMaxMainDrainNanos, nanos);
    raiseTo(gMaxMainDrainItems, items);
}

nlohmann::json mainWorkCounts()
{
    return {{"drains", gMainDrains.load(std::memory_order_relaxed)},
            {"items", gMainDrainedItems.load(std::memory_order_relaxed)},
            {"drainMs", milliseconds(gMainDrainNanos.load(std::memory_order_relaxed))},
            {"maxDrainMs", milliseconds(gMaxMainDrainNanos.load(std::memory_order_relaxed))},
            {"maxDrainItems", gMaxMainDrainItems.load(std::memory_order_relaxed)}};
}

nlohmann::json mainWaitCounts()
{
    nlohmann::json waits = nlohmann::json::array();
    for (const MainWaitRecord &record : gMainWaits)
    {
        if (!record.ready.load(std::memory_order_acquire) ||
            record.posted.load(std::memory_order_relaxed) == 0)
        {
            continue;
        }
        waits.push_back(describeMainWaits(record, record.label, threading::addonName(record.addon),
                                          mainWorkKindName(record.kind)));
    }
    if (gOverflowMainWaits.posted.load(std::memory_order_relaxed) > 0)
    {
        waits.push_back(describeMainWaits(gOverflowMainWaits, "(other)", "(other)", "unknown"));
    }
    std::sort(waits.begin(), waits.end(),
              [](const nlohmann::json &left, const nlohmann::json &right) {
                  return left["queuedMs"].get<double>() + left["runMs"].get<double>() >
                         right["queuedMs"].get<double>() + right["runMs"].get<double>();
              });
    return waits;
}

void resetMainWorkCounts()
{
    for (MainWaitRecord &record : gMainWaits)
    {
        resetMainWaits(record);
    }
    resetMainWaits(gOverflowMainWaits);
    gMainDrains.store(0, std::memory_order_relaxed);
    gMainDrainedItems.store(0, std::memory_order_relaxed);
    gMainDrainNanos.store(0, std::memory_order_relaxed);
    gMaxMainDrainNanos.store(0, std::memory_order_relaxed);
    gMaxMainDrainItems.store(0, std::memory_order_relaxed);
}
}
