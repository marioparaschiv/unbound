#include <cassert>

#include "RuntimeStallGate.h"

int main()
{
    loader::native::RuntimeStallGate gate;
    assert(!gate.stalled());

    gate.timedOut();
    assert(gate.stalled());

    gate.timedOut();
    gate.answered();
    assert(!gate.stalled());

    return 0;
}
