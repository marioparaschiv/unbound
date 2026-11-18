#include <cassert>
#include <filesystem>
#include <functional>
#include <stdexcept>
#include <string>
#include <sys/wait.h>
#include <unistd.h>

#include "LoaderAbortDetails.h"
#include "LoaderCrashHandler.h"
#include "LoaderFiles.h"

extern "C" const char *__asan_default_options()
{
    return "use_sigaltstack=0";
}

#if defined(__APPLE__)
struct TestAnnotations {
    uint64_t version;
    uint64_t message;
    uint64_t signature;
    uint64_t backtrace;
    uint64_t message2;
    uint64_t thread;
    uint64_t dialogMode;
    uint64_t abortCause;
};

__attribute__((used, section("__DATA,__crash_info"))) TestAnnotations gTestAnnotations = {5};
#endif

namespace {
std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-abort-details-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

std::string pendingStack(const std::filesystem::path &root)
{
    return loader::readTextFile((root / loader::kPendingNativeCrashFile).string()).value_or("");
}

int runInChild(const std::function<void()> &body)
{
    pid_t child = fork();
    assert(child >= 0);
    if (child == 0)
    {
        alarm(30);
        body();
        _exit(0);
    }

    int status = 0;
    assert(waitpid(child, &status, 0) == child);
    return status;
}

void describesTheExceptionBeingHandled()
{
    assert(loader::describeCurrentException().empty());

    try
    {
        throw std::runtime_error("boom");
    }
    catch (...)
    {
        assert(loader::describeCurrentException() == "std::runtime_error: boom");
    }

    try
    {
        throw 7;
    }
    catch (...)
    {
        assert(loader::describeCurrentException() == "int");
    }
}

void recordsAnUncaughtCxxException(const std::filesystem::path &root)
{
    int status = runInChild([&]() {
        loader::installAddonCrashHandler((root / "running").string());
        throw std::logic_error("bad state");
    });

    assert(WIFSIGNALED(status));
    std::string stack = pendingStack(root);
    assert(stack.find("Exception C++ std::logic_error: bad state\n") != std::string::npos);
}

#if defined(__APPLE__)
void recordsAbortMessages(const std::filesystem::path &root)
{
    static const char message[] = "Fatal error: Unexpectedly found nil\nwhile unwrapping";

    int status = runInChild([&]() {
        loader::installAddonCrashHandler((root / "running").string());
        gTestAnnotations.message = reinterpret_cast<uint64_t>(message);
        abort();
    });

    assert(WIFSIGNALED(status));
    std::string stack = pendingStack(root);
    assert(stack.find("Abort Fatal error: Unexpectedly found nil while unwrapping\n")
           != std::string::npos);
}
#endif
}

int main()
{
    describesTheExceptionBeingHandled();
    recordsAnUncaughtCxxException(makeTemporaryDirectory());
#if defined(__APPLE__)
    recordsAbortMessages(makeTemporaryDirectory());
#endif
    return 0;
}
