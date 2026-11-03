#include <cassert>
#include <string>
#include <vector>

#include "LoaderFonts.h"

static const nlohmann::json kCustom = nlohmann::json::array(
    {{{"name", "Inter-Regular"}, {"displayName", "Inter"}, {"path", "/fonts/Inter.ttf"}}});
static const nlohmann::json kSystem =
    nlohmann::json::array({{{"name", "Menlo-Regular"}, {"displayName", "Menlo"}}, "Courier"});

struct CountingSource {
    int calls = 0;

    loader::SystemFontSource source()
    {
        return [this]() -> const nlohmann::json & {
            calls++;
            return kSystem;
        };
    }
};

static void noOverridesNeverBuildTheCatalog()
{
    CountingSource counting;
    assert(loader::lazyFontOverrideTargets(nlohmann::json::object(), kCustom, counting.source()) ==
           nlohmann::json::object());
    assert(loader::lazyFontOverrideTargets(nlohmann::json::array(), kCustom, counting.source()) ==
           nlohmann::json::object());
    assert(loader::lazyFontOverrideTargets({{"empty", ""}, {"number", 4}}, kCustom,
                                           counting.source()) == nlohmann::json::object());
    assert(counting.calls == 0);
}

static void customOverridesNeverBuildTheCatalog()
{
    CountingSource       counting;
    const nlohmann::json targets = loader::lazyFontOverrideTargets(
        {{"*", "Inter"}, {"gg sans", "Inter-Regular"}}, kCustom, counting.source());
    assert(counting.calls == 0);
    assert(targets["*"] ==
           (nlohmann::json{{"name", "Inter-Regular"}, {"path", "/fonts/Inter.ttf"}}));
    assert(targets["gg sans"] == targets["*"]);
}

static void systemOverridesMatchTheEagerTargets()
{
    CountingSource       counting;
    const nlohmann::json overrides = {
        {"*", "Inter"}, {"code", "Menlo"}, {"gg sans", "Missing"}, {"empty", ""}};
    const nlohmann::json lazy =
        loader::lazyFontOverrideTargets(overrides, kCustom, counting.source());
    assert(counting.calls == 2);
    assert(lazy == loader::fontOverrideTargets(overrides, kCustom, kSystem));
    assert(lazy["code"] == (nlohmann::json{{"name", "Menlo-Regular"}}));
    assert(lazy["gg sans"].contains("error"));
}

static void platformNamesAreSortedUniqueAndSkipCustomFonts()
{
    const std::vector<std::string> names = {"Menlo-Regular", "",        "Courier",
                                            "Inter-Regular", "Courier", "Arial"};
    assert(loader::platformFontNames(names, kCustom) ==
           nlohmann::json::array({"Arial", "Courier", "Menlo-Regular"}));
    assert(loader::platformFontNames(names, nlohmann::json()) ==
           nlohmann::json::array({"Arial", "Courier", "Inter-Regular", "Menlo-Regular"}));
    assert(loader::platformFontNames({}, kCustom) == nlohmann::json::array());
}

static void platformNamesMatchTheCatalogNames()
{
    const std::vector<std::string> names   = {"Menlo-Regular", "Courier", "Arial"};
    nlohmann::json                 entries = nlohmann::json::array();
    for (const std::string &name : {"Arial", "Courier", "Menlo-Regular"})
    {
        entries.push_back({{"name", name}, {"displayName", name}, {"source", "system"}});
    }
    assert(loader::platformFontNames(names, nlohmann::json::array()) ==
           loader::fontNamesOf(loader::fontCatalog(nlohmann::json::array(), entries)));
}

int main()
{
    noOverridesNeverBuildTheCatalog();
    customOverridesNeverBuildTheCatalog();
    systemOverridesMatchTheEagerTargets();
    platformNamesAreSortedUniqueAndSkipCustomFonts();
    platformNamesMatchTheCatalogNames();
    return 0;
}
