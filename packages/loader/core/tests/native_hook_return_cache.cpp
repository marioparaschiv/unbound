#include "NativeHookReturnCache.h"
#include "NativePluginRuntime.h"

#include <cassert>

using namespace loader::native;

static bool exhausts(HookReturnCache &cache, const nlohmann::json &self)
{
    try
    {
        cache.set("hook-1", self, nlohmann::json::array(), {{"type", "int"}, {"value", 1}});
    }
    catch (const NativeCodedError &error)
    {
        assert(error.code() == "NATIVE_BRIDGE_ERROR");
        return true;
    }
    return false;
}

int main()
{
    assert(canonicalJSON(nlohmann::json::parse(R"({"value":42.0,"type":"int"})")) ==
           canonicalJSON(nlohmann::json::parse(R"({"type":"int","value":42})")));
    assert(canonicalJSON(nlohmann::json::parse("[1.5,2.0]")) == "[1.5,2]");
    assert(canonicalJSON(nlohmann::json::parse("1e20")) == nlohmann::json::parse("1e20").dump());

    NativeResourceBudget budget(2);
    HookReturnCache      cache(budget);
    nlohmann::json       self      = {{"type", "int"}, {"value", 42}};
    nlohmann::json       arguments = nlohmann::json::parse(R"([{"type":"string","value":"a"}])");

    cache.set("hook-1", self, arguments, {{"type", "string"}, {"value", "cached"}});
    assert(budget.used() == 1);
    cache.set("hook-1", self, arguments, {{"type", "string"}, {"value", "replaced"}});
    assert(budget.used() == 1);

    auto found = cache.findSerialized("hook-1", R"({"value":42.0,"type":"int"})", R"([{"value":"a","type":"string"}])");
    assert(found && nlohmann::json::parse(*found)["value"] == "replaced");
    assert(!cache.find("hook-2", self, arguments));
    assert(!cache.find("hook-1", self, nlohmann::json::array()));
    assert(!cache.findSerialized("hook-1", "{not json", "[]"));

    cache.set("hook-2", self, arguments, {{"type", "null"}});
    assert(budget.used() == 2);
    assert(exhausts(cache, {{"type", "int"}, {"value", 7}}));
    assert(budget.used() == 2);

    assert(cache.remove("hook-2", self, arguments));
    assert(!cache.remove("hook-2", self, arguments));
    assert(budget.used() == 1);

    cache.set("hook-1", {{"type", "int"}, {"value", 7}}, arguments, {{"type", "null"}});
    assert(cache.clear("hook-1") == 2);
    assert(budget.used() == 0 && cache.size() == 0);

    cache.set("hook-3", self, arguments, {{"type", "null"}});
    cache.set("hook-4", self, arguments, {{"type", "null"}});
    assert(cache.clearAll() == 2);
    assert(budget.used() == 0);
}
