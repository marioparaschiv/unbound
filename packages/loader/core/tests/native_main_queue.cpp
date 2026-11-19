#include <cassert>
#include <functional>
#include <vector>

#include "LoaderAddonActivity.h"
#include "NativeMainQueue.h"

int main()
{
    loader::AddonSlot slot = loader::registerAddonSlot("unbound.busy", "Busy");
    std::vector<std::function<void()>> queued;
    int ran = 0;

    for (int index = 0; index < 3; index++)
    {
        queued.push_back(loader::native::chargeMainWork(
            [&ran] {
                ran++;
            },
            slot));
    }

    assert(loader::native::mainWorkPending(slot) == 3);
    queued[0]();
    queued.erase(queued.begin());
    assert(ran == 1);
    assert(loader::native::mainWorkPending(slot) == 2);
    queued.clear();
    assert(loader::native::mainWorkPending(slot) == 0);

    auto outside = loader::native::chargeMainWork(
        [&ran] {
            ran++;
        },
        loader::kNoAddon);
    outside();
    assert(ran == 2);
    return 0;
}
