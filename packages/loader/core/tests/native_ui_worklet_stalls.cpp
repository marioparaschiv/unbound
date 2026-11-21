#include <cassert>
#include <string>

#include "LoaderAddonActivity.h"
#include "LoaderHookBreadcrumbs.h"
#include "NativeUIWorkletStalls.h"

int main()
{
    using namespace loader::native;

    assert(!reportsUIWorkletStall(0));
    assert(reportsUIWorkletStall(1));
    assert(!reportsUIWorkletStall(2));
    assert(reportsUIWorkletStall(10));
    assert(!reportsUIWorkletStall(11));
    assert(reportsUIWorkletStall(100));

    assert(uiWorkletStallMessage("Chat Bubbles", "DCDMessageTableViewCell -layoutSubviews", 120, 1)
           == "Chat Bubbles's UI worklet on DCDMessageTableViewCell -layoutSubviews blocked the UI "
              "thread for 120 ms.");
    assert(uiWorkletStallMessage("Chat Bubbles", "", 80, 10).find("(10 stalls so far)")
           != std::string::npos);

    loader::AddonSlot slot = loader::registerAddonSlot("unbound.stalls", "Stalls");
    uint32_t hook          = loader::registerHookName("UIView -layoutSubviews");
    assert(loader::hookName(hook) == "UIView -layoutSubviews");
    assert(loader::hookName(0).empty());

    assert(noteUIWorkletRun(slot, hook, kUIWorkletStallMs - 1) == 0);
    assert(noteUIWorkletRun(slot, hook, kUIWorkletStallMs) == 1);
    assert(noteUIWorkletRun(slot, hook, 500) == 2);
    return 0;
}
