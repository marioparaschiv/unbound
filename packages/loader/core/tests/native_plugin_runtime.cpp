#include "NativePluginRuntime.h"

#include <cassert>
#include <stdexcept>
#include <vector>

using loader::native::describeFailure;
using loader::native::NativeCodedError;
using loader::native::NativeFailure;
using loader::native::RuntimeGenerationTracker;

static NativeFailure describeThrown(const std::function<void()> &body)
{
    try
    {
        body();
    }
    catch (...)
    {
        return describeFailure(std::current_exception());
    }
    return describeFailure(nullptr);
}

int main()
{
    NativeFailure coded = describeThrown([] { throw NativeCodedError("NATIVE_MAIN_THREAD_TIMEOUT", "late"); });
    assert(coded.code == "NATIVE_MAIN_THREAD_TIMEOUT");
    assert(coded.message == "late");

    NativeFailure generic = describeThrown([] { throw std::invalid_argument("frame width must be finite"); });
    assert(generic.code == "NATIVE_BRIDGE_ERROR");
    assert(generic.message == "frame width must be finite");

    NativeFailure silent = describeThrown([] { throw std::runtime_error(""); });
    assert(silent.code == "NATIVE_BRIDGE_ERROR");
    assert(silent.message == "Native operation failed");

    NativeFailure unknown = describeThrown([] { throw 7; });
    assert(unknown.code == "NATIVE_BRIDGE_ERROR");
    assert(unknown.message == "Native operation failed");

    NativeFailure none = describeFailure(nullptr);
    assert(none.code == "NATIVE_BRIDGE_ERROR");

    RuntimeGenerationTracker tracker;
    int                      first  = 0;
    int                      second = 0;
    assert(tracker.generation() == 0);
    assert(tracker.advance(&first) == 1u);
    assert(!tracker.advance(&first));
    assert(tracker.generation() == 1);

    std::vector<uint64_t> observed;
    tracker.addListener([&](uint64_t generation) { observed.push_back(generation); });
    tracker.addListener([](uint64_t) { throw std::runtime_error("listener failure is contained"); });
    tracker.addListener([&](uint64_t generation) { observed.push_back(generation * 10); });

    auto advanced = tracker.advance(&second);
    assert(advanced == 2u);
    tracker.notify(*advanced);
    assert((observed == std::vector<uint64_t>{2, 20}));

    assert(tracker.advance(&first) == 3u);
    assert(tracker.generation() == 3);
}
