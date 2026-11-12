#include "NativeHookCallbacks.h"

#include "NativePluginRuntime.h"

namespace jsi = facebook::jsi;

namespace loader::native {
static void drainDeferredReleases(const HookCallbackOwner &owner, const MainThreadPost &postToMain)
{
    auto resources = owner.resources;
    auto identity  = owner.identity;
    if (owner.inlineRuntime)
    {
        postToMain([resources, identity]() {
            withRuntimeResource(resources, identity, [](RuntimeResourceRegistry &registry) {
                registry.drainDeferredReleases();
            });
        });
        return;
    }
    executeRuntimeAsynchronously([resources, identity](jsi::Runtime &runtime) {
        withRuntimeResource(resources, identity, [&](RuntimeResourceRegistry &registry) {
            if (runtimeResourceRegistry(runtime)->identity() == identity)
            {
                registry.drainDeferredReleases();
            }
        });
    });
}

void deferHookCallbackRelease(const HookCallbackOwner &owner, const MainThreadPost &postToMain)
{
    if (deferRuntimeResourceRelease(owner.resources, owner.key))
    {
        drainDeferredReleases(owner, postToMain);
    }
}

void releaseHookCallbacks(const HookCallbackOwner &owner, const MainThreadPost &postToMain)
{
    if (owner.key.empty())
    {
        return;
    }
    if (releaseRuntimeResourceOnOwnerThread(owner.resources, owner.key))
    {
        return;
    }
    deferHookCallbackRelease(owner, postToMain);
}
}
