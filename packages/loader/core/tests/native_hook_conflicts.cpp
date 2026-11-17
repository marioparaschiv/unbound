#include <cassert>
#include <string>
#include <vector>

#include "NativeHookConflicts.h"

namespace native = loader::native;

namespace {
void namesAddonsRewritingTheSameMethod()
{
    std::vector<native::RewritingHook> hooks = {
        {"DCDMessageCell -setText:", "Message Text Size"},
        {"DCDMessageCell -setText:", "Chat Bubbles"},
        {"DCDMessageCell -setText:", "Chat Bubbles"},
        {"UILabel -setText:", "Chat Bubbles"},
        {"Activity.dispatchKeyEvent", ""},
    };

    assert((native::conflictsAmong(hooks)
            == std::vector<std::string>{
                "Chat Bubbles × Message Text Size · DCDMessageCell -setText:"}));
    assert(native::conflictsAmong({}).empty());
}

void forgetsRemovedHooks()
{
    native::forgetAllRewritingHooks();
    native::recordRewritingHook("hook-1", "View.onLayout", loader::kNoAddon);
    assert(native::recordedRewritingHooks().empty());

    loader::AddonSlot first  = loader::registerAddonSlot("one", "One");
    loader::AddonSlot second = loader::registerAddonSlot("two", "Two");
    native::recordRewritingHook("hook-1", "View.onLayout", first);
    native::recordRewritingHook("hook-2", "View.onLayout", second);
    assert(native::conflictsAmong(native::recordedRewritingHooks()).size() == 1);
    assert(native::rewritingHookOwner("hook-2") == "Two");
    native::forgetRewritingHook("hook-2");
    assert(native::rewritingHookOwner("hook-2").empty());
    assert(native::conflictsAmong(native::recordedRewritingHooks()).empty());
}
}

int main()
{
    namesAddonsRewritingTheSameMethod();
    forgetsRemovedHooks();
    return 0;
}
