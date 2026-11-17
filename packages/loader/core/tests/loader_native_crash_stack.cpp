#include <cassert>
#include <csignal>
#include <cstdlib>
#include <filesystem>
#include <pthread.h>
#include <string>
#include <sys/wait.h>
#include <unistd.h>

#include "LoaderCrashHandler.h"
#include "LoaderCrashReport.h"
#include "LoaderFiles.h"

namespace {
std::filesystem::path temporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-native-stack-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return directory;
}

[[gnu::noinline]] void crash()
{
    raise(SIGSEGV);
}

void writesTheCrashingStackForTheNextLaunch()
{
    std::filesystem::path directory = temporaryDirectory();
    std::string marker              = (directory / "running").string();

    pid_t child = fork();
    assert(child >= 0);
    if (child == 0)
    {
        // A sanitizer's own SEGV handler would report and exit instead of dying on the signal.
        signal(SIGSEGV, SIG_DFL);
        if (!loader::installAddonCrashHandler(marker))
        {
            _exit(2);
        }

        crash();
        _exit(3);
    }

    int status = 0;
    waitpid(child, &status, 0);
    assert(WIFSIGNALED(status) && WTERMSIG(status) == SIGSEGV);

    std::optional<std::string> stack =
        loader::readTextFile((directory / loader::kPendingNativeCrashFile).string());
    assert(stack && stack->rfind("Signal 11\nImage ", 0) == 0);
    assert(stack->find("\n#0 0x") != std::string::npos);

    assert(loader::installAddonCrashHandler(marker));
    assert(loader::previousNativeCrash() == *stack);
    assert(loader::readTextFile((directory / loader::kPendingNativeCrashFile).string()) == "");
    assert(loader::readTextFile((directory / loader::kNativeCrashFile).string()) == *stack);
    assert(loader::nativeCrashRecorded(directory.string()));
    std::filesystem::remove_all(directory);
}

void keepsTheInnermostFramesInAReport()
{
    std::string stack = "Signal 11\n";
    for (int frame = 0; frame < 400; frame++)
    {
        stack += "#" + std::to_string(frame) + " 0x1000 libsomething.so + 0x1000 symbol\n";
    }

    loader::toolbox::IssueReport environment{"Android", {{"Unbound", "loader 1.1.1"}}, {}};
    std::string url = loader::crashReportURL(environment, "Discord crashed.", "", stack);
    assert(url.size() <= loader::kCrashReportURLLength);
    assert(url.find("Native%20stack") != std::string::npos
           || url.find("Native+stack") != std::string::npos);
    assert(url.find("%230%20") != std::string::npos || url.find("%230+") != std::string::npos);
}

#if defined(__APPLE__) && defined(__arm64__)
void *parkNamedThread(void *)
{
    pthread_setname_np("loader.test.worker");
    pause();
    return nullptr;
}

void writesRegistersAndEveryThreadOnApple()
{
    std::filesystem::path directory = temporaryDirectory();
    std::string marker              = (directory / "running").string();

    pid_t child = fork();
    assert(child >= 0);
    if (child == 0)
    {
        signal(SIGSEGV, SIG_DFL);
        if (!loader::installAddonCrashHandler(marker))
        {
            _exit(2);
        }

        pthread_t worker;
        pthread_create(&worker, nullptr, parkNamedThread, nullptr);
        usleep(100 * 1000);
        crash();
        _exit(3);
    }

    int status = 0;
    waitpid(child, &status, 0);
    assert(WIFSIGNALED(status) && WTERMSIG(status) == SIGSEGV);

    std::optional<std::string> stack =
        loader::readTextFile((directory / loader::kPendingNativeCrashFile).string());
    assert(stack && stack->rfind("Signal 11\n", 0) == 0);
    assert(stack->find("\nRegisters x0=0x") != std::string::npos);
    assert(stack->find(" pc=0x") != std::string::npos);
    size_t thread = stack->find(" loader.test.worker\n#0 0x");
    assert(thread != std::string::npos);
    assert(stack->find("\n#0 0x") < stack->find("\nRegisters "));
}
#endif
}

int main()
{
#if defined(__APPLE__) && defined(__arm64__)
    writesRegistersAndEveryThreadOnApple();
#endif
    writesTheCrashingStackForTheNextLaunch();
    keepsTheInnermostFramesInAReport();
    return 0;
}
