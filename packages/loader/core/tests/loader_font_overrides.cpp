#include <cassert>
#include <string>

#include "LoaderFonts.h"

using namespace loader;

static void plansRegistrationsAndTable()
{
    FontOverrideRegistry registry;
    const nlohmann::json targets = {
        {"ggsans", {{"name", "Comic Sans MS"}}},
        {"Inter", {{"name", "Inter Display"}, {"path", "/fonts/inter.ttf"}}},
        {"Mono", {{"error", "Mono is not installed."}}},
        {"Broken", nlohmann::json::array()},
        {"Shared", {{"name", "Inter Display"}, {"path", "/fonts/inter.ttf"}}},
    };

    const FontOverridePlan first = registry.plan(targets);
    assert(first.registrations == std::vector<std::string>{"/fonts/inter.ttf"});
    assert(first.errors == std::vector<std::string>{"Mono is not installed."});
    assert((first.table == FontOverrideTable{{"Inter", "Inter Display"},
                                             {"Shared", "Inter Display"},
                                             {"ggsans", "Comic Sans MS"}}));

    const FontOverridePlan second = registry.plan(targets);
    assert(second.registrations.empty());
    assert(second.table == first.table);

    assert(registry.plan(nlohmann::json::array()).table.empty());
    assert(registry.plan({{"x", {{"error", 3}}}}).errors == std::vector<std::string>{"3"});
}

static void letsEveryFamilyWin()
{
    FontOverrideRegistry   registry;
    const FontOverridePlan plan = registry.plan({
        {"*", {{"name", "Comic Sans MS"}, {"path", "/fonts/comic.ttf"}}},
        {"ggsans", {{"name", "Inter"}, {"path", "/fonts/inter.ttf"}}},
    });
    assert(
        (plan.registrations == std::vector<std::string>{"/fonts/comic.ttf", "/fonts/inter.ttf"}));
    assert((plan.table == FontOverrideTable{{"*", "Comic Sans MS"}}));
    assert(fontOverrideLookup(plan.table, "ggsans") == "Comic Sans MS");
    assert(fontOverrideLookup(plan.table, "Helvetica") == "Comic Sans MS");

    const FontOverridePlan failed = registry.plan({
        {"*", {{"error", "Comic Sans MS is not installed."}}},
        {"ggsans", {{"name", "Inter"}}},
    });
    assert((failed.table == FontOverrideTable{{"ggsans", "Inter"}}));
    assert(fontOverrideLookup(failed.table, "ggsans") == "Inter");
    assert(!fontOverrideLookup(failed.table, "Helvetica"));
}

static void looksUpExactFamilies()
{
    const FontOverrideTable table{{"ggsans", "Inter"}};
    assert(fontOverrideLookup(table, "ggsans") == "Inter");
    assert(!fontOverrideLookup(table, "GGSans"));
    assert(!fontOverrideLookup({}, "ggsans"));
}

static void serialisesPlans()
{
    FontOverridePlan plan;
    plan.registrations = {"/fonts/a.ttf"};
    plan.errors        = {"missing"};
    plan.table         = {{"ggsans", "Inter"}};
    assert(fontOverridePlanJSON(plan) == nlohmann::json({{"registrations", {"/fonts/a.ttf"}},
                                                         {"errors", {"missing"}},
                                                         {"table", {{"ggsans", "Inter"}}}}));
}

int main()
{
    plansRegistrationsAndTable();
    letsEveryFamilyWin();
    looksUpExactFamilies();
    serialisesPlans();
    return 0;
}
