#include <cassert>
#include <memory>
#include <string>
#include <thread>

#include "NativeRuntimeResources.h"

int main()
{
    loader::native::RuntimeResourceRegistry resources;
    loader::native::RuntimeResourceRegistry otherResources;
    bool                                    firstReleased    = false;
    bool                                    secondReleased   = false;
    bool                                    deferredReleased = false;
    assert(resources.identity() != otherResources.identity());
    assert(resources.active());
    auto invalidatedResources = std::make_shared<loader::native::RuntimeResourceRegistry>();
    std::weak_ptr<loader::native::RuntimeResourceRegistry> invalidatedReference =
        invalidatedResources;
    assert(loader::native::invalidateRuntimeResources(invalidatedReference));
    assert(!invalidatedResources->active());
    assert(!invalidatedResources->retain("stale", std::make_shared<int>(4)));
    invalidatedResources.reset();
    assert(invalidatedReference.expired());
    auto runtimeLifetimeResources = std::make_shared<loader::native::RuntimeResourceRegistry>();
    std::weak_ptr<loader::native::RuntimeResourceRegistry> runtimeLifetimeReference =
        runtimeLifetimeResources;
    bool runtimeLifetimeReleased = false;
    auto runtimeLifetimeResource = std::shared_ptr<void>(new int(5), [&](void *value) {
        delete static_cast<int *>(value);
        runtimeLifetimeReleased = true;
    });
    assert(runtimeLifetimeResources->retain("runtime-lifetime", runtimeLifetimeResource));
    runtimeLifetimeResource.reset();
    runtimeLifetimeResources->invalidate();
    runtimeLifetimeResources->clear();
    assert(runtimeLifetimeReleased);
    assert(!runtimeLifetimeResources->active());
    assert(!runtimeLifetimeResources->retain("after-invalidation", std::make_shared<int>(6)));
    runtimeLifetimeResources.reset();
    assert(runtimeLifetimeReference.expired());
    auto first  = std::shared_ptr<void>(new int(1), [&](void *value) {
        delete static_cast<int *>(value);
        firstReleased = true;
    });
    auto second = std::shared_ptr<void>(new int(2), [&](void *value) {
        delete static_cast<int *>(value);
        secondReleased = true;
    });

    assert(resources.retain("hook-1", first));
    first.reset();
    assert(!firstReleased);
    assert(!resources.retain("hook-1", std::make_shared<int>(3)));
    assert(resources.size() == 1);
    assert(resources.release("hook-1"));
    assert(firstReleased);
    assert(!resources.release("hook-1"));

    auto ownerThreadResources = std::make_shared<loader::native::RuntimeResourceRegistry>();
    std::weak_ptr<loader::native::RuntimeResourceRegistry> ownerThreadReference =
        ownerThreadResources;
    bool ownerThreadReleased = false;
    auto ownerThreadResource = std::shared_ptr<void>(new int(7), [&](void *value) {
        delete static_cast<int *>(value);
        ownerThreadReleased = true;
    });
    assert(ownerThreadResources->retain("owner-thread", ownerThreadResource));
    ownerThreadResource.reset();
    bool        releasedFromOtherThread = true;
    std::thread otherThread([&] {
        releasedFromOtherThread = loader::native::releaseRuntimeResourceOnOwnerThread(
            ownerThreadReference, "owner-thread");
    });
    otherThread.join();
    assert(!releasedFromOtherThread);
    assert(!ownerThreadReleased);
    assert(
        loader::native::releaseRuntimeResourceOnOwnerThread(ownerThreadReference, "owner-thread"));
    assert(ownerThreadReleased);
    auto wrongThreadResources        = std::make_shared<loader::native::RuntimeResourceRegistry>();
    bool wrongThreadResourceReleased = false;
    auto wrongThreadResource         = std::shared_ptr<void>(new int(8), [&](void *value) {
        delete static_cast<int *>(value);
        wrongThreadResourceReleased = true;
    });
    assert(wrongThreadResources->retain("wrong-thread-destruction", wrongThreadResource));
    wrongThreadResource.reset();
    std::thread wrongThread([resources = std::move(wrongThreadResources)]() mutable {
        resources.reset();
    });
    wrongThread.join();
    assert(!wrongThreadResourceReleased);

    assert(resources.retain("hook-2", second));
    second.reset();
    assert(!secondReleased);
    auto deferred = std::shared_ptr<void>(new int(3), [&](void *value) {
        delete static_cast<int *>(value);
        deferredReleased = true;
    });
    assert(resources.retain("hook-3", deferred));
    deferred.reset();
    assert(resources.deferRelease("hook-3"));
    assert(!deferredReleased);
    assert(resources.size() == 1);
    assert(resources.drainDeferredReleases() == 1);
    assert(deferredReleased);
    resources.clear();
    assert(secondReleased);
    assert(resources.size() == 0);
}
