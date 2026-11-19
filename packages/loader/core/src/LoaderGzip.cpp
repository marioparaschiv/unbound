#include "LoaderGzip.h"

#include <array>
#include <filesystem>
#include <fstream>
#include <zlib.h>

namespace loader {
static constexpr size_t kChunkBytes = 64 * 1024;

static bool copyInto(std::ifstream &input, gzFile output)
{
    std::array<char, kChunkBytes> buffer{};
    while (input)
    {
        input.read(buffer.data(), buffer.size());
        std::streamsize read = input.gcount();
        if (read > 0 && gzwrite(output, buffer.data(), static_cast<unsigned>(read)) != read)
        {
            return false;
        }
    }

    return input.eof();
}

bool gzipFile(const std::string &source, const std::string &destination)
{
    std::ifstream input(source, std::ios::binary);
    if (!input)
    {
        return false;
    }

    std::string staging = destination + ".partial";
    gzFile output       = gzopen(staging.c_str(), "wb6");
    if (!output)
    {
        return false;
    }

    bool copied = copyInto(input, output);
    bool closed = gzclose(output) == Z_OK;
    std::error_code error;
    if (!copied || !closed)
    {
        std::filesystem::remove(staging, error);
        return false;
    }

    std::filesystem::rename(staging, destination, error);
    return !error;
}

std::optional<std::string> gunzipFile(const std::string &path)
{
    gzFile input = gzopen(path.c_str(), "rb");
    if (!input)
    {
        return std::nullopt;
    }

    std::string contents;
    std::array<char, kChunkBytes> buffer{};
    int read = 0;
    while ((read = gzread(input, buffer.data(), buffer.size())) > 0)
    {
        contents.append(buffer.data(), static_cast<size_t>(read));
    }

    bool failed = read < 0;
    gzclose(input);
    return failed ? std::nullopt : std::optional<std::string>(contents);
}
}
