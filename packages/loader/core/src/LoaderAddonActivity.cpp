#include "LoaderAddonActivity.h"

#include <atomic>
#include <cerrno>
#include <csignal>
#include <cstring>
#include <mutex>
#include <nlohmann/json.hpp>
#include <pthread.h>
#include <sys/mman.h>
#include <type_traits>
#include <unistd.h>
#include <unordered_map>

namespace loader {
struct AddonRecord {
    char     text[kAddonRecordByteLimit];
    uint32_t length;
};

struct ThreadActivity {
    std::atomic<uintptr_t> owner;
    uint32_t               addon;
};

static AddonRecord    gRecords[kAddonSlotCapacity];
static ThreadActivity gThreads[kActivityThreadLimit];

static std::mutex &registryMutex()
{
    static auto *mutex = new std::mutex();
    return *mutex;
}

static std::unordered_map<std::string, AddonSlot> &registeredSlots()
{
    static auto *slots = new std::unordered_map<std::string, AddonSlot>();
    return *slots;
}

template <typename Thread> static uintptr_t threadKey(Thread thread)
{
    if constexpr (std::is_pointer_v<Thread>)
    {
        return reinterpret_cast<uintptr_t>(thread);
    }
    else
    {
        return static_cast<uintptr_t>(thread);
    }
}

static uintptr_t currentThreadKey()
{
    return threadKey(pthread_self());
}

static void storeAddon(uint32_t *cell, AddonSlot slot)
{
    __atomic_store_n(cell, slot, __ATOMIC_RELAXED);
}

static AddonSlot loadAddon(const uint32_t *cell)
{
    return __atomic_load_n(cell, __ATOMIC_RELAXED);
}

static constexpr size_t kAlternateSignalStackBytes = 64 * 1024;

struct ThreadClaim {
    ThreadActivity *entry          = nullptr;
    void           *alternateStack = nullptr;

    ~ThreadClaim()
    {
        if (entry)
        {
            storeAddon(&entry->addon, kNoAddon);
            entry->owner.store(0, std::memory_order_release);
        }
        if (alternateStack)
        {
            stack_t disabled  = {};
            disabled.ss_flags = SS_DISABLE;
            sigaltstack(&disabled, nullptr);
            munmap(alternateStack, kAlternateSignalStackBytes);
        }
    }
};

static thread_local ThreadClaim tClaim;

static void ensureAlternateSignalStack()
{
    stack_t current = {};
    if (sigaltstack(nullptr, &current) != 0 || !(current.ss_flags & SS_DISABLE))
    {
        return;
    }

    void *memory = mmap(nullptr, kAlternateSignalStackBytes, PROT_READ | PROT_WRITE,
                        MAP_PRIVATE | MAP_ANON, -1, 0);
    if (memory == MAP_FAILED)
    {
        return;
    }

    stack_t stack = {};
    stack.ss_sp   = memory;
    stack.ss_size = kAlternateSignalStackBytes;
    if (sigaltstack(&stack, nullptr) != 0)
    {
        munmap(memory, kAlternateSignalStackBytes);
        return;
    }
    tClaim.alternateStack = memory;
}

static ThreadActivity *claimThreadActivity()
{
    if (tClaim.entry)
    {
        return tClaim.entry;
    }

    uintptr_t key = currentThreadKey();
    for (ThreadActivity &activity : gThreads)
    {
        uintptr_t expected = 0;
        if (activity.owner.compare_exchange_strong(expected, key, std::memory_order_acq_rel))
        {
            storeAddon(&activity.addon, kNoAddon);
            tClaim.entry = &activity;
            ensureAlternateSignalStack();
            return &activity;
        }
    }
    return nullptr;
}

static std::string renderRecord(const std::string &id, const std::string &name)
{
    nlohmann::json record = {{"id", id}, {"name", name}};
    return record.dump(-1, ' ', false, nlohmann::json::error_handler_t::replace);
}

AddonSlot registerAddonSlot(const std::string &id, const std::string &name)
{
    if (id.empty())
    {
        return kNoAddon;
    }

    std::lock_guard<std::mutex> lock(registryMutex());
    auto                       &slots = registeredSlots();
    auto                        found = slots.find(id);
    if (found != slots.end())
    {
        return found->second;
    }

    AddonSlot slot = static_cast<AddonSlot>(slots.size() + 1);
    if (slot >= kAddonSlotCapacity)
    {
        return kNoAddon;
    }

    std::string text = renderRecord(id, name.empty() ? id : name);
    if (text.size() >= kAddonRecordByteLimit)
    {
        text = renderRecord(id, id);
    }
    if (text.size() >= kAddonRecordByteLimit)
    {
        return kNoAddon;
    }

    AddonRecord &record = gRecords[slot];
    std::memcpy(record.text, text.data(), text.size());
    __atomic_store_n(&record.length, static_cast<uint32_t>(text.size()), __ATOMIC_RELEASE);
    slots.emplace(id, slot);
    return slot;
}

std::string addonRecord(AddonSlot slot)
{
    if (slot == kNoAddon || slot >= kAddonSlotCapacity)
    {
        return std::string();
    }
    const AddonRecord &record = gRecords[slot];
    uint32_t           length = __atomic_load_n(&record.length, __ATOMIC_ACQUIRE);
    return std::string(record.text, length);
}

AddonSlot currentAddon()
{
    ThreadActivity *activity = tClaim.entry;
    return activity ? loadAddon(&activity->addon) : kNoAddon;
}

uint32_t *claimActivityCell()
{
    ThreadActivity *activity = claimThreadActivity();
    return activity ? &activity->addon : nullptr;
}

static AddonSlot crashingThreadAddon()
{
    uintptr_t key = currentThreadKey();
    for (const ThreadActivity &activity : gThreads)
    {
        if (activity.owner.load(std::memory_order_acquire) == key)
        {
            return loadAddon(&activity.addon);
        }
    }
    return kNoAddon;
}

bool writeCrashingAddonRecord(int descriptor)
{
    AddonSlot slot = crashingThreadAddon();
    if (descriptor < 0 || slot == kNoAddon || slot >= kAddonSlotCapacity)
    {
        return false;
    }

    const AddonRecord &record = gRecords[slot];
    uint32_t           length = __atomic_load_n(&record.length, __ATOMIC_ACQUIRE);
    const char        *cursor = record.text;
    off_t              offset = 0;
    while (length > 0)
    {
        ssize_t written = pwrite(descriptor, cursor, length, offset);
        if (written < 0 && errno == EINTR)
        {
            continue;
        }
        if (written <= 0)
        {
            return false;
        }
        cursor += written;
        offset += written;
        length -= static_cast<uint32_t>(written);
    }
    return true;
}

AddonScope::AddonScope(AddonSlot slot)
{
    if (slot == kNoAddon)
    {
        return;
    }
    cell_ = claimActivityCell();
    if (!cell_)
    {
        return;
    }
    previous_ = loadAddon(cell_);
    storeAddon(cell_, slot);
}

AddonScope::~AddonScope()
{
    if (cell_)
    {
        storeAddon(cell_, previous_);
    }
}
}
