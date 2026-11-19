#include <cassert>
#include <string>
#include <vector>

#include "LoaderAddonActivity.h"
#include "LoaderAddonHandles.h"

int main()
{
    loader::AddonSlot slot = loader::registerAddonSlot("unbound.leaky", "Leaky Plugin");
    std::vector<loader::HandleCharge> charges;

    for (size_t index = 0; index < loader::kAddonHandleLimit; index++)
    {
        loader::HandleCharge charge = loader::chargeHandle(slot);
        assert(charge.admitted);
        charges.push_back(charge);
    }

    assert(loader::handlesHeldBy(slot) == loader::kAddonHandleLimit);
    assert(!loader::chargeHandle(slot).admitted);
    assert(loader::handleLimitMessage(slot).starts_with("Leaky Plugin holds 50000"));

    loader::releaseHandle(charges.back());
    charges.pop_back();
    assert(loader::chargeHandle(slot).admitted);

    loader::HandleCharge outside = loader::chargeHandle(loader::kNoAddon);
    assert(outside.admitted && outside.slot == loader::kNoAddon);
    loader::releaseHandle(outside);
    return 0;
}
