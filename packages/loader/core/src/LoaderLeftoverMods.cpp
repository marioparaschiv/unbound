#include "LoaderLeftoverMods.h"

#include <algorithm>
#include <cctype>
#include <utility>

#include "LoaderFiles.h"

namespace loader::environment_report {
static const std::vector<std::pair<std::string, std::string>> kModFolders = {
    {"enmity", "Enmity"},   {"vendetta", "Vendetta"}, {"pyoncord", "Bunny"},    {"bunny", "Bunny"},
    {"revenge", "Revenge"}, {"kettu", "Kettu"},       {"aliucord", "Aliucord"},
};

static std::string lowered(std::string text)
{
    std::transform(text.begin(), text.end(), text.begin(), [](unsigned char character) {
        return static_cast<char>(std::tolower(character));
    });
    return text;
}

std::vector<std::string> leftoverMods(const std::vector<std::string> &entries)
{
    std::vector<std::string> names;
    for (const std::string &entry : entries)
    {
        std::string folder = lowered(entry);
        for (const auto &[key, name] : kModFolders)
        {
            if (folder == key && std::find(names.begin(), names.end(), name) == names.end())
            {
                names.push_back(name);
            }
        }
    }

    return names;
}

std::string leftoverModsMarker(const std::string &directory)
{
    std::vector<std::string> names = leftoverMods(listDirectory(directory));
    if (names.empty())
    {
        return {};
    }

    std::string joined;
    for (const std::string &name : names)
    {
        joined += (joined.empty() ? "" : ", ") + name;
    }

    return "leftover data from " + joined;
}
}
