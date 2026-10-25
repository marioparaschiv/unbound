#include <cassert>
#include <thread>

#include "NativeOperationGate.h"

int main()
{
    loader::NativeOperationGate expired;
    assert(expired.expire());
    assert(!expired.start());
    assert(!expired.expire());
    assert(expired.phase() == loader::NativeOperationPhase::expired);

    loader::NativeOperationGate completed;
    assert(completed.start());
    assert(!completed.expire());
    completed.finish();
    assert(completed.phase() == loader::NativeOperationPhase::finished);

    for (int index = 0; index < 1000; index++)
    {
        loader::NativeOperationGate competing;
        bool                        started  = false;
        bool                        timedOut = false;
        std::thread                 operation([&]() {
            started = competing.start();
        });
        std::thread                 timeout([&]() {
            timedOut = competing.expire();
        });
        operation.join();
        timeout.join();
        assert(started != timedOut);
        if (started)
        {
            competing.finish();
            assert(competing.phase() == loader::NativeOperationPhase::finished);
        }
        else
        {
            assert(competing.phase() == loader::NativeOperationPhase::expired);
        }
    }
}
