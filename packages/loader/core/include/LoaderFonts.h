#pragma once

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
nlohmann::json             fontEntry(const std::string &path, const std::string &source);
nlohmann::json             fontEntryFromData(const std::string &data, const std::string &path,
                                             const std::string &source, const std::string &name);
std::optional<std::string> fontFullNameFromData(const std::string &data);
std::optional<std::string> fontOverrideFor(const nlohmann::json &overrides,
                                           const std::string    &family);

struct FontTarget {
    std::string                name;
    std::optional<std::string> path;
};

std::optional<FontTarget> resolveFontTarget(const nlohmann::json &customFonts,
                                            const nlohmann::json &systemFonts,
                                            const std::string    &name);
std::string    fontUnavailableMessage(const std::string &family, const std::string &name);
nlohmann::json fontTargetJSON(const nlohmann::json &customFonts, const nlohmann::json &systemFonts,
                              const std::string &family, const std::string &name);
nlohmann::json fontOverrideTargets(const nlohmann::json &overrides,
                                   const nlohmann::json &customFonts,
                                   const nlohmann::json &systemFonts);
nlohmann::json systemFontsFromFiles(const std::vector<std::string> &paths,
                                    const std::string              &source);
nlohmann::json fontCatalog(const nlohmann::json &customFonts, const nlohmann::json &platformFonts);
nlohmann::json fontNamesOf(const nlohmann::json &fonts);

using FontOverrideTable = std::map<std::string, std::string>;

struct FontOverridePlan {
    std::vector<std::string> registrations;
    std::vector<std::string> errors;
    FontOverrideTable        table;
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
