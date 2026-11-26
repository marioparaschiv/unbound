#import "UncaughtExceptions.h"

#import <Foundation/Foundation.h>
#include <atomic>
#include <dlfcn.h>
#include <string>

#include "LoaderCrashHandler.h"
#import "SingleCopy.h"

static NSUncaughtExceptionHandler *gPreviousExceptionHandler = nullptr;
static std::atomic_bool gNotingException{false};
static constexpr NSUInteger kMaxThrownFrames = 48;

static std::string thrownFrameLines(NSException *exception)
{
    std::string lines;
    NSArray<NSNumber *> *addresses = exception.callStackReturnAddresses;
    NSUInteger count               = MIN(addresses.count, kMaxThrownFrames);
    for (NSUInteger index = 0; index < count; index++)
    {
        uintptr_t address = addresses[index].unsignedLongValue;
        Dl_info info      = {};
        char line[256];
        if (dladdr((const void *) address, &info) && info.dli_fname)
        {
            const char *name = strrchr(info.dli_fname, '/');
            snprintf(line, sizeof(line), "Thrown #%lu 0x%lx %s + 0x%lx\n", (unsigned long) index,
                     (unsigned long) address, name ? name + 1 : info.dli_fname,
                     (unsigned long) (address - (uintptr_t) info.dli_fbase));
        }
        else
        {
            snprintf(line, sizeof(line), "Thrown #%lu 0x%lx\n", (unsigned long) index,
                     (unsigned long) address);
        }

        lines += line;
    }

    return lines;
}

static void noteUncaughtObjCException(NSException *exception)
{
    if (gNotingException.exchange(true))
    {
        return;
    }

    std::string description = exception.name.UTF8String ?: "NSException";
    if (exception.reason.length > 0)
    {
        description += std::string(": ") + exception.reason.UTF8String;
    }

    loader::noteUncaughtException(description);
    loader::noteUncaughtExceptionFrames(thrownFrameLines(exception));
    if (gPreviousExceptionHandler)
    {
        gPreviousExceptionHandler(exception);
    }
}

void UnboundInstallUncaughtExceptionNote(void)
{
    if (UnboundIsDuplicateCopy() || NSGetUncaughtExceptionHandler() == noteUncaughtObjCException)
    {
        return;
    }

    gPreviousExceptionHandler = NSGetUncaughtExceptionHandler();
    NSSetUncaughtExceptionHandler(noteUncaughtObjCException);
}

__attribute__((constructor)) static void installUncaughtExceptionNote(void)
{
    UnboundInstallUncaughtExceptionNote();
}
