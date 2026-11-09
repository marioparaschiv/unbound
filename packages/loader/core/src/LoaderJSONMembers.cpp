#include "LoaderJSONMembers.h"

#include <nlohmann/json.hpp>

namespace loader {
static constexpr size_t kEnd = std::string_view::npos;

static bool isSpace(char character)
{
    return character == ' ' || character == '\n' || character == '\r' || character == '\t';
}

static size_t skipSpace(std::string_view text, size_t index)
{
    while (index < text.size() && isSpace(text[index]))
    {
        index++;
    }
    return index;
}

// The index just past the string that opens at `index`, or kEnd when it never closes.
static size_t skipString(std::string_view text, size_t index)
{
    for (index++;; index += 2)
    {
        index = text.find_first_of("\"\\", index);
        if (index == kEnd)
        {
            return kEnd;
        }
        if (text[index] == '"')
        {
            return index + 1;
        }
    }
}

// The index just past the value that starts at `index`, or kEnd when it is malformed.
static size_t skipValue(std::string_view text, size_t index, size_t maximumDepth)
{
    if (index >= text.size())
    {
        return kEnd;
    }
    char first = text[index];
    if (first == '"')
    {
        return skipString(text, index);
    }
    if (first != '{' && first != '[')
    {
        size_t end = index;
        while (end < text.size() && !isSpace(text[end]) && text[end] != ',' && text[end] != '}' &&
               text[end] != ']')
        {
            end++;
        }
        return end > index ? end : kEnd;
    }

    std::string closers;
    for (; index < text.size(); index++)
    {
        char character = text[index];
        if (character == '"')
        {
            index = skipString(text, index);
            if (index == kEnd)
            {
                return kEnd;
            }
            index--;
        }
        else if (character == '{' || character == '[')
        {
            if (closers.size() >= maximumDepth)
            {
                return kEnd;
            }
            closers.push_back(character == '{' ? '}' : ']');
        }
        else if (character == '}' || character == ']')
        {
            if (closers.empty() || closers.back() != character)
            {
                return kEnd;
            }
            closers.pop_back();
            if (closers.empty())
            {
                return index + 1;
            }
        }
    }
    return kEnd;
}

std::optional<std::vector<JSONMember>> splitJSONObject(std::string_view text, size_t maximumDepth)
{
    size_t index = skipSpace(text, 0);
    if (maximumDepth == 0 || index >= text.size() || text[index] != '{')
    {
        return std::nullopt;
    }

    std::vector<JSONMember> members;
    index = skipSpace(text, index + 1);
    if (index < text.size() && text[index] == '}')
    {
        return skipSpace(text, index + 1) == text.size() ? std::optional(members) : std::nullopt;
    }

    while (true)
    {
        if (index >= text.size() || text[index] != '"')
        {
            return std::nullopt;
        }
        size_t keyEnd = skipString(text, index);
        if (keyEnd == kEnd)
        {
            return std::nullopt;
        }
        // nlohmann decodes escapes and rejects invalid UTF-8, as a whole-file parse would.
        nlohmann::json key =
            nlohmann::json::parse(text.begin() + index, text.begin() + keyEnd, nullptr, false);
        if (!key.is_string())
        {
            return std::nullopt;
        }

        index = skipSpace(text, keyEnd);
        if (index >= text.size() || text[index] != ':')
        {
            return std::nullopt;
        }
        index           = skipSpace(text, index + 1);
        size_t valueEnd = skipValue(text, index, maximumDepth - 1);
        if (valueEnd == kEnd)
        {
            return std::nullopt;
        }
        members.push_back({key.get<std::string>(), text.substr(index, valueEnd - index)});

        index = skipSpace(text, valueEnd);
        if (index < text.size() && text[index] == ',')
        {
            index = skipSpace(text, index + 1);
            continue;
        }
        if (index < text.size() && text[index] == '}')
        {
            break;
        }
        return std::nullopt;
    }
    return skipSpace(text, index + 1) == text.size() ? std::optional(std::move(members))
                                                     : std::nullopt;
}
}
