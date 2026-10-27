#include "LoaderCrashHandler.h"

#include <array>
#include <atomic>
#include <cerrno>
#include <csignal>
#include <dlfcn.h>
#include <fcntl.h>
#include <mutex>
#include <unistd.h>

#include "LoaderAddonActivity.h"
#include "LoaderLog.h"

namespace loader {
static constexpr std::array<int, 6> kCrashSignals = {SIGSEGV, SIGBUS, SIGABRT,
                                                     SIGILL,  SIGFPE, SIGTRAP};

static std::array<struct sigaction, kCrashSignals.size()> gPreviousActions;
static std::atomic<int>                                   gMarkerDescriptor{-1};
static std::atomic_bool                                   gRecorded{false};
static std::atomic_bool                                   gInstalled{false};

static int crashSignalIndex(int signal)
{
    for (size_t index = 0; index < kCrashSignals.size(); index++)
    {
        if (kCrashSignals[index] == signal)
        {
            return static_cast<int>(index);
        }
    }
    return -1;
}

static void raiseWithDefaultAction(int signal)
{
    struct sigaction fallback = {};
    fallback.sa_handler       = SIG_DFL;
    sigemptyset(&fallback.sa_mask);
    sigaction(signal, &fallback, nullptr);
    raise(signal);
}

static void forwardToPreviousHandler(int signal, siginfo_t *info, void *context)
{
    int index = crashSignalIndex(signal);
    if (index < 0)
    {
        raiseWithDefaultAction(signal);
        return;
    }

    const struct sigaction &previous = gPreviousActions[static_cast<size_t>(index)];
    if (previous.sa_flags & SA_SIGINFO)
    {
        if (previous.sa_sigaction)
        {
            previous.sa_sigaction(signal, info, context);
            return;
        }
    }
    else if (previous.sa_handler != SIG_DFL && previous.sa_handler != SIG_IGN)
    {
        previous.sa_handler(signal);
        return;
    }
    raiseWithDefaultAction(signal);
}

static void recordCrashingAddon(int signal, siginfo_t *info, void *context)
{
    int savedErrno = errno;
    int descriptor = gMarkerDescriptor.load(std::memory_order_acquire);
    if (descriptor >= 0 && !gRecorded.exchange(true))
    {
        writeCrashingAddonRecord(descriptor);
    }
    errno = savedErrno;
    forwardToPreviousHandler(signal, info, context);
}

static std::string describeHandler(const struct sigaction &action)
{
    void *address = (action.sa_flags & SA_SIGINFO) ? reinterpret_cast<void *>(action.sa_sigaction)
                                                   : reinterpret_cast<void *>(action.sa_handler);
    if (address == reinterpret_cast<void *>(SIG_DFL))
    {
        return "the default action";
    }
    if (address == reinterpret_cast<void *>(SIG_IGN))
    {
        return "an ignored action";
    }

    Dl_info info = {};
    if (dladdr(address, &info) && info.dli_fname)
    {
        std::string image = info.dli_fname;
        size_t      slash = image.find_last_of('/');
        image             = slash == std::string::npos ? image : image.substr(slash + 1);
        return info.dli_sname ? std::string(info.dli_sname) + " in " + image : image;
    }
    return "an unnamed handler";
}

bool installAddonCrashHandler(const std::string &markerPath)
{
    static std::mutex           mutex;
    std::lock_guard<std::mutex> lock(mutex);
    if (gInstalled.load())
    {
        return true;
    }

    int descriptor = open(markerPath.c_str(), O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC, 0600);
    if (descriptor < 0)
    {
        log(LogLevel::Error, LOG_CATEGORY_PLUGINS,
            "The addon crash marker could not be opened, so crashes after an addon starts are "
            "not attributed.");
        return false;
    }
    gMarkerDescriptor.store(descriptor, std::memory_order_release);

    struct sigaction action = {};
    action.sa_sigaction     = recordCrashingAddon;
    action.sa_flags         = SA_SIGINFO | SA_ONSTACK;
    sigemptyset(&action.sa_mask);

    for (size_t index = 0; index < kCrashSignals.size(); index++)
    {
        sigaction(kCrashSignals[index], &action, &gPreviousActions[index]);
    }
    gInstalled.store(true);

    log(LogLevel::Info, LOG_CATEGORY_PLUGINS,
        "Addon crash attribution is installed; SIGSEGV continues to " +
            describeHandler(gPreviousActions[static_cast<size_t>(crashSignalIndex(SIGSEGV))]) +
            " and SIGABRT to " +
            describeHandler(gPreviousActions[static_cast<size_t>(crashSignalIndex(SIGABRT))]) +
            ".");
    return true;
}

bool addonCrashHandlerInstalled()
{
    return gInstalled.load();
}
}
