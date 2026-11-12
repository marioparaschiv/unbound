#include "NativeResourceBudget.h"

#include <map>

#include "NativeFabric.h"
#include "NativeHandleLeases.h"
#include "NativeLimits.h"
#include "NativePluginRuntime.h"

namespace loader::native {
NativeResourceBudget::NativeResourceBudget(size_t limit) : limit_(limit) {}

bool NativeResourceBudget::acquire(size_t count)
{
    std::lock_guard<std::mutex> lock(mutex_);
    if (count > limit_ - used_)
    {
        return false;
    }
    used_ += count;
    return true;
}

void NativeResourceBudget::release(size_t count)
{
    std::lock_guard<std::mutex> lock(mutex_);
    used_ = count > used_ ? 0 : used_ - count;
}

size_t NativeResourceBudget::used() const
{
    std::lock_guard<std::mutex> lock(mutex_);
    return used_;
}

size_t NativeResourceBudget::limit() const
{
    return limit_;
}

NativeResourceReservation::NativeResourceReservation(NativeResourceBudget &budget,
                                                     const char           *exhausted)
    : budget_(budget)
{
    if (!budget_.acquire())
    {
        throw NativeCodedError(kNativeBridgeErrorCode, exhausted);
    }
}

NativeResourceReservation::~NativeResourceReservation()
{
    if (!committed_)
    {
        budget_.release();
    }
}

void NativeResourceReservation::commit()
{
    committed_ = true;
}

NativeResourceRegistry::NativeResourceRegistry(NativeResourceBudget &budget) : budget_(budget) {}

void NativeResourceRegistry::adopt(const std::string &id, NativeResourceReservation &reservation)
{
    std::lock_guard<std::mutex> lock(mutex_);
    if (ids_.insert(id).second)
    {
        reservation.commit();
    }
}

bool NativeResourceRegistry::release(const std::string &id)
{
    std::lock_guard<std::mutex> lock(mutex_);
    if (ids_.erase(id) == 0)
    {
        return false;
    }
    budget_.release();
    return true;
}

bool NativeResourceRegistry::contains(const std::string &id) const
{
    std::lock_guard<std::mutex> lock(mutex_);
    return ids_.contains(id);
}

size_t NativeResourceRegistry::releaseAll()
{
    std::lock_guard<std::mutex> lock(mutex_);
    size_t                      count = ids_.size();
    ids_.clear();
    budget_.release(count);
    return count;
}

size_t NativeResourceRegistry::size() const
{
    std::lock_guard<std::mutex> lock(mutex_);
    return ids_.size();
}

NativeResourceBudget &nativeSurfaceBudget()
{
    static NativeResourceBudget budget(kMaximumMountedSurfaces);
    return budget;
}

NativeResourceBudget &nativeHookBudget()
{
    static NativeResourceBudget budget(kMaximumNativeHooks);
    return budget;
}

NativeResourceBudget &nativeCachedReturnBudget()
{
    static NativeResourceBudget budget(kMaximumNativeCachedReturnValues);
    return budget;
}

NativeResourceBudget &nativePreparedCallBudget()
{
    static NativeResourceBudget budget(kMaximumPreparedNativeCalls);
    return budget;
}

static std::mutex &platformCounterMutex()
{
    static std::mutex mutex;
    return mutex;
}

static std::map<std::string, std::function<size_t()>> &platformResourceCounters()
{
    static std::map<std::string, std::function<size_t()>> counters;
    return counters;
}

void setPlatformResourceCounter(const std::string &name, std::function<size_t()> counter)
{
    std::lock_guard<std::mutex> lock(platformCounterMutex());
    if (counter)
    {
        platformResourceCounters()[name] = std::move(counter);
        return;
    }
    platformResourceCounters().erase(name);
}

static std::map<std::string, size_t> platformResourceCounts()
{
    std::map<std::string, size_t> counts = {{kObjCHandleCounter, 0},
                                            {kObjCPlanCounter, 0},
                                            {kObjCRetainCounter, 0},
                                            {kJavaHandleCounter, 0}};
    std::lock_guard<std::mutex>   lock(platformCounterMutex());
    for (const auto &[name, counter] : platformResourceCounters())
    {
        counts[name] = counter();
    }
    return counts;
}

nlohmann::json nativeResourceCounts()
{
    // Every platform counter counts live handles, so `handles` means the same on both platforms.
    const std::map<std::string, size_t> platform = platformResourceCounts();
    size_t                              handles  = leasedHandleCount();
    const size_t                        leases   = handles;
    for (const auto &[name, count] : platform)
    {
        handles += count;
    }
    nlohmann::json counts = {{"hooks", nativeHookBudget().used()},
                             {"surfaces", nativeSurfaceBudget().used()},
                             {"cachedReturns", nativeCachedReturnBudget().used()},
                             {"handles", handles},
                             {"leases", leases},
                             {"idleSurfaces", idleFabricSurfaces()},
                             {"createdSurfaces", createdFabricSurfaces()},
                             {"reusedSurfaces", reusedFabricSurfaces()},
                             {"missedSurfaces", missedFabricSurfaces()},
                             {"mainWork", mainWorkCounts()},
                             {"mainWaits", mainWaitCounts()}};
    for (const auto &[name, count] : platform)
    {
        counts[name] = count;
    }
    return counts;
}
}
