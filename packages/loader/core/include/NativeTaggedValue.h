#pragma once

#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace loader::native {
enum class TaggedValueKind
{
    Null,
    Boolean,
    Number,
    String,
};

struct TaggedValue {
    std::string     type;
    TaggedValueKind kind    = TaggedValueKind::Null;
    bool            boolean = false;
    double          number  = 0;
    std::string     text;
};

struct TaggedEvent {
    TaggedValue              self;
    std::vector<TaggedValue> arguments;
};

std::optional<TaggedValue> parseTaggedValue(std::string_view json);
std::optional<TaggedEvent> parseTaggedEvent(std::string_view json);
}
