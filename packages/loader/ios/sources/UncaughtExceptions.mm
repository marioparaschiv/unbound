#import "UncaughtExceptions.h"

#import <Foundation/Foundation.h>
#include <atomic>
#include <string>

#include "LoaderCrashHandler.h"
#import "SingleCopy.h"

static NSUncaughtExceptionHandler *gPreviousExceptionHandler = nullptr;
static std::atomic_bool gNotingException{false};

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
