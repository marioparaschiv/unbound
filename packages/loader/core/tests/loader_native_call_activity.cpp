#include <cassert>
#include <cstdio>
#include <optional>
#include <string>
#include <thread>
#include <unistd.h>

#include "LoaderAddonActivity.h"
#include "NativeCallActivity.h"

static std::optional<loader::NativeCallSnapshot> readFromAnotherThread(uintptr_t thread)
{
    std::optional<loader::NativeCallSnapshot> seen;
    std::thread reader([&] {
        seen = loader::nativeCallOnThread(thread);
    });
    reader.join();
    return seen;
}

static void reportsNothingOutsideACall()
{
    uintptr_t thread = loader::currentActivityThread();

    assert(!loader::nativeCallOnThread(thread));
    assert(loader::describeNativeCall(std::nullopt, 0)
           == "It is running JavaScript, outside any native call.");
}

static void reportsTheInnermostCallAndRestoresTheOuterOne()
{
    uintptr_t thread = loader::currentActivityThread();
    {
        loader::NativeCallScope outer("invoke", "getBackground");
        auto seen = readFromAnotherThread(thread);
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

    assert(loader::describeNativeCall(call, 3500)
           == "It has been inside the native call findViews(UIImageView) for 2500 ms.");
}

static void capsLongLabels()
{
    std::string detail(200, 'x');
    loader::NativeCallScope scope("invoke", detail);
    auto seen = readFromAnotherThread(loader::currentActivityThread());

    assert(seen && seen->label.size() == loader::kNativeCallLabelLimit - 1);
}

static std::string crashLine(bool insideCall)
{
    int pipes[2];
    assert(pipe(pipes) == 0);
    bool written = false;
    if (insideCall)
    {
        loader::NativeCallScope scope("call", "setFrame:");
        written = loader::writeCrashingNativeCallLine(pipes[1]);
    }
    else
    {
        written = loader::writeCrashingNativeCallLine(pipes[1]);
    }

    close(pipes[1]);
    char buffer[256] = {};
    ssize_t length   = read(pipes[0], buffer, sizeof(buffer) - 1);
    close(pipes[0]);
    return written && length > 0 ? std::string(buffer, static_cast<size_t>(length)) : "";
}

static void writesTheCallACrashHappenedIn()
{
    assert(crashLine(true) == "Native call call(setFrame:)\n");
    assert(crashLine(false).empty());
}

static void writesEachPluginsRecentBridgeCalls()
{
    loader::AddonSlot slot = loader::registerAddonSlot("unbound.bridgey", "Bridgey");
    {
        loader::AddonScope addon(slot);
        for (const char *selector : {"a", "b", "c", "d", "e", "f"})
        {
            loader::NativeCallScope scope("objc.invoke", selector);
        }
    }

    FILE *file = tmpfile();
    assert(loader::writeRecentBridgeCallLines(fileno(file)));
    rewind(file);
    char buffer[1024] = {};
    std::string text(buffer, fread(buffer, 1, sizeof(buffer) - 1, file));
    fclose(file);
    assert(text.find("Bridge calls {\"id\":\"unbound.bridgey\"") == 0);
    assert(text.find("objc.invoke(b) | objc.invoke(c) | objc.invoke(d) | objc.invoke(e) | "
                     "objc.invoke(f)\n")
           != std::string::npos);
    assert(text.find("objc.invoke(a)") == std::string::npos);

    FILE *later = tmpfile();
    assert(!loader::writeRecentBridgeCallLines(fileno(later), loader::nativeCallClock() + 60000));
    fclose(later);
}

int main()
{
    reportsNothingOutsideACall();
    reportsTheInnermostCallAndRestoresTheOuterOne();
    describesHowLongTheCallHasRun();
    capsLongLabels();
    writesTheCallACrashHappenedIn();
    writesEachPluginsRecentBridgeCalls();
    return 0;
}
