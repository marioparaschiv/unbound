#include <cassert>
#include <string>

#include "LoaderJSON.h"

static const std::string kReplacement = "\xEF\xBF\xBD";

int main()
{
    assert(loader::withValidUTF8("plain") == "plain");
    assert(loader::withValidUTF8("Ünïcødé 😀 名前") == "Ünïcødé 😀 名前");
    assert(loader::withValidUTF8(std::string("a\0b", 3)) == std::string("a\0b", 3));
    assert(loader::withValidUTF8("a\xFF"
                                 "b") == "a" + kReplacement + "b");
    assert(loader::withValidUTF8("\xC3") == kReplacement);
    assert(loader::withValidUTF8("\xC0\xAF") == kReplacement + kReplacement);
    assert(loader::withValidUTF8("\xED\xA0\x80") == kReplacement + kReplacement + kReplacement);
    assert(loader::withValidUTF8("\xF4\x90\x80\x80") ==
           kReplacement + kReplacement + kReplacement + kReplacement);
    assert(loader::withValidUTF8("\xE2\x82") == kReplacement + kReplacement);
    assert(loader::withValidUTF8("\xF0\x9F\x98\x80") == "😀");

    assert(loader::parseBoundedJSON("{\"a\":[1,{\"b\":2}]}")["a"][1]["b"] == 2);
    assert(loader::parseBoundedJSON(std::string(200, '[') + std::string(200, ']')).is_discarded());
    assert(loader::parseBoundedJSON("{\"a\":\"[[[[\"}", 2)["a"] == "[[[[");
    assert(loader::parseBoundedJSON("{\"a\":").is_discarded());
    nlohmann::json deep = 1;
    for (int level = 0; level < 200; level++)
    {
        deep = nlohmann::json::array({deep});
    }
    assert(loader::jsonNestsTooDeeply(deep));
    assert(!loader::jsonNestsTooDeeply(nlohmann::json::parse("[[[1]]]")));
    return 0;
}
