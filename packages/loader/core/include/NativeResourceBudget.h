#pragma once

#include <cstddef>
#include <mutex>

namespace loader::native
{
    inline constexpr size_t kMaximumNativeHooks              = 256;
    inline constexpr size_t kMaximumNativeCachedReturnValues = 512;

    class NativeResourceBudget
    {
    public:
        explicit NativeResourceBudget(size_t limit);

        bool   acquire(size_t count = 1);
        void   release(size_t count = 1);
        size_t used() const;
        size_t limit() const;

    private:
        mutable std::mutex mutex_;
        size_t             limit_;
        size_t             used_ = 0;
    };

    class NativeResourceReservation
    {
    public:
        NativeResourceReservation(NativeResourceBudget &budget, const char *exhausted);
        ~NativeResourceReservation();

        NativeResourceReservation(const NativeResourceReservation &)            = delete;
        NativeResourceReservation &operator=(const NativeResourceReservation &) = delete;

        void commit();

    private:
        NativeResourceBudget &budget_;
        bool                  committed_ = false;
    };

    NativeResourceBudget &nativeHookBudget();
    NativeResourceBudget &nativeCachedReturnBudget();
}
