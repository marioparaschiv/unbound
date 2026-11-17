#import <Foundation/Foundation.h>
#include <string>

#include "LoaderCrashHandler.h"

static NSUncaughtExceptionHandler *gPreviousExceptionHandler = nullptr;

static void noteUncaughtObjCException(NSException *exception)
{
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

__attribute__((constructor)) static void installUncaughtExceptionNote(void)
{
    gPreviousExceptionHandler = NSGetUncaughtExceptionHandler();
    NSSetUncaughtExceptionHandler(noteUncaughtObjCException);
}
