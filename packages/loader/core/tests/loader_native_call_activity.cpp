#include <cassert>
#include <optional>
#include <string>
#include <thread>

#include "LoaderAddonActivity.h"
#include "NativeCallActivity.h"

static std::optional<loader::NativeCallSnapshot> readFromAnotherThread(uintptr_t thread)
{
    std::optional<loader::NativeCallSnapshot> seen;
    std::thread                               reader([&] {
        seen = loader::nativeCallOnThread(thread);
    });
    reader.join();
    return seen;
}

static void reportsNothingOutsideACall()
{
    uintptr_t thread = loader::currentActivityThread();

    assert(!loader::nativeCallOnThread(thread));
    assert(loader::describeNativeCall(std::nullopt, 0) ==
           "It is running JavaScript, outside any native call.");
}

static void reportsTheInnermostCallAndRestoresTheOuterOne()
{
    uintptr_t thread = loader::currentActivityThread();
    {
        loader::NativeCallScope outer("invoke", "getBackground");
        auto                    seen = readFromAnotherThread(thread);
        assert(seen && seen->label == "invoke(getBackground)");
        {
            loader::NativeCallScope inner("call", "");
            assert(readFromAnotherThread(thread)->label == "call");
        }
        assert(readFromAnotherThread(thread)->label == "invoke(getBackground)");
    }
    assert(!readFromAnotherThread(thread));
}

static void describesHowLongTheCallHasRun()
{
    loader::NativeCallSnapshot call{"findViews(UIImageView)", 1000};

    assert(loader::describeNativeCall(call, 3500) ==
           "It has been inside the native call findViews(UIImageView) for 2500 ms.");
}

static void capsLongLabels()
{
    std::string             detail(200, 'x');
    loader::NativeCallScope scope("invoke", detail);
    auto                    seen = readFromAnotherThread(loader::currentActivityThread());

    assert(seen && seen->label.size() == loader::kNativeCallLabelLimit - 1);
}

int main()
{
    reportsNothingOutsideACall();
    reportsTheInnermostCallAndRestoresTheOuterOne();
    describesHowLongTheCallHasRun();
    capsLongLabels();
    return 0;
}
