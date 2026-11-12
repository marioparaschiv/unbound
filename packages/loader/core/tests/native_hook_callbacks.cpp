#include <cassert>
#include <functional>
#include <memory>
#include <string>
#include <thread>
#include <vector>

#include "NativeHookCallbacks.h"
#include "NativePluginRuntime.h"

using loader::native::HookCallbackOwner;
using loader::native::RuntimeResourceRegistry;

class RecordingExecutor final : public loader::native::NativePluginExecutor
{
public:
    bool isMainThread() override
    {
        return true;
    }

    void runOnMain(std::function<void()> work) override
    {
        work();
    }

    void runOnRuntime(std::function<void(facebook::jsi::Runtime &)>) override
    {
        runtimeWork++;
    }

    void runAfter(double, std::function<void()>) override {}

    size_t runtimeWork = 0;
};

static std::shared_ptr<void> tracked(bool &released)
{
    return std::shared_ptr<void>(new int(0), [&released](void *value) {
        delete static_cast<int *>(value);
        released = true;
    });
}

int main()
{
    auto executor = std::make_shared<RecordingExecutor>();
    loader::native::setExecutor(executor);
    auto                               resources = std::make_shared<RuntimeResourceRegistry>();
    std::vector<std::function<void()>> posted;
    loader::native::MainThreadPost     post = [&](std::function<void()> work) {
        posted.push_back(std::move(work));
    };
    auto owner = [&](std::string key, bool inlineRuntime) {
        return HookCallbackOwner{resources, resources->identity(), std::move(key), inlineRuntime};
    };

    bool ownerReleased = false;
    resources->retain("ios-hook:1", tracked(ownerReleased));
    loader::native::releaseHookCallbacks(owner("ios-hook:1", false), post);
    assert(ownerReleased && posted.empty() && executor->runtimeWork == 0);

    loader::native::releaseHookCallbacks(owner("", true), post);
    assert(posted.empty());

    bool inlineReleased = false;
    resources->retain("ios-hook:2", tracked(inlineReleased));
    std::thread([&] {
        loader::native::releaseHookCallbacks(owner("ios-hook:2", true), post);
    }).join();
    assert(!inlineReleased && posted.size() == 1 && resources->size() == 0);
    posted.front()();
    assert(inlineReleased);

    bool runtimeReleased = false;
    resources->retain("android-hook:3", tracked(runtimeReleased));
    std::thread([&] {
        loader::native::releaseHookCallbacks(owner("android-hook:3", false), post);
    }).join();
    assert(!runtimeReleased && posted.size() == 1 && executor->runtimeWork == 1);
    resources->drainDeferredReleases();
    assert(runtimeReleased);

    bool deferredReleased = false;
    resources->retain("android-hook:4", tracked(deferredReleased));
    loader::native::deferHookCallbackRelease(owner("android-hook:4", true), post);
    assert(!deferredReleased && posted.size() == 2);
    posted.back()();
    assert(deferredReleased);

    loader::native::deferHookCallbackRelease(owner("android-hook:missing", true), post);
    assert(posted.size() == 2);
    loader::native::setExecutor(nullptr);
}
