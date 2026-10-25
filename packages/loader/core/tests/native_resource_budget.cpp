#include <cassert>

#include "NativePluginRuntime.h"
#include "NativeResourceBudget.h"

using namespace loader::native;

static bool exhausts(NativeResourceBudget &budget)
{
    try
    {
        NativeResourceReservation reservation(budget, "budget exhausted");
        reservation.commit();
    }
    catch (const NativeCodedError &error)
    {
        assert(error.code() == "NATIVE_BRIDGE_ERROR");
        return true;
    }
    return false;
}

int main()
{
    assert(nativeHookBudget().limit() == kMaximumNativeHooks);
    assert(nativeCachedReturnBudget().limit() == kMaximumNativeCachedReturnValues);
    assert(kMaximumNativeHooks == 256);
    assert(kMaximumNativeCachedReturnValues == 512);

    NativeResourceBudget budget(2);
    assert(budget.acquire());
    assert(budget.used() == 1);
    {
        NativeResourceReservation abandoned(budget, "budget exhausted");
        assert(budget.used() == 2);
    }
    assert(budget.used() == 1);
    assert(!exhausts(budget));
    assert(budget.used() == 2);
    assert(exhausts(budget));
    assert(!budget.acquire());
    budget.release(5);
    assert(budget.used() == 0);
    assert(budget.acquire(2));
    assert(!budget.acquire(1));
    budget.release(1);
    assert(budget.acquire(1));

    assert(nativeSurfaceBudget().limit() == 64);
    NativeResourceBudget   hooks(3);
    NativeResourceRegistry registry(hooks);
    {
        NativeResourceReservation reservation(hooks, "budget exhausted");
        registry.adopt("hook-1", reservation);
    }
    {
        NativeResourceReservation duplicate(hooks, "budget exhausted");
        registry.adopt("hook-1", duplicate);
    }
    assert(hooks.used() == 1 && registry.size() == 1 && registry.contains("hook-1"));
    {
        NativeResourceReservation reservation(hooks, "budget exhausted");
        registry.adopt("hook-2", reservation);
    }
    assert(registry.release("hook-1"));
    assert(!registry.release("hook-1"));
    assert(hooks.used() == 1);
    assert(registry.releaseAll() == 1);
    assert(hooks.used() == 0 && registry.size() == 0);
}
