#pragma once

#include <cstddef>
#include <mutex>
#include <set>
#include <string>

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

    class NativeResourceRegistry
    {
    public:
        explicit NativeResourceRegistry(NativeResourceBudget &budget);

        void   adopt(const std::string &id, NativeResourceReservation &reservation);
        bool   release(const std::string &id);
        bool   contains(const std::string &id) const;
        size_t releaseAll();
        size_t size() const;

    private:
        NativeResourceBudget &budget_;
        mutable std::mutex    mutex_;
        std::set<std::string> ids_;
    };

    NativeResourceBudget &nativeHookBudget();
    NativeResourceBudget &nativeCachedReturnBudget();
    NativeResourceBudget &nativeSurfaceBudget();
}
