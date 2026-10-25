#include "LoaderFiles.h"

#include <algorithm>
#include <filesystem>
#include <fstream>
#include <sstream>
#include <system_error>

namespace loader
{
    std::optional<std::string> readTextFile(const std::string &path)
    {
        std::ifstream stream(path, std::ios::binary);
        if (!stream)
        {
            return std::nullopt;
        }

        std::ostringstream buffer;
        buffer << stream.rdbuf();
        return buffer.str();
    }

    bool writeTextFileAtomically(const std::string &path, const std::string &contents)
    {
        std::error_code       error;
        std::filesystem::path target(path);
        if (target.has_parent_path())
        {
            std::filesystem::create_directories(target.parent_path(), error);
        }

        std::string staging = path + ".tmp";
        {
            std::ofstream stream(staging, std::ios::binary | std::ios::trunc);
            if (!stream)
            {
                return false;
            }
            stream << contents;
            if (!stream.good())
            {
                return false;
            }
        }

        std::filesystem::rename(staging, target, error);
        return !error;
    }

    bool copyFile(const std::string &source, const std::string &destination)
    {
        std::error_code error;
        std::filesystem::copy_file(source, destination,
                                   std::filesystem::copy_options::overwrite_existing, error);
        return !error;
    }

    bool removeFile(const std::string &path)
    {
        std::error_code error;
        return std::filesystem::remove(path, error);
    }

    static bool staysInside(const std::filesystem::path &relative)
    {
        if (relative.empty() || relative.is_absolute())
        {
            return false;
        }

        for (const auto &component : relative)
        {
            if (component == ".." || component == ".")
            {
                return false;
            }
        }
        return true;
    }

    bool removeTree(const std::string &root, const std::string &relative)
    {
        const std::filesystem::path path(relative);
        if (root.empty() || !staysInside(path))
        {
            return false;
        }

        std::error_code error;
        const auto      removed = std::filesystem::remove_all(std::filesystem::path(root) / path, error);
        return !error && removed > 0;
    }

    uint64_t fileSize(const std::string &path)
    {
        std::error_code error;
        uintmax_t       size = std::filesystem::file_size(path, error);
        return error ? 0 : static_cast<uint64_t>(size);
    }

    bool fileExists(const std::string &path)
    {
        std::error_code error;
        return std::filesystem::exists(path, error);
    }

    bool isDirectory(const std::string &path)
    {
        std::error_code error;
        return std::filesystem::is_directory(path, error);
    }

    bool createDirectories(const std::string &path)
    {
        std::error_code error;
        std::filesystem::create_directories(path, error);
        return isDirectory(path);
    }

    std::vector<std::string> listDirectory(const std::string &path)
    {
        std::vector<std::string> entries;
        std::error_code          error;
        for (const auto &entry : std::filesystem::directory_iterator(path, error))
        {
            entries.push_back(entry.path().filename().string());
        }
        std::sort(entries.begin(), entries.end());
        return entries;
    }

    std::string joinPath(const std::string &base, const std::string &component)
    {
        if (component.empty())
        {
            return base;
        }

        if (!component.empty() && component.front() == '/')
        {
            return component;
        }

        if (base.empty() || base.back() == '/')
        {
            return base + component;
        }

        return base + "/" + component;
    }
}
