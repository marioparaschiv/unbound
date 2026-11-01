#pragma once

#include <optional>
#include <string>
#include <string_view>

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

std::optional<TaggedValue> parseTaggedValue(std::string_view json);
}
