#include <cassert>
#include <csignal>
#include <filesystem>
#include <functional>
#include <nlohmann/json.hpp>
#include <string>
#include <sys/wait.h>
#include <unistd.h>

#include "LoaderAddonActivity.h"
#include "LoaderCrashHandler.h"
#include "LoaderFiles.h"

namespace {
constexpr unsigned kChildDeadlineSeconds = 30;

volatile sig_atomic_t gPreviousCalls      = 0;
volatile sig_atomic_t gPreviousSignal     = 0;
volatile sig_atomic_t gPreviousHadContext = 0;

std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-crash-handler-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

std::string readFile(const std::filesystem::path &path)
{
    return loader::readTextFile(path.string()).value_or("");
}

void expect(bool condition, int failure)
{
    if (!condition)
    {
        _exit(failure);
    }
}

int runInChild(const std::function<void()> &body)
{
    pid_t child = fork();
    assert(child >= 0);
    if (child == 0)
    {
        alarm(kChildDeadlineSeconds);
        body();
        _exit(0);
    }
    int status = 0;
    assert(waitpid(child, &status, 0) == child);
    return status;
}

bool exitedCleanly(int status)
{
    return WIFEXITED(status) && WEXITSTATUS(status) == 0;
}

void countPlainCall(int signal)
{
    gPreviousCalls  = gPreviousCalls + 1;
    gPreviousSignal = signal;
}

void countInfoCall(int signal, siginfo_t *info, void *context)
{
    gPreviousCalls      = gPreviousCalls + 1;
    gPreviousSignal     = info ? info->si_signo : -signal;
    gPreviousHadContext = context != nullptr;
}

void installPlainHandler(int signal)
{
    struct sigaction previous = {};
    previous.sa_handler       = countPlainCall;
    sigemptyset(&previous.sa_mask);
    sigaction(signal, &previous, nullptr);
}

void installInfoHandler(int signal)
{
    struct sigaction previous = {};
    previous.sa_sigaction     = countInfoCall;
    previous.sa_flags         = SA_SIGINFO;
    sigemptyset(&previous.sa_mask);
    sigaction(signal, &previous, nullptr);
}

void unopenableMarkerLeavesTheHandlerUninstalled(const std::filesystem::path &root)
{
    int status = runInChild([&]() {
        installPlainHandler(SIGTRAP);
        expect(!loader::installAddonCrashHandler((root / "missing" / "running").string()), 10);
        raise(SIGTRAP);
        expect(gPreviousCalls == 1, 11);
        expect(!std::filesystem::exists(root / loader::kNativeCrashFile), 12);

        expect(loader::installAddonCrashHandler((root / "running").string()), 13);
        expect(std::filesystem::exists(root / "running"), 14);
        expect(std::filesystem::exists(root / loader::kNativeCrashFile), 15);
    });
    assert(exitedCleanly(status));
}

void installingTwiceKeepsTheFirstMarker(const std::filesystem::path &root)
{
    std::filesystem::path first  = root / "first";
    std::filesystem::path second = root / "second";
    std::filesystem::create_directories(first);
    std::filesystem::create_directories(second);
    assert(loader::writeTextFileAtomically((second / loader::kNativeCrashFile).string(), "kept"));

    int status = runInChild([&]() {
        expect(loader::installAddonCrashHandler((first / "running").string()), 20);
        expect(loader::installAddonCrashHandler((second / "running").string()), 21);
        expect(!std::filesystem::exists(second / "running"), 22);
        expect(readFile(second / loader::kNativeCrashFile) == "kept", 23);
        expect(loader::previousNativeCrash().empty(), 24);
    });
    assert(exitedCleanly(status));
}

void installClearsAStaleMarker(const std::filesystem::path &root)
{
    std::filesystem::path marker = root / "running";
    assert(loader::writeTextFileAtomically(marker.string(), R"({"id":"plugins:stale"})"));

    int status = runInChild([&]() {
        expect(loader::installAddonCrashHandler(marker.string()), 30);
        expect(readFile(marker).empty(), 31);
    });
    assert(exitedCleanly(status));
}

void onlyTheFirstCrashIsRecorded(const std::filesystem::path &root)
{
    std::filesystem::path marker = root / "running";

    int status = runInChild([&]() {
        installPlainHandler(SIGTRAP);
        loader::AddonSlot first  = loader::registerAddonSlot("plugins:first", "First");
        loader::AddonSlot second = loader::registerAddonSlot("plugins:second", "Second");
        expect(loader::installAddonCrashHandler(marker.string()), 40);

        {
            loader::AddonScope scope(first);
            raise(SIGTRAP);
        }
        expect(gPreviousCalls == 1 && gPreviousSignal == SIGTRAP, 41);
        std::string record = readFile(marker);
        std::string stack  = readFile(root / loader::kNativeCrashFile);
        expect(nlohmann::json::parse(record, nullptr, false) ==
                   nlohmann::json({{"id", "plugins:first"}, {"name", "First"}}),
               42);
        expect(stack.rfind("Signal " + std::to_string(SIGTRAP) + "\n", 0) == 0, 43);

        {
            loader::AddonScope scope(second);
            raise(SIGTRAP);
        }
        expect(gPreviousCalls == 2, 44);
        expect(readFile(marker) == record, 45);
        expect(readFile(root / loader::kNativeCrashFile) == stack, 46);
    });
    assert(exitedCleanly(status));
}

void forwardsToASiginfoHandler(const std::filesystem::path &root)
{
    int status = runInChild([&]() {
        installInfoHandler(SIGILL);
        expect(loader::installAddonCrashHandler((root / "running").string()), 50);
        raise(SIGILL);
        expect(gPreviousCalls == 1, 51);
        expect(gPreviousSignal == SIGILL, 52);
        expect(gPreviousHadContext == 1, 53);
        expect(readFile(root / "running").empty(), 54);
        expect(readFile(root / loader::kNativeCrashFile)
                       .rfind("Signal " + std::to_string(SIGILL) + "\n", 0) == 0,
               55);
    });
    assert(exitedCleanly(status));
}

void ignoredSignalsFallBackToTheDefaultAction(const std::filesystem::path &root)
{
    int status = runInChild([&]() {
        signal(SIGFPE, SIG_IGN);
        expect(loader::installAddonCrashHandler((root / "running").string()), 60);
        raise(SIGFPE);
        _exit(61);
    });
    assert(WIFSIGNALED(status) && WTERMSIG(status) == SIGFPE);
    assert(readFile(root / loader::kNativeCrashFile)
               .rfind("Signal " + std::to_string(SIGFPE) + "\n", 0) == 0);
}

void bareMarkerPathWritesTheStackInTheWorkingDirectory(const std::filesystem::path &root)
{
    int status = runInChild([&]() {
        installPlainHandler(SIGTRAP);
        expect(chdir(root.c_str()) == 0, 70);
        expect(loader::installAddonCrashHandler("running"), 71);
        raise(SIGTRAP);
        expect(gPreviousCalls == 1, 72);
    });
    assert(exitedCleanly(status));
    assert(std::filesystem::exists(root / "running"));
    assert(readFile(root / loader::kNativeCrashFile)
               .rfind("Signal " + std::to_string(SIGTRAP) + "\n", 0) == 0);
}

}

int main()
{
    const auto root = makeTemporaryDirectory();
    const auto run  = [&](const char *name, void (*test)(const std::filesystem::path &)) {
        std::filesystem::path directory = root / name;
        std::filesystem::create_directories(directory);
        test(directory);
    };

    run("unopenable", unopenableMarkerLeavesTheHandlerUninstalled);
    run("twice", installingTwiceKeepsTheFirstMarker);
    run("stale", installClearsAStaleMarker);
    run("first-crash", onlyTheFirstCrashIsRecorded);
    run("siginfo", forwardsToASiginfoHandler);
    run("ignored", ignoredSignalsFallBackToTheDefaultAction);
    run("bare", bareMarkerPathWritesTheStackInTheWorkingDirectory);

    std::filesystem::remove_all(root);
    return 0;
}
