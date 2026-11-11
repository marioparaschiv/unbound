#include "LoaderCrashHandler.h"

#include <array>
#include <atomic>
#include <cerrno>
#include <csignal>
#include <dlfcn.h>
#include <fcntl.h>
#include <mutex>
#if defined(__APPLE__)
#include <sys/ucontext.h>
#else
#include <ucontext.h>
#endif
#include <unistd.h>

#include "LoaderAddonActivity.h"
#include "LoaderFiles.h"
#include "LoaderLog.h"

namespace loader {
static constexpr std::array<int, 6> kCrashSignals = {SIGSEGV, SIGBUS, SIGABRT,
                                                     SIGILL,  SIGFPE, SIGTRAP};

static std::array<struct sigaction, kCrashSignals.size()> gPreviousActions;
static std::atomic<int>                                   gMarkerDescriptor{-1};
static std::atomic_bool                                   gRecorded{false};
static std::atomic_bool                                   gInstalled{false};
static std::atomic<int>                                   gStackDescriptor{-1};
static std::string                                        gPreviousNativeCrash;
static constexpr size_t                                   kMaxNativeFrames = 32;

static void writeText(int descriptor, const char *text)
{
    size_t length = 0;
    while (text[length])
    {
        length++;
    }
    while (length > 0)
    {
        ssize_t written = write(descriptor, text, length);
        if (written <= 0)
        {
            return;
        }
        text += written;
        length -= static_cast<size_t>(written);
    }
}

static void writeHex(int descriptor, uintptr_t value)
{
    char  digits[2 + sizeof(uintptr_t) * 2 + 1];
    char *end    = digits + sizeof(digits) - 1;
    *end         = '\0';
    char *cursor = end;
    do
    {
        *--cursor = "0123456789abcdef"[value & 0xf];
        value >>= 4;
    } while (value && cursor > digits + 2);
    *--cursor = 'x';
    *--cursor = '0';
    writeText(descriptor, cursor);
}

static void writeDecimal(int descriptor, unsigned value)
{
    char  digits[12];
    char *cursor = digits + sizeof(digits) - 1;
    *cursor      = '\0';
    do
    {
        *--cursor = static_cast<char>('0' + value % 10);
        value /= 10;
    } while (value);
    writeText(descriptor, cursor);
}

// The crashing pc, the return address and the saved frame pointer, where this platform's context
// exposes them.
static bool crashRegisters(void *context, uintptr_t &pc, uintptr_t &lr, uintptr_t &fp)
{
    if (!context)
    {
        return false;
    }
    auto *ucontext = static_cast<ucontext_t *>(context);
#if defined(__APPLE__) && defined(__arm64__)
    pc = static_cast<uintptr_t>(__darwin_arm_thread_state64_get_pc(ucontext->uc_mcontext->__ss));
    lr = static_cast<uintptr_t>(__darwin_arm_thread_state64_get_lr(ucontext->uc_mcontext->__ss));
    fp = static_cast<uintptr_t>(__darwin_arm_thread_state64_get_fp(ucontext->uc_mcontext->__ss));
    return true;
#elif defined(__linux__) && defined(__aarch64__)
    pc = static_cast<uintptr_t>(ucontext->uc_mcontext.pc);
    lr = static_cast<uintptr_t>(ucontext->uc_mcontext.regs[30]);
    fp = static_cast<uintptr_t>(ucontext->uc_mcontext.regs[29]);
    return true;
#elif defined(__linux__) && defined(__x86_64__)
    pc = static_cast<uintptr_t>(ucontext->uc_mcontext.gregs[REG_RIP]);
    lr = 0;
    fp = static_cast<uintptr_t>(ucontext->uc_mcontext.gregs[REG_RBP]);
    return true;
#else
    (void) ucontext;
    return false;
#endif
}

static void writeFrame(int descriptor, size_t index, uintptr_t address)
{
    writeText(descriptor, "#");
    writeDecimal(descriptor, static_cast<unsigned>(index));
    writeText(descriptor, " ");
    writeHex(descriptor, address);
    // Best effort: the process is already going down, and an image offset is what makes the
    // address useful in a report.
    Dl_info info = {};
    if (dladdr(reinterpret_cast<void *>(address), &info) && info.dli_fname)
    {
        const char *image = info.dli_fname;
        for (const char *cursor = image; *cursor; cursor++)
        {
            if (*cursor == '/')
            {
                image = cursor + 1;
            }
        }
        writeText(descriptor, " ");
        writeText(descriptor, image);
        writeText(descriptor, " + ");
        writeHex(descriptor, address - reinterpret_cast<uintptr_t>(info.dli_fbase));
        if (info.dli_sname)
        {
            writeText(descriptor, " ");
            writeText(descriptor, info.dli_sname);
        }
    }
    writeText(descriptor, "\n");
}

// Async-signal-safe apart from dladdr: walks the frame-pointer chain of the crashing thread.
static void writeNativeStack(int signal, void *context)
{
    int descriptor = gStackDescriptor.exchange(-1);
    if (descriptor < 0)
    {
        return;
    }
    writeText(descriptor, "Signal ");
    writeDecimal(descriptor, static_cast<unsigned>(signal));
    writeText(descriptor, "\n");

    uintptr_t pc = 0, lr = 0, fp = 0;
    if (crashRegisters(context, pc, lr, fp))
    {
        size_t index = 0;
        writeFrame(descriptor, index++, pc);
        if (lr)
        {
            writeFrame(descriptor, index++, lr);
        }
        for (; index < kMaxNativeFrames && fp && (fp % sizeof(uintptr_t)) == 0; index++)
        {
            const auto *frame    = reinterpret_cast<const uintptr_t *>(fp);
            uintptr_t   next     = frame[0];
            uintptr_t   returnTo = frame[1];
            if (!returnTo)
            {
                break;
            }
            writeFrame(descriptor, index, returnTo);
            // Frames grow towards higher addresses as the walk unwinds; anything else is corrupt.
            if (next <= fp || next - fp > 1024 * 1024)
            {
                break;
            }
            fp = next;
        }
    }
    fsync(descriptor);
    close(descriptor);
}

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
    writeNativeStack(signal, context);
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

    size_t      slash = markerPath.find_last_of('/');
    std::string stackPath =
        joinPath(slash == std::string::npos ? "." : markerPath.substr(0, slash), kNativeCrashFile);
    gPreviousNativeCrash = readTextFile(stackPath).value_or("");
    int stack            = open(stackPath.c_str(), O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC, 0600);
    gStackDescriptor.store(stack, std::memory_order_release);

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

std::string previousNativeCrash()
{
    return gPreviousNativeCrash;
}

bool adoptPreviousNativeCrash(const std::string &stack)
{
    if (stack.empty() || !gPreviousNativeCrash.empty())
    {
        return false;
    }
    gPreviousNativeCrash = stack;
    return true;
}
}
