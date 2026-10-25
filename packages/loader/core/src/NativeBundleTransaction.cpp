#include "NativeBundleTransaction.h"

#include <array>
#include <cerrno>
#include <cstring>
#include <fcntl.h>
#include <string>
#include <sys/stat.h>
#include <unistd.h>
#include <vector>

static bool copyExistingBundle(const char *sourcePath, const char *backupPath)
{
    int source = open(sourcePath, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
    if (source < 0)
    {
        return false;
    }

    struct stat metadata;
    if (fstat(source, &metadata) != 0 || !S_ISREG(metadata.st_mode) || metadata.st_size == 0)
    {
        close(source);
        return false;
    }

    std::string       stagingTemplate = std::string(backupPath) + ".XXXXXX";
    std::vector<char> staging(stagingTemplate.begin(), stagingTemplate.end());
    staging.push_back('\0');
    int destination = mkstemp(staging.data());
    if (destination < 0)
    {
        close(source);
        return false;
    }

    bool                    copied = fchmod(destination, metadata.st_mode & 0777) == 0;
    std::array<char, 65536> buffer{};
    while (copied)
    {
        ssize_t count = read(source, buffer.data(), buffer.size());
        if (count == 0)
        {
            break;
        }
        if (count < 0)
        {
            if (errno == EINTR)
            {
                continue;
            }
            copied = false;
            break;
        }
        for (ssize_t offset = 0; offset < count;)
        {
            ssize_t written = write(destination, buffer.data() + offset, count - offset);
            if (written < 0 && errno == EINTR)
            {
                continue;
            }
            if (written <= 0)
            {
                copied = false;
                break;
            }
            offset += written;
        }
    }

    if (copied)
    {
        copied = fsync(destination) == 0;
    }
    if (close(destination) != 0)
    {
        copied = false;
    }
    close(source);
    if (copied)
    {
        copied = rename(staging.data(), backupPath) == 0;
    }
    if (!copied)
    {
        unlink(staging.data());
    }
    return copied;
}

bool promoteNativeBundle(const char *candidatePath, const char *targetPath, const char *backupPath)
{
    if (!candidatePath || !targetPath || !backupPath || !*candidatePath || !*targetPath ||
        !*backupPath || strcmp(candidatePath, targetPath) == 0 ||
        strcmp(candidatePath, backupPath) == 0 || strcmp(targetPath, backupPath) == 0)
    {
        return false;
    }

    struct stat candidateMetadata;
    if (lstat(candidatePath, &candidateMetadata) != 0 || !S_ISREG(candidateMetadata.st_mode) ||
        candidateMetadata.st_size == 0)
    {
        return false;
    }

    struct stat targetMetadata;
    if (lstat(targetPath, &targetMetadata) == 0)
    {
        if (!S_ISREG(targetMetadata.st_mode) || !copyExistingBundle(targetPath, backupPath))
        {
            return false;
        }
    }
    else if (errno != ENOENT)
    {
        return false;
    }

    return rename(candidatePath, targetPath) == 0;
}

bool restoreNativeBundle(const char *backupPath, const char *targetPath)
{
    if (!backupPath || !targetPath || !*backupPath || !*targetPath ||
        strcmp(backupPath, targetPath) == 0)
    {
        return false;
    }

    struct stat targetMetadata;
    if (lstat(targetPath, &targetMetadata) == 0)
    {
        if (!S_ISREG(targetMetadata.st_mode))
        {
            return false;
        }
    }
    else if (errno != ENOENT)
    {
        return false;
    }

    return copyExistingBundle(backupPath, targetPath);
}
