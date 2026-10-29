#pragma once

#include <chrono>
#include <cstdint>
#include <functional>
#include <memory>
#include <string>

namespace loader {
struct FreezeReport {
    std::string id;
    std::string name;
    double      seconds  = 0;
    bool        resolved = false;
    std::string detail;
};

struct FreezeWatchdogOptions {
    std::chrono::milliseconds interval{1000};
    std::chrono::milliseconds threshold{6000};
};

using FreezeHeartbeat = std::function<bool(std::function<void()> beat)>;
using FreezeListener  = std::function<void(const FreezeReport &report)>;

class FreezeWatchdog
{
public:
    FreezeWatchdog(std::string directory, FreezeHeartbeat heartbeat, FreezeListener listener,
                   FreezeWatchdogOptions options = {});
    ~FreezeWatchdog();

    FreezeWatchdog(const FreezeWatchdog &)            = delete;
    FreezeWatchdog &operator=(const FreezeWatchdog &) = delete;

    struct State;

private:
    std::shared_ptr<State> state_;
};

void startFreezeWatchdog(const std::string &directory);
}
