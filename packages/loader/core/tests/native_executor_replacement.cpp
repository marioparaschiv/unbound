#include <atomic>
#include <cassert>
#include <functional>
#include <memory>

#include "NativePluginRuntime.h"

namespace {
std::atomic_int gDestroyed{0};

class CountingExecutor final : public loader::native::NativePluginExecutor
{
public:
    ~CountingExecutor() override
    {
        gDestroyed++;
    }

    bool isMainThread() override
    {
        return true;
    }

    void runOnMain(std::function<void()> work) override
    {
        work();
    }

    void runOnRuntime(std::function<void(facebook::jsi::Runtime &)>) override {}

    void runAfter(double, std::function<void()>) override {}
};

void keepsAReplacedExecutorAliveSoItsQueuedWorkIsNeverDestroyed()
{
    loader::native::setExecutor(std::make_shared<CountingExecutor>());
    loader::native::setExecutor(std::make_shared<CountingExecutor>());
    assert(gDestroyed == 0);
}

void releasesTheExecutorWhenClearedAtShutdown()
{
    loader::native::setExecutor(nullptr);
    assert(gDestroyed == 1);
}
}

int main()
{
    keepsAReplacedExecutorAliveSoItsQueuedWorkIsNeverDestroyed();
    releasesTheExecutorWhenClearedAtShutdown();
}
