#include "LoaderAddonFolders.h"

#include <array>
#include <filesystem>
#include <sys/stat.h>
#include <system_error>

#include "LoaderFiles.h"

namespace loader {
namespace fs = std::filesystem;

static constexpr std::array<const char *, 2> kAddonRoots = {"Plugins", "Themes"};
static constexpr const char *kStagingRoot                = "Staging";

static int64_t changedSeconds(const std::string &path)
{
    struct stat info{};
    return stat(path.c_str(), &info) == 0 ? static_cast<int64_t>(info.st_mtime) : 0;
}

bool replaceAddonFolder(const std::string &documents, const std::string &staging,
                        const std::string &target)
{
    if (!isContainedRelativePath(staging) || !isContainedRelativePath(target))
    {
        return false;
    }

    std::optional<std::string> from = resolveInsideDirectory(documents, staging);
    std::optional<std::string> to   = resolveInsideDirectory(documents, target);
    if (!from || !to || !isDirectory(*from))
    {
        return false;
    }

    std::error_code error;
    fs::create_directories(fs::path(*to).parent_path(), error);
    const std::string aside = *to + ".replaced";
    fs::remove_all(aside, error);

    bool hadOld = isDirectory(*to);
    if (hadOld)
    {
        fs::rename(*to, aside, error);
        if (error)
        {
            return false;
        }
    }

    fs::rename(*from, *to, error);
    if (error)
    {
        if (hadOld)
        {
            std::error_code restore;
            fs::rename(aside, *to, restore);
        }

        return false;
    }

    fs::remove_all(aside, error);
    return true;
}

static bool removeIfStale(const std::string &path, int64_t nowSeconds, int64_t minAgeSeconds)
{
    if (nowSeconds - changedSeconds(path) < minAgeSeconds)
    {
        return false;
    }

    std::error_code error;
    return fs::remove_all(path, error) > 0 && !error;
}

size_t removeOrphanedAddonFolders(const std::string &documents, int64_t nowSeconds,
                                  int64_t minAgeSeconds)
{
    size_t removed            = 0;
    const std::string staging = joinPath(documents, kStagingRoot);
    for (const std::string &kind : listDirectory(staging))
    {
        for (const std::string &folder : listDirectory(joinPath(staging, kind)))
        {
            removed +=
                removeIfStale(joinPath(joinPath(staging, kind), folder), nowSeconds, minAgeSeconds);
        }
    }

    for (const char *root : kAddonRoots)
    {
        const std::string directory = joinPath(documents, root);
        for (const std::string &folder : listDirectory(directory))
        {
            const std::string path = joinPath(directory, folder);
            bool orphaned = isDirectory(path) && !fileExists(joinPath(path, "manifest.json"));
            if (orphaned || folder.ends_with(".replaced"))
            {
                removed += removeIfStale(path, nowSeconds, minAgeSeconds);
            }
        }
    }

    return removed;
}
}
