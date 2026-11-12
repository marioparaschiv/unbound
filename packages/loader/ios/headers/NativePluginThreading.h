#pragma once

#include <functional>
#include <jsi/jsi.h>
#include <os/log.h>
#include <os/signpost.h>

namespace loader::ios {
class NativeOperationSignpost
{
public:
    explicit NativeOperationSignpost(const char *operation);
    ~NativeOperationSignpost();

private:
    os_log_t         log_;
    os_signpost_id_t identifier_ = OS_SIGNPOST_ID_INVALID;
    bool             enabled_;
};

[[noreturn]] void         throwWrongThread(facebook::jsi::Runtime &runtime, const char *message);
std::function<void(void)> objcGuarded(std::function<void(void)> operation);
void executeMainSynchronouslyUnlessMainWaits(std::function<void(void)> callback);
facebook::jsi::Value
executeMainAsynchronously(facebook::jsi::Runtime &runtime, std::function<void(void)> operation,
                          std::function<facebook::jsi::Value(facebook::jsi::Runtime &)> result);
bool executeRuntimeSynchronously(std::function<void(facebook::jsi::Runtime &)> callback);
void executeRuntimeAsynchronously(std::function<void(facebook::jsi::Runtime &)> callback);
}
