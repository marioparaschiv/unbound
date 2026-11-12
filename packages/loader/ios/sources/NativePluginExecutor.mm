#include <chrono>
#include <exception>
#include <functional>
#include <memory>
#include <mutex>
#include <string>

#import "Logger.h"
#import "NativePluginBridge.h"
#import "NativePluginFrameScheduler.h"
#import "NativePluginRuntime.h"
#import "NativeWorkQueue.h"

using namespace facebook;
using namespace facebook::jsi;

@interface NSObject (RuntimeExecutor)
- (void)callFunctionOnBufferedRuntimeExecutor:
    (std::function<void(facebook::jsi::Runtime &)> &&)executor;
@end

namespace {
// RCTInstance resets its ReactInstance on the JS thread after -invalidate, and
// callFunctionOnBufferedRuntimeExecutor: dereferences it unchecked, so the instance is only
// messaged under this mutex and retired before -invalidate runs.
static std::mutex gRuntimeExecutorMutex;
static __weak id  gRuntimeExecutorInstance = nil;

class IOSNativePluginExecutor final : public loader::native::NativePluginExecutor,
                                      public std::enable_shared_from_this<IOSNativePluginExecutor>
{
public:
    bool isMainThread() override
    {
        return [NSThread isMainThread];
    }

    void runOnMain(std::function<void()> work) override
    {
        auto task = std::make_shared<std::function<void()>>(std::move(work));
        dispatch_async(dispatch_get_main_queue(), ^{
            @autoreleasepool
            {
                (*task)();
            }
        });
    }

    bool runOnMainNextFrame(std::function<void()> work) override
    {
        return loader::ios::scheduleNativePluginFrameWork(std::move(work));
    }

    void runOnRuntime(std::function<void(Runtime &)> work) override
    {
        enqueueRuntime(std::move(work), loader::native::NativeWorkPriority::Deferred);
    }

    void runOnRuntimeCoalesced(std::string key, std::function<void(Runtime &)> work) override
    {
        if (runtimeQueue_.enqueueCoalesced(std::move(key), std::move(work)))
        {
            scheduleRuntimeDrain();
        }
    }

    void runOnRuntimeCritical(std::function<void(Runtime &)> work) override
    {
        enqueueRuntime(std::move(work), loader::native::NativeWorkPriority::Critical);
    }

    void runAfter(double seconds, std::function<void()> work) override
    {
        auto task = std::make_shared<std::function<void()>>(std::move(work));
        dispatch_after(
            dispatch_time(DISPATCH_TIME_NOW, static_cast<int64_t>(seconds * NSEC_PER_SEC)),
            dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{ (*task)(); });
    }

private:
    void enqueueRuntime(std::function<void(Runtime &)>     work,
                        loader::native::NativeWorkPriority priority)
    {
        if (runtimeQueue_.enqueue(std::move(work), priority))
        {
            scheduleRuntimeDrain();
        }
    }

    void scheduleRuntimeDrain()
    {
        auto owner     = shared_from_this();
        bool scheduled = loader::runOnNativePluginRuntime([owner](Runtime &runtime) {
            @autoreleasepool
            {
                bool remaining = owner->runtimeQueue_.drain(
                    [&](auto work) {
                        try
                        {
                            work(runtime);
                        }
                        catch (const std::exception &error)
                        {
                            [Logger error:LOG_CATEGORY_PLUGINS
                                   format:@"Runtime work failed: %s", error.what()];
                        }
                        catch (...)
                        {
                            [Logger error:LOG_CATEGORY_PLUGINS format:@"Runtime work failed."];
                        }
                    },
                    [] {
                        return std::chrono::steady_clock::now();
                    });
                if (remaining)
                {
                    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0),
                                   ^{ owner->scheduleRuntimeDrain(); });
                }
            }
        });
        if (!scheduled)
        {
            runtimeQueue_.retryScheduling();
        }
    }

    loader::native::NativeWorkQueue<std::function<void(Runtime &)>> runtimeQueue_;
};
}

namespace loader {

void setNativePluginRuntimeExecutor(id instance)
{
    {
        std::lock_guard<std::mutex> lock(gRuntimeExecutorMutex);
        gRuntimeExecutorInstance = instance;
    }
    loader::native::setExecutor(std::make_shared<IOSNativePluginExecutor>());
}

void retireNativePluginRuntimeExecutor(id instance)
{
    std::lock_guard<std::mutex> lock(gRuntimeExecutorMutex);
    if (gRuntimeExecutorInstance == instance)
    {
        gRuntimeExecutorInstance = nil;
    }
}

bool runOnNativePluginRuntime(std::function<void(Runtime &)> work)
{
    std::lock_guard<std::mutex> lock(gRuntimeExecutorMutex);
    id                          instance = gRuntimeExecutorInstance;
    if (!instance)
    {
        return false;
    }
    [instance callFunctionOnBufferedRuntimeExecutor:std::move(work)];
    return true;
}
}
