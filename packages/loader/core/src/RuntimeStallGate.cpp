#include "RuntimeStallGate.h"

namespace loader::native {
bool RuntimeStallGate::stalled() const
{
    return stalled_.load(std::memory_order_acquire);
}

void RuntimeStallGate::timedOut()
{
    stalled_.store(true, std::memory_order_release);
}

void RuntimeStallGate::answered()
{
    stalled_.store(false, std::memory_order_release);
}
}
