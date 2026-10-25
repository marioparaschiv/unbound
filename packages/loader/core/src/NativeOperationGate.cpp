#include "NativeOperationGate.h"

namespace loader {

bool NativeOperationGate::start()
{
    NativeOperationPhase expected = NativeOperationPhase::queued;
    return phase_.compare_exchange_strong(expected, NativeOperationPhase::running);
}

bool NativeOperationGate::expire()
{
    NativeOperationPhase expected = NativeOperationPhase::queued;
    return phase_.compare_exchange_strong(expected, NativeOperationPhase::expired);
}

void NativeOperationGate::finish()
{
    NativeOperationPhase expected = NativeOperationPhase::running;
    phase_.compare_exchange_strong(expected, NativeOperationPhase::finished);
}

NativeOperationPhase NativeOperationGate::phase() const
{
    return phase_.load();
}

}
