#pragma once

#include <cstdint>
#include <map>
#include <mutex>
#include <nlohmann/json.hpp>
#include <optional>
#include <set>
#include <string>
#include <vector>

namespace loader {
constexpr const char *kAllFontFamilies = "*";

struct FontNames {
    std::optional<std::string> postScript;
    std::optional<std::string> full;
    std::optional<std::string> family;
    std::optional<std::string> style;
};

std::optional<FontNames>   fontNames(const std::string &path);
std::optional<std::string> fontFullName(const std::string &path);
std::optional<FontNames>   fontNamesFromData(const std::string &data);
// One `name` table entry by its id, such as a variable font's axis or instance names.
std::optional<std::string> fontNameFromData(const std::string &data, uint16_t nameID);
nlohmann::json             fontEntry(const std::string &path, const std::string &source);
nlohmann::json             fontEntryFromData(const std::string &data, const std::string &path,
                                             const std::string &source, const std::string &name);
std::optional<std::string> fontFullNameFromData(const std::string &data);

nlohmann::json systemFontsFromFiles(const std::vector<std::string> &paths,
                                    const std::string              &source);
nlohmann::json fontCatalog(const nlohmann::json &customFonts, const nlohmann::json &platformFonts);

using FontOverrideTable = std::map<std::string, std::string>;

struct FontOverridePlan {
    std::vector<std::string> registrations;
    std::vector<std::string> errors;
    FontOverrideTable        table;
    // A variable font's instance, by the name `table` points at: `{ path, variations: { tag: n }
    // }`.
    std::map<std::string, nlohmann::json> instances;
};

class FontOverrideRegistry
{
public:
    FontOverridePlan plan(const nlohmann::json &targets);

private:
    std::set<std::string> registered_;
    std::mutex            mutex_;
};

nlohmann::json             fontOverridePlanJSON(const FontOverridePlan &plan);
std::optional<std::string> fontOverrideLookup(const FontOverrideTable &table,
                                              const std::string       &name);
}
