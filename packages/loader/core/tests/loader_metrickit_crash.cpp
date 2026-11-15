#include <cassert>
#include <string>

#include "LoaderMetricKitCrash.h"

int main()
{
    nlohmann::json crash = nlohmann::json::parse(R"({
        "diagnosticMetaData": {"signal": 11, "exceptionType": 1, "exceptionCode": 0},
        "callStackTree": {"callStacks": [
            {"threadAttributed": false, "callStackRootFrames": [{"address": 1, "binaryName": "Other"}]},
            {"threadAttributed": true, "callStackRootFrames": [{
                "address": 4295000064, "binaryName": "Discord", "offsetIntoBinaryTextSegment": 4096,
                "subFrames": [{"address": 4295000128, "binaryName": "Unbound.dylib", "offsetIntoBinaryTextSegment": 32}]
            }]}
        ]}
    })");

    std::optional<std::string> stack = loader::metricKitCrashStack(crash);
    assert(stack.has_value());
    assert(*stack
           == "Signal 11\nException 1 code 0\n#0 0x100008000 Discord + 0x1000\n"
              "#1 0x100008040 Unbound.dylib + 0x20\n");
    assert(!loader::metricKitCrashStack(nlohmann::json::object()).has_value());
    assert(!loader::metricKitCrashStack(
                nlohmann::json::parse(R"({"callStackTree": {"callStacks": []}})"))
                .has_value());
    return 0;
}
