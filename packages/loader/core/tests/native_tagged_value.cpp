#include <cassert>
#include <nlohmann/json.hpp>
#include <string>

#include "NativeTaggedValue.h"

using loader::native::parseTaggedValue;
using loader::native::TaggedValueKind;

static void matchesNlohmann(const std::string &json)
{
    auto fast = parseTaggedValue(json);
    assert(fast.has_value());

    nlohmann::json parsed = nlohmann::json::parse(json);
    assert(fast->type == parsed["type"].get<std::string>());

    const nlohmann::json &value = parsed["value"];
    switch (fast->kind)
    {
        case TaggedValueKind::Null:
            assert(value.is_null());
            break;
        case TaggedValueKind::Boolean:
            assert(value.is_boolean() && fast->boolean == value.get<bool>());
            break;
        case TaggedValueKind::Number:
            assert(value.is_number() && fast->number == value.get<double>());
            break;
        case TaggedValueKind::String:
            assert(value.is_string() && fast->text == value.get<std::string>());
            break;
    }
}

int main()
{
    matchesNlohmann(R"({"type":"null","value":null})");
    matchesNlohmann(R"({"type":"boolean","value":true})");
    matchesNlohmann(R"({"type":"boolean","value":false})");
    matchesNlohmann(R"({"type":"int","value":-42})");
    matchesNlohmann(R"({"type":"long","value":9007199254740993})");
    matchesNlohmann(R"({"type":"double","value":1.5})");
    matchesNlohmann(R"({"type":"double","value":1.0E20})");
    matchesNlohmann(R"({"type":"float","value":-0.125})");
    matchesNlohmann(R"({"type":"string","value":""})");
    matchesNlohmann(R"({"type":"string","value":"a \"quoted\" \\ path\/to\n\ttab\b\f\r"})");
    matchesNlohmann(R"({"type":"string","value":"héllo wörld ✓"})");
    matchesNlohmann(R"({"type":"handle","value":"java-17"})");
    matchesNlohmann(R"({"type":"char","value":"x"})");

    assert(!parseTaggedValue(R"({"type":"string","value":"\u0001"})"));
    assert(!parseTaggedValue(R"({"value":1,"type":"int"})"));
    assert(!parseTaggedValue(R"({"type":"int","value":1,"extra":2})"));
    assert(!parseTaggedValue(R"({"type":"int","value":Infinity})"));
    assert(!parseTaggedValue(R"({"type":"int","value":1-2})"));
    assert(!parseTaggedValue(R"({"type":"in t","value":1})"));
    assert(!parseTaggedValue(R"({"type":"string","value":"unterminated})"));
    assert(!parseTaggedValue(R"({"type":"string","value":"a"b"})"));
    assert(!parseTaggedValue(R"([{"type":"int","value":1}])"));
    assert(!parseTaggedValue(R"({"type":"object","value":{"a":1}})"));
    assert(!parseTaggedValue(""));
    return 0;
}
