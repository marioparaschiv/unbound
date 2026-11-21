#include "LoaderAbortDetails.h"

#include <atomic>
#include <cstdint>
#include <cstring>
#include <cxxabi.h>
#include <exception>
#include <typeinfo>
#include <unistd.h>

#if defined(__APPLE__)
#include <mach-o/dyld.h>
#include <mach-o/getsect.h>
#endif

#include "LoaderCrashHandler.h"

namespace loader {
static constexpr size_t kMaxAbortMessage         = 400;
static std::terminate_handler gPreviousTerminate = nullptr;
static std::atomic_bool gTerminating{false};

static std::string demangled(const char *name)
{
    int status       = 0;
    char *readable   = abi::__cxa_demangle(name, nullptr, nullptr, &status);
    std::string text = status == 0 && readable ? readable : name;
    std::free(readable);
    return text;
}

std::string describeCurrentException()
{
    std::type_info *type = abi::__cxa_current_exception_type();
    if (!type)
    {
        return "";
    }

    std::string description = demangled(type->name());
    try
    {
        std::rethrow_exception(std::current_exception());
    }
    catch (const std::exception &error)
    {
        return description + ": " + error.what();
    }
    catch (...)
    {
        return description;
    }
}

static void recordUncaughtCxxException()
{
    if (gTerminating.exchange(true))
    {
        std::abort();
    }

    if (!uncaughtExceptionNoted())
    {
        std::string description = describeCurrentException();
        if (!description.empty())
        {
            noteUncaughtException("C++ " + description);
        }
    }

    if (gPreviousTerminate)
    {
        gPreviousTerminate();
    }

    std::abort();
}

void installTerminateHandler()
{
    if (std::get_terminate() == recordUncaughtCxxException)
    {
        return;
    }

    gPreviousTerminate = std::set_terminate(recordUncaughtCxxException);
}

#if defined(__APPLE__)
struct CrashReporterAnnotations {
    uint64_t version;
    uint64_t message;
    uint64_t signature;
    uint64_t backtrace;
    uint64_t message2;
};

static void writeAbortMessage(int descriptor, uint64_t address)
{
    if (!address)
    {
        return;
    }

    const char *message = reinterpret_cast<const char *>(static_cast<uintptr_t>(address));
    size_t length       = strnlen(message, kMaxAbortMessage);
    if (!length)
    {
        return;
    }

    ssize_t written = write(descriptor, "Abort ", 6);
    for (size_t index = 0; index < length; index++)
    {
        char character = message[index] == '\n' ? ' ' : message[index];
        written        = write(descriptor, &character, 1);
    }

    written = write(descriptor, "\n", 1);
    (void) written;
}

void writeAbortMessages(int descriptor)
{
    uint32_t count = _dyld_image_count();
    for (uint32_t index = 0; index < count; index++)
    {
        const auto *header =
            reinterpret_cast<const struct mach_header_64 *>(_dyld_get_image_header(index));
        unsigned long size = 0;
        const uint8_t *section =
            header ? getsectiondata(header, "__DATA", "__crash_info", &size) : nullptr;
        if (!section || size < sizeof(CrashReporterAnnotations))
        {
            continue;
        }

        CrashReporterAnnotations annotations = {};
        std::memcpy(&annotations, section, sizeof(annotations));
        writeAbortMessage(descriptor, annotations.message);
        writeAbortMessage(descriptor, annotations.message2);
    }
}
#else
void writeAbortMessages(int) {}
#endif
}
