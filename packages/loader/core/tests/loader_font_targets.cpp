#include <cassert>
#include <string>

#include "LoaderFonts.h"

int main()
{
    const nlohmann::json custom = nlohmann::json::array(
        {{{"name", "Inter-Regular"}, {"displayName", "Inter"}, {"path", "/fonts/Inter.ttf"}}});
    const nlohmann::json system =
        nlohmann::json::array({{{"name", "Menlo-Regular"}, {"displayName", "Menlo"}}, "Courier"});

    assert(loader::fontTargetJSON(custom, system, "gg sans", "Inter") ==
           (nlohmann::json{{"name", "Inter-Regular"}, {"path", "/fonts/Inter.ttf"}}));
    assert(loader::fontTargetJSON(custom, system, "gg sans", "Menlo") ==
           (nlohmann::json{{"name", "Menlo-Regular"}}));
    assert(loader::fontTargetJSON(custom, system, "gg sans", "Courier") ==
           (nlohmann::json{{"name", "Courier"}}));
    assert(loader::fontTargetJSON(custom, system, "gg sans", "Missing") ==
           (nlohmann::json{{"name", "Missing"},
                           {"error", loader::fontUnavailableMessage("gg sans", "Missing")}}));

    const nlohmann::json overrides = {
        {"*", "Inter"}, {"gg sans", "Missing"}, {"empty", ""}, {"number", 4}};
    const nlohmann::json targets = loader::fontOverrideTargets(overrides, custom, system);
    assert(targets.size() == 2);
    assert(targets["*"] ==
           (nlohmann::json{{"name", "Inter-Regular"}, {"path", "/fonts/Inter.ttf"}}));
    assert(targets["gg sans"].contains("error"));
    assert(!targets.contains("empty") && !targets.contains("number"));

    assert(loader::fontOverrideTargets(nlohmann::json::array(), custom, system) ==
           nlohmann::json::object());
    assert(loader::fontOverrideTargets(nlohmann::json::object(), custom, system) ==
           nlohmann::json::object());
    return 0;
}
