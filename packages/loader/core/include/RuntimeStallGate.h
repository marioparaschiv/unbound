#pragma once

#include <atomic>

namespace loader::native {
class RuntimeStallGate
{
public:
    bool stalled() const;
    void timedOut();
    void answered();

private:
    std::atomic_bool stalled_{false};
};
}
