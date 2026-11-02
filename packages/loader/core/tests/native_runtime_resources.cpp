#include <cassert>
#include <memory>
#include <string>

#include "NativeRuntimeResources.h"

int main()
{
    loader::native::RuntimeResourceRegistry resources;
    bool                                    firstReleased    = false;
    bool                                    secondReleased   = false;
    bool                                    deferredReleased = false;
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
