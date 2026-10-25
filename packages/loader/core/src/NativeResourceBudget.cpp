#include "NativeResourceBudget.h"

#include "NativePluginRuntime.h"

namespace loader::native
{
    NativeResourceBudget::NativeResourceBudget(size_t limit) : limit_(limit)
    {
    }

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

    NativeResourceReservation::NativeResourceReservation(NativeResourceBudget &budget, const char *exhausted)
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
