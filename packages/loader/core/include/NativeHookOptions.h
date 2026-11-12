#pragma once

#include <cstddef>
#include <jsi/jsi.h>
#include <nlohmann/json.hpp>
#include <string_view>
#include <vector>

namespace loader::native {
enum class HookPayloadPhase
{
    both,
    before,
    after,
};

struct HookFlags {
    bool once          = false;
    bool cacheOnly     = false;
    bool coalesceAfter = false;
};

struct HookPayload {
    bool                receiver     = true;
    bool                allArguments = true;
    std::vector<size_t> argumentIndexes;
    HookPayloadPhase    phase = HookPayloadPhase::both;
};

struct HookHandlers {
    bool before  = false;
    bool after   = false;
    bool replace = false;
};

HookFlags   parseHookFlags(const nlohmann::json &options);
HookFlags   parseHookFlags(facebook::jsi::Runtime &runtime, const facebook::jsi::Object &options);
HookPayload parseHookPayload(const nlohmann::json &options, size_t explicitArguments);
HookPayload parseHookPayload(facebook::jsi::Runtime &runtime, const facebook::jsi::Object &options,
                             size_t explicitArguments);

bool cacheableHookResult(std::string_view result);
void validateHookHandlers(const HookHandlers &handlers, const HookFlags &flags,
                          const HookPayload &payload, std::string_view result);
void validateHookHandlers(facebook::jsi::Runtime &runtime, const HookHandlers &handlers,
                          const HookFlags &flags, const HookPayload &payload,
                          std::string_view result);

std::vector<size_t> payloadArgumentIndexes(const HookPayload &payload, size_t explicitArguments);
size_t              selectedPayloadArgument(double requested, size_t available);
size_t selectedPayloadArgument(facebook::jsi::Runtime &runtime, double requested, size_t available);
}
