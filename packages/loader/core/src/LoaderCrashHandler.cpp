#include "LoaderCrashHandler.h"

#include <algorithm>
#include <array>
#include <atomic>
#include <cerrno>
#include <csignal>
#include <cstring>
#include <dlfcn.h>
#include <fcntl.h>
#include <mutex>
#include <string>
#include <sys/stat.h>
#include <utility>
#if defined(__APPLE__)
#include <mach/mach.h>
#include <pthread.h>
#include <sys/ucontext.h>
#else
#include <ucontext.h>
#endif
#include <unistd.h>

#if defined(__ANDROID__)
#include <android/set_abort_message.h>
#endif

#include "LoaderAddonActivity.h"
#include "LoaderFiles.h"
#include "LoaderImageIdentity.h"
#include "LoaderLaunchReport.h"
#include "LoaderLog.h"

namespace loader {
static constexpr std::array<int, 6> kCrashSignals = {SIGSEGV, SIGBUS, SIGABRT,
                                                     SIGILL,  SIGFPE, SIGTRAP};

static std::array<struct sigaction, kCrashSignals.size()> gPreviousActions;
static std::array<struct sigaction, kCrashSignals.size()> gOriginalActions;
static std::atomic_bool gHandling{false};
static std::atomic<int> gMarkerDescriptor{-1};
static std::atomic_bool gRecorded{false};
static char gImageLine[256];
static size_t gImageLineLength = 0;
static std::atomic_bool gInstalled{false};
static std::atomic<int> gStackDescriptor{-1};
static std::string gPreviousNativeCrash;
static constexpr size_t kMaxNativeFrames = 32;
static constexpr size_t kMaxThreadFrames = 24;
static constexpr size_t kMaxOtherThreads = 64;
static constexpr uintptr_t kMaxFrameSpan = 1024 * 1024;
static char gException[512];
static std::atomic<size_t> gExceptionLength{0};

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
    char digits[2 + sizeof(uintptr_t) * 2 + 1];
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
    char digits[12];
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

static bool readWord(uintptr_t address, uintptr_t &value)
{
    if (!address || (address % sizeof(uintptr_t)) != 0)
    {
        return false;
    }

#if defined(__APPLE__)
    vm_size_t copied = 0;
    return vm_read_overwrite(mach_task_self(), static_cast<vm_address_t>(address), sizeof(value),
                             reinterpret_cast<vm_address_t>(&value), &copied)
               == KERN_SUCCESS
           && copied == sizeof(value);
#else
    value = *reinterpret_cast<const uintptr_t *>(address);
    return true;
#endif
}

static void writeFramesFrom(int descriptor, uintptr_t pc, uintptr_t lr, uintptr_t fp, size_t limit)
{
    size_t index = 0;
    writeFrame(descriptor, index++, pc);
    if (lr)
    {
        writeFrame(descriptor, index++, lr);
    }

    for (; index < limit; index++)
    {
        uintptr_t next = 0, returnTo = 0;
        if (!readWord(fp, next) || !readWord(fp + sizeof(uintptr_t), returnTo) || !returnTo)
        {
            break;
        }

        writeFrame(descriptor, index, returnTo);
        if (next <= fp || next - fp > kMaxFrameSpan)
        {
            break;
        }

        fp = next;
    }
}

#if defined(__APPLE__) && defined(__arm64__)
static void writeRegister(int descriptor, const char *name, uintptr_t value)
{
    writeText(descriptor, " ");
    writeText(descriptor, name);
    writeText(descriptor, "=");
    writeHex(descriptor, value);
}

static void writeCrashRegisters(int descriptor, void *context)
{
    if (!context)
    {
        return;
    }

    const auto *machine               = static_cast<ucontext_t *>(context)->uc_mcontext;
    const auto &state                 = machine->__ss;
    static const char *const kNames[] = {"x0",  "x1",  "x2",  "x3",  "x4",  "x5",  "x6",  "x7",
                                         "x8",  "x9",  "x10", "x11", "x12", "x13", "x14", "x15",
                                         "x16", "x17", "x18", "x19", "x20", "x21", "x22", "x23",
                                         "x24", "x25", "x26", "x27", "x28"};
    writeText(descriptor, "Registers");
    for (size_t index = 0; index < std::size(kNames); index++)
    {
        writeRegister(descriptor, kNames[index], static_cast<uintptr_t>(state.__x[index]));
    }

    writeRegister(descriptor, "fp",
                  static_cast<uintptr_t>(__darwin_arm_thread_state64_get_fp(state)));
    writeRegister(descriptor, "lr",
                  static_cast<uintptr_t>(__darwin_arm_thread_state64_get_lr(state)));
    writeRegister(descriptor, "sp",
                  static_cast<uintptr_t>(__darwin_arm_thread_state64_get_sp(state)));
    writeRegister(descriptor, "pc",
                  static_cast<uintptr_t>(__darwin_arm_thread_state64_get_pc(state)));
    writeRegister(descriptor, "far", static_cast<uintptr_t>(machine->__es.__far));
    writeRegister(descriptor, "esr", static_cast<uintptr_t>(machine->__es.__esr));
    writeText(descriptor, "\n");
}

static void writeThread(int descriptor, size_t number, thread_t thread)
{
    arm_thread_state64_t state       = {};
    mach_msg_type_number_t stateSize = ARM_THREAD_STATE64_COUNT;
    if (thread_get_state(thread, ARM_THREAD_STATE64, reinterpret_cast<thread_state_t>(&state),
                         &stateSize)
        != KERN_SUCCESS)
    {
        return;
    }

    writeText(descriptor, "Thread ");
    writeDecimal(descriptor, static_cast<unsigned>(number));
    char name[64] = {};
    if (pthread_t handle = pthread_from_mach_thread_np(thread);
        handle && pthread_getname_np(handle, name, sizeof(name)) == 0 && name[0])
    {
        writeText(descriptor, " ");
        writeText(descriptor, name);
    }

    writeText(descriptor, "\n");
    writeFramesFrom(descriptor, static_cast<uintptr_t>(__darwin_arm_thread_state64_get_pc(state)),
                    static_cast<uintptr_t>(__darwin_arm_thread_state64_get_lr(state)),
                    static_cast<uintptr_t>(__darwin_arm_thread_state64_get_fp(state)),
                    kMaxThreadFrames);
}

static void writeOtherThreads(int descriptor)
{
    thread_act_array_t threads   = nullptr;
    mach_msg_type_number_t count = 0;
    if (task_threads(mach_task_self(), &threads, &count) != KERN_SUCCESS)
    {
        return;
    }

    thread_t self = mach_thread_self();
    for (mach_msg_type_number_t index = 0; index < count; index++)
    {
        if (threads[index] != self)
        {
            thread_suspend(threads[index]);
        }
    }

    size_t written = 0;
    for (mach_msg_type_number_t index = 0; index < count && written < kMaxOtherThreads; index++)
    {
        if (threads[index] != self)
        {
            writeThread(descriptor, index, threads[index]);
            written++;
        }
    }

    for (mach_msg_type_number_t index = 0; index < count; index++)
    {
        if (threads[index] != self)
        {
            thread_resume(threads[index]);
        }

        mach_port_deallocate(mach_task_self(), threads[index]);
    }

    mach_port_deallocate(mach_task_self(), self);
    vm_deallocate(mach_task_self(), reinterpret_cast<vm_address_t>(threads),
                  count * sizeof(thread_t));
}
#else
static void writeCrashRegisters(int, void *) {}

static void writeOtherThreads(int) {}
#endif

// Async-signal-safe apart from dladdr, and on Apple platforms the thread names: walks the
// frame-pointer chain of the crashing thread, then records its registers and every other thread.
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
    if (size_t length = gExceptionLength.load(std::memory_order_acquire))
    {
        writeText(descriptor, "Exception ");
        ssize_t written = write(descriptor, gException, length);
        (void) written;
        writeText(descriptor, "\n");
    }

    if (gImageLineLength > 0)
    {
        ssize_t written = write(descriptor, gImageLine, gImageLineLength);
        (void) written;
    }

    writeCrashingAddonLine(descriptor);

    uintptr_t pc = 0, lr = 0, fp = 0;
    if (crashRegisters(context, pc, lr, fp))
    {
        writeFramesFrom(descriptor, pc, lr, fp, kMaxNativeFrames);
    }

    writeCrashRegisters(descriptor, context);
    writeOtherThreads(descriptor);
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

static void forwardToPreviousHandler(int signal, siginfo_t *info, void *context, bool reentered)
{
    int index = crashSignalIndex(signal);
    if (index < 0)
    {
        raiseWithDefaultAction(signal);
        return;
    }

    const struct sigaction &previous =
        (reentered ? gOriginalActions : gPreviousActions)[static_cast<size_t>(index)];
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
    if (gHandling.exchange(true))
    {
        forwardToPreviousHandler(signal, info, context, true);
        return;
    }

    int savedErrno = errno;
    int descriptor = gMarkerDescriptor.load(std::memory_order_acquire);
    if (descriptor >= 0 && !gRecorded.exchange(true))
    {
        writeCrashingAddonRecord(descriptor);
    }

    writeNativeStack(signal, context);
#if defined(__ANDROID__)
    static char abortMessage[kAddonRecordByteLimit + 32];
    if (crashingAddonMessage(abortMessage, sizeof(abortMessage)) > 0)
    {
        android_set_abort_message(abortMessage);
    }
#endif
    errno = savedErrno;
    forwardToPreviousHandler(signal, info, context, false);
    gHandling.store(false);
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
        size_t slash      = image.find_last_of('/');
        image             = slash == std::string::npos ? image : image.substr(slash + 1);
        return info.dli_sname ? std::string(info.dli_sname) + " in " + image : image;
    }

    return "an unnamed handler";
}

static std::string singleLine(const std::string &text, size_t limit)
{
    std::string line = text.substr(0, limit);
    std::replace(line.begin(), line.end(), '\n', ' ');
    std::replace(line.begin(), line.end(), '\r', ' ');
    return line;
}

void noteUncaughtException(const std::string &description)
{
    std::string line = singleLine(description, sizeof(gException));
    gExceptionLength.store(0, std::memory_order_release);
    std::memcpy(gException, line.data(), line.size());
    gExceptionLength.store(line.size(), std::memory_order_release);
}

bool recordUncaughtException(const std::string &description, const std::string &frames)
{
    int descriptor = gStackDescriptor.exchange(-1);
    if (descriptor < 0)
    {
        return false;
    }

    writeText(descriptor,
              ("Exception " + singleLine(description, sizeof(gException)) + "\n").c_str());
    if (gImageLineLength > 0)
    {
        ssize_t written = write(descriptor, gImageLine, gImageLineLength);
        (void) written;
    }

    writeCrashingAddonLine(descriptor);
    writeText(descriptor, frames.c_str());
    fsync(descriptor);
    close(descriptor);
    return true;
}

bool installAddonCrashHandler(const std::string &markerPath)
{
    static std::mutex mutex;
    std::lock_guard<std::mutex> lock(mutex);
    if (gInstalled.load())
    {
        return true;
    }

    std::string imageLine = imageIdentityLine(loaderImageIdentity());
    if (imageLine.size() < sizeof(gImageLine))
    {
        std::memcpy(gImageLine, imageLine.data(), imageLine.size());
        gImageLineLength = imageLine.size();
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

    size_t slash             = markerPath.find_last_of('/');
    std::string directory    = slash == std::string::npos ? "." : markerPath.substr(0, slash);
    std::string stackPath    = joinPath(directory, kPendingNativeCrashFile);
    std::string writtenStack = readTextFile(stackPath).value_or("");
    if (!writtenStack.empty())
    {
        struct stat info = {};
        int64_t at =
            stat(stackPath.c_str(), &info) == 0 ? static_cast<int64_t>(info.st_mtime) * 1000 : 0;
        recordCrash(directory, writtenStack, at);
        gPreviousNativeCrash = std::move(writtenStack);
    }

    int stack = open(stackPath.c_str(), O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC, 0600);
    gStackDescriptor.store(stack, std::memory_order_release);

    ensureAlternateSignalStack();
    ensureAlternateSignalStacksOnNewThreads();

    struct sigaction action = {};
    action.sa_sigaction     = recordCrashingAddon;
    action.sa_flags         = SA_SIGINFO | SA_ONSTACK;
    sigemptyset(&action.sa_mask);

    for (size_t index = 0; index < kCrashSignals.size(); index++)
    {
        sigaction(kCrashSignals[index], &action, &gPreviousActions[index]);
        gOriginalActions[index] = gPreviousActions[index];
    }

    gInstalled.store(true);

    log(LogLevel::Info, LOG_CATEGORY_PLUGINS,
        "Addon crash attribution is installed; SIGSEGV continues to "
            + describeHandler(gPreviousActions[static_cast<size_t>(crashSignalIndex(SIGSEGV))])
            + " and SIGABRT to "
            + describeHandler(gPreviousActions[static_cast<size_t>(crashSignalIndex(SIGABRT))])
            + ".");
    return true;
}

static bool isOurs(const struct sigaction &action)
{
    return (action.sa_flags & SA_SIGINFO) && action.sa_sigaction == recordCrashingAddon;
}

size_t reclaimCrashHandlers()
{
    if (!gInstalled.load())
    {
        return 0;
    }

    struct sigaction action = {};
    action.sa_sigaction     = recordCrashingAddon;
    action.sa_flags         = SA_SIGINFO | SA_ONSTACK;
    sigemptyset(&action.sa_mask);

    size_t reclaimed = 0;
    for (size_t index = 0; index < kCrashSignals.size(); index++)
    {
        struct sigaction current = {};
        if (sigaction(kCrashSignals[index], nullptr, &current) != 0 || isOurs(current))
        {
            continue;
        }

        sigaction(kCrashSignals[index], &action, &gPreviousActions[index]);
        reclaimed++;
    }

    if (reclaimed > 0)
    {
        log(LogLevel::Info, LOG_CATEGORY_PLUGINS,
            "Moved addon crash attribution back in front of " + std::to_string(reclaimed)
                + " signal handlers installed after it; SIGSEGV now continues to "
                + describeHandler(gPreviousActions[static_cast<size_t>(crashSignalIndex(SIGSEGV))])
                + ".");
    }

    return reclaimed;
}

std::string previousNativeCrash()
{
    return gPreviousNativeCrash;
}

bool nativeCrashRecorded(const std::string &directory)
{
    return !gPreviousNativeCrash.empty()
           || !readTextFile(joinPath(directory, kPendingNativeCrashFile)).value_or("").empty();
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
