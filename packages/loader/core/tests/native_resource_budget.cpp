#include "NativePluginRuntime.h"
#include "NativeResourceBudget.h"

#include <cassert>

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
}
