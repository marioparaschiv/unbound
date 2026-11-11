#include <cassert>
#include <csignal>
#include <cstdlib>
#include <filesystem>
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
    std::string           marker    = (directory / "running").string();

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
        loader::readTextFile((directory / loader::kNativeCrashFile).string());
    assert(stack && stack->rfind("Signal 11\n#0 0x", 0) == 0);

    // The next process reads it before its own handler starts a fresh file.
    assert(loader::installAddonCrashHandler(marker));
    assert(loader::previousNativeCrash() == *stack);
    assert(loader::readTextFile((directory / loader::kNativeCrashFile).string()) == "");
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
    assert(url.find("Native%20stack") != std::string::npos ||
           url.find("Native+stack") != std::string::npos);
    assert(url.find("%230%20") != std::string::npos || url.find("%230+") != std::string::npos);
}
}

int main()
{
    writesTheCrashingStackForTheNextLaunch();
    keepsTheInnermostFramesInAReport();
    return 0;
}
