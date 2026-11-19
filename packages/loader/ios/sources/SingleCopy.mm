#import "SingleCopy.h"

#include <dlfcn.h>
#include <stdlib.h>
#include <string.h>

static const char *const kOwnerVariable     = "UNBOUND_LOADER_IMAGE";
static const char *const kDuplicateVariable = "UNBOUND_DUPLICATE_LOADER";
static bool duplicateCopy                   = false;

__attribute__((constructor(101))) static void claimProcess(void)
{
    Dl_info info = {};
    if (!dladdr((const void *) &claimProcess, &info) || !info.dli_fname)
    {
        return;
    }

    const char *owner = getenv(kOwnerVariable);
    if (!owner)
    {
        setenv(kOwnerVariable, info.dli_fname, 1);
        return;
    }

    if (strcmp(owner, info.dli_fname) != 0)
    {
        duplicateCopy = true;
        setenv(kDuplicateVariable, info.dli_fname, 1);
    }
}

bool UnboundIsDuplicateCopy(void)
{
    return duplicateCopy;
}

const char *UnboundDuplicateCopyPath(void)
{
    return getenv(kDuplicateVariable);
}
