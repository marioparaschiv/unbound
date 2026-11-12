#include "LoaderExitRecord.h"

#include "LoaderFiles.h"

namespace loader {
ExitRecord::ExitRecord(std::string directory) : directory_(std::move(directory)) {}

std::string ExitRecord::path() const
{
    return joinPath(directory_, kFile);
}

bool ExitRecord::markEnded() const
{
    return writeTextFileAtomically(path(), "ended");
}

bool ExitRecord::clear() const
{
    return !fileExists(path()) || removeFile(path());
}

PreviousExit ExitRecord::take(bool nativeCrashRecorded) const
{
    bool ended = fileExists(path());
    clear();
    if (nativeCrashRecorded)
    {
        return PreviousExit::Crashed;
    }
    return ended ? PreviousExit::Ended : PreviousExit::Unknown;
}
}
