#include "LoaderRequiredLoader.h"

#include "LoaderFiles.h"
#include "LoaderLog.h"

namespace loader {
std::optional<std::string> requiredLoaderVersion(const std::string &documents)
{
    std::optional<std::string> version = readTextFile(joinPath(documents, kRequiredLoaderFile));
    return version && !version->empty() ? version : std::nullopt;
}

void recordRequiredLoader(const std::string &documents, const std::string &version)
{
    std::string path = joinPath(documents, kRequiredLoaderFile);
    if (version.empty())
    {
        removeFile(path);
        return;
    }
    if (!writeTextFileAtomically(path, version))
    {
        log(LogLevel::Warning, LOG_CATEGORY_UPDATER,
            "Failed to record the required loader version " + version + ".");
    }
}
}
