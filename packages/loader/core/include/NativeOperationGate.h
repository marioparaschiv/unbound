#pragma once

#include <atomic>

namespace loader {

enum class NativeOperationPhase {
    queued,
    running,
    finished,
    expired,
};

class NativeOperationGate {
public:
    bool start();
    bool expire();
    void finish();
    NativeOperationPhase phase() const;

private:
    std::atomic<NativeOperationPhase> phase_{NativeOperationPhase::queued};
};

}
