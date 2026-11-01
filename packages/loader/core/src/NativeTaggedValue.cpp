#include "NativeTaggedValue.h"

#include <cmath>
#include <cstdlib>

namespace loader::native {
static constexpr std::string_view kTypePrefix  = "{\"type\":\"";
static constexpr std::string_view kValueMarker = "\",\"value\":";

static bool isTypeName(std::string_view type)
{
    if (type.empty())
    {
        return false;
    }
    for (char character : type)
    {
        bool letter =
            (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z');
        if (!letter)
        {
            return false;
        }
    }
    return true;
}

static std::optional<std::string> unescaped(std::string_view quoted)
{
    if (quoted.size() < 2 || quoted.front() != '"' || quoted.back() != '"')
    {
        return std::nullopt;
    }
    std::string_view body = quoted.substr(1, quoted.size() - 2);
    std::string      text;
    text.reserve(body.size());
    for (size_t index = 0; index < body.size(); index++)
    {
        char character = body[index];
        if (character == '"' || static_cast<unsigned char>(character) < 0x20)
        {
            return std::nullopt;
        }
        if (character != '\\')
        {
            text += character;
            continue;
        }
        if (++index >= body.size())
        {
            return std::nullopt;
        }
        switch (body[index])
        {
            case '"':
            case '\\':
            case '/':
                text += body[index];
                break;
            case 'b':
                text += '\b';
                break;
            case 'f':
                text += '\f';
                break;
            case 'n':
                text += '\n';
                break;
            case 'r':
                text += '\r';
                break;
            case 't':
                text += '\t';
                break;
            default:
                return std::nullopt;
        }
    }
    return text;
}

static bool isNumberLiteral(std::string_view literal)
{
    if (literal.empty())
    {
        return false;
    }
    for (char character : literal)
    {
        bool allowed = (character >= '0' && character <= '9') || character == '-' ||
                       character == '+' || character == '.' || character == 'e' || character == 'E';
        if (!allowed)
        {
            return false;
        }
    }
    return literal.front() == '-' || (literal.front() >= '0' && literal.front() <= '9');
}

std::optional<TaggedValue> parseTaggedValue(std::string_view json)
{
    if (json.size() < kTypePrefix.size() + kValueMarker.size() + 2 ||
        json.substr(0, kTypePrefix.size()) != kTypePrefix || json.back() != '}')
    {
        return std::nullopt;
    }
    size_t typeEnd = json.find('"', kTypePrefix.size());
    if (typeEnd == std::string_view::npos ||
        json.substr(typeEnd, kValueMarker.size()) != kValueMarker)
    {
        return std::nullopt;
    }

    TaggedValue      value;
    std::string_view type = json.substr(kTypePrefix.size(), typeEnd - kTypePrefix.size());
    if (!isTypeName(type))
    {
        return std::nullopt;
    }
    value.type = std::string(type);

    size_t           literalStart = typeEnd + kValueMarker.size();
    std::string_view literal      = json.substr(literalStart, json.size() - literalStart - 1);
    if (literal == "null")
    {
        value.kind = TaggedValueKind::Null;
        return value;
    }
    if (literal == "true" || literal == "false")
    {
        value.kind    = TaggedValueKind::Boolean;
        value.boolean = literal == "true";
        return value;
    }
    if (!literal.empty() && literal.front() == '"')
    {
        std::optional<std::string> text = unescaped(literal);
        if (!text)
        {
            return std::nullopt;
        }
        value.kind = TaggedValueKind::String;
        value.text = std::move(*text);
        return value;
    }
    if (!isNumberLiteral(literal))
    {
        return std::nullopt;
    }
    std::string terminated(literal);
    char       *end    = nullptr;
    double      number = std::strtod(terminated.c_str(), &end);
    if (end != terminated.c_str() + terminated.size() || !std::isfinite(number))
    {
        return std::nullopt;
    }
    value.kind   = TaggedValueKind::Number;
    value.number = number;
    return value;
}

static std::optional<size_t> taggedValueEnd(std::string_view json, size_t start)
{
    if (json.substr(start, kTypePrefix.size()) != kTypePrefix)
    {
        return std::nullopt;
    }
    size_t marker = json.find(kValueMarker, start + kTypePrefix.size());
    if (marker == std::string_view::npos)
    {
        return std::nullopt;
    }
    size_t position = marker + kValueMarker.size();
    if (position < json.size() && json[position] == '"')
    {
        for (position++; position < json.size(); position++)
        {
            if (json[position] == '\\')
            {
                position++;
            }
            else if (json[position] == '"')
            {
                break;
            }
        }
        if (position >= json.size())
        {
            return std::nullopt;
        }
        position++;
    }
    else
    {
        position = json.find('}', position);
        if (position == std::string_view::npos)
        {
            return std::nullopt;
        }
    }
    if (position >= json.size() || json[position] != '}')
    {
        return std::nullopt;
    }
    return position + 1;
}

static std::optional<TaggedValue> taggedValueAt(std::string_view json, size_t &position)
{
    std::optional<size_t> end = taggedValueEnd(json, position);
    if (!end)
    {
        return std::nullopt;
    }
    std::optional<TaggedValue> value = parseTaggedValue(json.substr(position, *end - position));
    position                         = *end;
    return value;
}

std::optional<TaggedEvent> parseTaggedEvent(std::string_view json)
{
    static constexpr std::string_view kSelfPrefix   = "{\"self\":";
    static constexpr std::string_view kArgsMarker   = ",\"args\":[";
    static constexpr std::string_view kEventClosing = "]}";

    if (json.substr(0, kSelfPrefix.size()) != kSelfPrefix)
    {
        return std::nullopt;
    }
    size_t                     position = kSelfPrefix.size();
    std::optional<TaggedValue> self     = taggedValueAt(json, position);
    if (!self || json.substr(position, kArgsMarker.size()) != kArgsMarker)
    {
        return std::nullopt;
    }
    position += kArgsMarker.size();

    TaggedEvent event;
    event.self = std::move(*self);
    while (position < json.size() && json[position] != ']')
    {
        if (!event.arguments.empty())
        {
            if (json[position] != ',')
            {
                return std::nullopt;
            }
            position++;
        }
        std::optional<TaggedValue> argument = taggedValueAt(json, position);
        if (!argument)
        {
            return std::nullopt;
        }
        event.arguments.push_back(std::move(*argument));
    }
    if (json.substr(position) != kEventClosing)
    {
        return std::nullopt;
    }
    return event;
}
}
