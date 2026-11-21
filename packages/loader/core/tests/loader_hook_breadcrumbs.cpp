#include <cassert>
#include <cstdio>
#include <string>
#include <unistd.h>

#include "LoaderAddonActivity.h"
#include "LoaderHookBreadcrumbs.h"

int main()
{
    loader::AddonSlot slot = loader::registerAddonSlot("unbound.hooky", "Hooky");
    uint32_t layout        = loader::registerHookName("DCDMessageTableViewCell -layoutSubviews");
    uint32_t pan           = loader::registerHookName("DCDMessageTableViewCell -handlePan:");
    assert(layout != 0 && pan != 0 && layout != pan);
    assert(loader::registerHookName("DCDMessageTableViewCell -layoutSubviews") == layout);

    loader::claimActivityCell();
    loader::noteHookCall(layout, slot);
    loader::noteHookCall(pan, slot);

    loader::HookCall calls[loader::kHookTrailLength];
    assert(loader::crashingThreadHookCalls(calls, loader::kHookTrailLength) == 2);
    assert(calls[0].hook == pan && calls[1].hook == layout && calls[0].addon == slot);

    FILE *file = tmpfile();
    assert(loader::writeCrashingHookLines(fileno(file)));
    rewind(file);
    char buffer[512] = {};
    size_t read      = fread(buffer, 1, sizeof(buffer) - 1, file);
    std::string text(buffer, read);
    assert(text.find("Hook DCDMessageTableViewCell -handlePan: {\"id\":\"unbound.hooky\"") == 0);
    assert(text.find("Hook DCDMessageTableViewCell -layoutSubviews") != std::string::npos);
    fclose(file);

    {
        loader::HookTrailMark finished;
        finished.note(pan, slot);
    }

    loader::HookCall running[loader::kHookTrailLength];
    assert(loader::crashingThreadHookCalls(running, loader::kHookTrailLength, true) == 2);
    assert(running[0].hook == pan && running[1].hook == layout);
    assert(loader::crashingThreadHookCalls(calls, loader::kHookTrailLength) == 3);

    {
        loader::HookTrailMark returned;
        returned.note(layout, slot);
        returned.note(pan, slot);
    }

    assert(loader::crashingThreadHookCalls(running, loader::kHookTrailLength, true) == 2);
    return 0;
}
