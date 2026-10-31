#include "LoaderDigestCache.h"

#include <nlohmann/json.hpp>
#include <optional>
#include <sys/stat.h>

#include "LoaderBundleSignature.h"
#include "LoaderFiles.h"

namespace loader {
static constexpr const char *kDigestCacheFile = ".verified.json";

static std::optional<nlohmann::json> fileIdentity(const std::string &path)
{
    struct stat info{};
    if (stat(path.c_str(), &info) != 0)
    {
        return std::nullopt;
    }
#if defined(__APPLE__)
    int64_t modified =
        static_cast<int64_t>(info.st_mtimespec.tv_sec) * 1000000000 + info.st_mtimespec.tv_nsec;
    int64_t changed =
        static_cast<int64_t>(info.st_ctimespec.tv_sec) * 1000000000 + info.st_ctimespec.tv_nsec;
#else
    int64_t modified =
        static_cast<int64_t>(info.st_mtim.tv_sec) * 1000000000 + info.st_mtim.tv_nsec;
    int64_t changed = static_cast<int64_t>(info.st_ctim.tv_sec) * 1000000000 + info.st_ctim.tv_nsec;
#endif
    return nlohmann::json{{"size", static_cast<uint64_t>(info.st_size)},
                          {"modified", modified},
                          {"changed", changed},
                          {"inode", static_cast<uint64_t>(info.st_ino)}};
}

static std::string fileName(const std::string &path)
{
    size_t slash = path.find_last_of('/');
    return slash == std::string::npos ? path : path.substr(slash + 1);
}

std::string cachedSha512(const std::string &directory, const std::string &path,
                         const std::string &contents)
{
    std::string                   cachePath = joinPath(directory, kDigestCacheFile);
    std::optional<nlohmann::json> identity  = fileIdentity(path);
    std::optional<std::string>    stored    = readTextFile(cachePath);
    nlohmann::json                cache =
        stored ? nlohmann::json::parse(*stored, nullptr, false) : nlohmann::json::object();
    if (!cache.is_object())
    {
        cache = nlohmann::json::object();
    }

    std::string name  = fileName(path);
    auto        entry = cache.find(name);
    if (identity && entry != cache.end() && entry->is_object() && entry->contains("sha512") &&
        (*entry)["sha512"].is_string() && entry->value("identity", nlohmann::json()) == *identity &&
        (*entry)["size"] == contents.size())
    {
        return (*entry)["sha512"].get<std::string>();
    }

    std::string digest = sha512Hex(contents);
    if (identity)
    {
        cache[name] = {{"identity", *identity}, {"size", contents.size()}, {"sha512", digest}};
        writeTextFileAtomically(cachePath, cache.dump());
    }
    return digest;
}
}
