#include "NativeResourceBudget.h"

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
}
