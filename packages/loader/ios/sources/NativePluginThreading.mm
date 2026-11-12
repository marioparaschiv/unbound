#import "NativePluginThreading.h"

#import <Foundation/Foundation.h>
#include <stdexcept>

#import "NativePluginRuntime.h"

using namespace facebook;
using namespace facebook::jsi;

namespace loader::ios {

static os_log_t nativePerformanceLog()
{
    static os_log_t log = os_log_create("app.unbound", "NativePluginPerformance");
    return log;
}

NativeOperationSignpost::NativeOperationSignpost(const char *operation)
    : log_(nativePerformanceLog()), enabled_(os_signpost_enabled(log_))
{
    if (!enabled_)
        return;
    identifier_ = os_signpost_id_generate(log_);
    os_signpost_interval_begin(log_, identifier_, "Native Operation", "operation=%{public}s",
                               operation);
}

NativeOperationSignpost::~NativeOperationSignpost()
{
    if (enabled_)
        os_signpost_interval_end(log_, identifier_, "Native Operation");
}

[[noreturn]] void throwWrongThread(Runtime &runtime, const char *message)
{
    loader::native::throwCoded(runtime, "NATIVE_WRONG_THREAD", message);
}

std::function<void(void)> objcGuarded(std::function<void(void)> operation)
{
    return [operation = std::move(operation)]() {
        @try
        {
            operation();
        }
        @catch (NSException *exception)
        {
            throw std::runtime_error(exception.reason.UTF8String ?: "Native operation failed");
        }
    };
}

void executeMainSynchronouslyUnlessMainWaits(std::function<void(void)> callback)
{
    NativeOperationSignpost signpost("main thread crossing");
    loader::native::executeMainSynchronouslyUnlessMainWaits(objcGuarded(std::move(callback)));
}

Value executeMainAsynchronously(Runtime &runtime, std::function<void(void)> operation,
                                std::function<Value(Runtime &)> result)
{
    return loader::native::executeMainAsynchronously(runtime, objcGuarded(std::move(operation)),
                                                     std::move(result));
}

bool executeRuntimeSynchronously(std::function<void(Runtime &)> callback)
{
    NativeOperationSignpost signpost("runtime callback");
    return loader::native::executeRuntimeSynchronously(std::move(callback));
}

void executeRuntimeAsynchronously(std::function<void(Runtime &)> callback)
{
    loader::native::executeRuntimeAsynchronously(std::move(callback));
}
}
