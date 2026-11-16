#include "LoaderStallMarker.h"

#include <nlohmann/json.hpp>

#include "LoaderFiles.h"

namespace loader {
namespace {
    constexpr const char *kStallMarkerFile = "main-thread-stall.json";
    constexpr int64_t kStallToExitLimitMs  = 2 * 60 * 1000;

    std::string markerPath(const std::string &directory)
    {
        return joinPath(directory, kStallMarkerFile);
    }
}

bool recordMainThreadStall(const std::string &directory, const std::string &addonRecord, int64_t at)
{
    if (addonRecord.empty())
    {
        clearMainThreadStall(directory);
        return false;
    }

    nlohmann::json marker{{"at", at}, {"addon", addonRecord}};
    return writeTextFileAtomically(markerPath(directory), marker.dump());
}

void clearMainThreadStall(const std::string &directory)
{
    removeFile(markerPath(directory));
}

std::string takeStallAddonBefore(const std::string &directory, int64_t exitAt)
{
    std::optional<std::string> text = readTextFile(markerPath(directory));
    clearMainThreadStall(directory);
    if (!text)
    {
        return std::string();
    }

    nlohmann::json marker = nlohmann::json::parse(*text, nullptr, false);
    if (!marker.is_object() || !marker.contains("at") || !marker["at"].is_number_integer()
        || !marker.contains("addon") || !marker["addon"].is_string())
    {
        return std::string();
    }

    int64_t at = marker["at"].get<int64_t>();
    if (at > exitAt || exitAt - at > kStallToExitLimitMs)
    {
        return std::string();
    }

    return marker["addon"].get<std::string>();
}
}
