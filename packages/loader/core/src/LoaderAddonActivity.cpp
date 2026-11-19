#include "LoaderAddonActivity.h"

#include <algorithm>
#include <atomic>
#include <cerrno>
#include <csignal>
#include <cstring>
#include <mutex>
#include <nlohmann/json.hpp>
#include <pthread.h>
#if defined(__APPLE__)
#include <pthread/introspection.h>
#endif
#include <sys/mman.h>
#include <type_traits>
#include <unistd.h>
#include <unordered_map>

namespace loader {
struct AddonRecord {
    char text[kAddonRecordByteLimit];
    uint32_t length;
};

struct ThreadActivity {
    std::atomic<uintptr_t> owner;
    uint32_t addon;
    HookCall hooks[kHookTrailLength];
    uint32_t nextHook;
};

static AddonRecord gRecords[kAddonSlotCapacity];
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
    ThreadActivity *entry = nullptr;
    void *alternateStack  = nullptr;

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

void ensureAlternateSignalStack()
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

#if defined(__APPLE__)
static std::atomic<pthread_introspection_hook_t> gPreviousThreadHook{nullptr};

static void giveStartingThreadAnAlternateStack(unsigned int event, pthread_t thread, void *address,
                                               size_t size)
{
    if (event == PTHREAD_INTROSPECTION_THREAD_START)
    {
        ensureAlternateSignalStack();
    }

    if (pthread_introspection_hook_t previous = gPreviousThreadHook.load())
    {
        previous(event, thread, address, size);
    }
}
#endif

void ensureAlternateSignalStacksOnNewThreads()
{
#if defined(__APPLE__)
    static std::once_flag installed;
    std::call_once(installed, []() {
        gPreviousThreadHook.store(
            pthread_introspection_hook_install(giveStartingThreadAnAlternateStack));
    });
#endif
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
            __atomic_store_n(&activity.nextHook, 0, __ATOMIC_RELEASE);
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
    auto &slots = registeredSlots();
    auto found  = slots.find(id);
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
    uint32_t length           = __atomic_load_n(&record.length, __ATOMIC_ACQUIRE);
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

uintptr_t currentActivityThread()
{
    return currentThreadKey();
}

AddonSlot addonOnThread(uintptr_t thread)
{
    if (thread == 0)
    {
        return kNoAddon;
    }

    for (const ThreadActivity &activity : gThreads)
    {
        if (activity.owner.load(std::memory_order_acquire) == thread)
        {
            return loadAddon(&activity.addon);
        }
    }

    return kNoAddon;
}

static AddonSlot crashingThreadAddon()
{
    return addonOnThread(currentThreadKey());
}

void noteHookCall(uint32_t hook, AddonSlot addon)
{
    ThreadActivity *activity = claimThreadActivity();
    if (!activity)
    {
        return;
    }

    uint32_t index = __atomic_load_n(&activity->nextHook, __ATOMIC_RELAXED);
    HookCall &call = activity->hooks[index % kHookTrailLength];
    __atomic_store_n(&call.hook, hook, __ATOMIC_RELAXED);
    __atomic_store_n(&call.addon, addon, __ATOMIC_RELAXED);
    __atomic_store_n(&activity->nextHook, index + 1, __ATOMIC_RELEASE);
}

size_t crashingThreadHookCalls(HookCall *out, size_t capacity)
{
    uintptr_t thread = currentThreadKey();
    for (const ThreadActivity &activity : gThreads)
    {
        if (activity.owner.load(std::memory_order_acquire) != thread)
        {
            continue;
        }

        uint32_t next = __atomic_load_n(&activity.nextHook, __ATOMIC_ACQUIRE);
        size_t count  = std::min<size_t>({next, kHookTrailLength, capacity});
        for (size_t index = 0; index < count; index++)
        {
            const HookCall &call = activity.hooks[(next - 1 - index) % kHookTrailLength];
            out[index]           = {__atomic_load_n(&call.hook, __ATOMIC_RELAXED),
                                    __atomic_load_n(&call.addon, __ATOMIC_RELAXED)};
        }

        return count;
    }

    return 0;
}

const char *addonRecordText(AddonSlot slot, uint32_t &length)
{
    if (slot == kNoAddon || slot >= kAddonSlotCapacity)
    {
        length = 0;
        return nullptr;
    }

    length = __atomic_load_n(&gRecords[slot].length, __ATOMIC_ACQUIRE);
    return gRecords[slot].text;
}

bool writeCrashingAddonRecord(int descriptor)
{
    AddonSlot slot = crashingThreadAddon();
    if (descriptor < 0 || slot == kNoAddon || slot >= kAddonSlotCapacity)
    {
        return false;
    }

    const AddonRecord &record = gRecords[slot];
    uint32_t length           = __atomic_load_n(&record.length, __ATOMIC_ACQUIRE);
    const char *cursor        = record.text;
    off_t offset              = 0;
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

bool writeCrashingAddonLine(int descriptor)
{
    AddonSlot slot = crashingThreadAddon();
    if (descriptor < 0 || slot == kNoAddon || slot >= kAddonSlotCapacity)
    {
        return false;
    }

    const AddonRecord &record = gRecords[slot];
    uint32_t length           = __atomic_load_n(&record.length, __ATOMIC_ACQUIRE);
    const char prefix[]       = "Addon ";
    const char newline        = '\n';
    return write(descriptor, prefix, sizeof(prefix) - 1) > 0
           && write(descriptor, record.text, length) > 0 && write(descriptor, &newline, 1) > 0;
}

size_t crashingAddonMessage(char *out, size_t capacity)
{
    AddonSlot slot                 = crashingThreadAddon();
    constexpr char kPrefix[]       = "Unbound addon ";
    constexpr size_t kPrefixLength = sizeof(kPrefix) - 1;
    if (!out || slot == kNoAddon || slot >= kAddonSlotCapacity || capacity <= kPrefixLength + 1)
    {
        return 0;
    }

    const AddonRecord &record = gRecords[slot];
    uint32_t length           = __atomic_load_n(&record.length, __ATOMIC_ACQUIRE);
    size_t copied             = std::min<size_t>(length, capacity - kPrefixLength - 1);
    std::memcpy(out, kPrefix, kPrefixLength);
    std::memcpy(out + kPrefixLength, record.text, copied);
    out[kPrefixLength + copied] = '\0';
    return kPrefixLength + copied;
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
