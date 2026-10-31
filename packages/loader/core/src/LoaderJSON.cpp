#include "LoaderJSON.h"

#include <utility>
#include <vector>

namespace loader {
static size_t validSequenceLength(const std::string &text, size_t index)
{
    auto          lead = static_cast<unsigned char>(text[index]);
    size_t        length;
    unsigned char lowest  = 0x80;
    unsigned char highest = 0xBF;
    if (lead < 0x80)
    {
        return 1;
    }
    if (lead >= 0xC2 && lead <= 0xDF)
    {
        length = 2;
    }
    else if (lead >= 0xE0 && lead <= 0xEF)
    {
        length  = 3;
        lowest  = lead == 0xE0 ? 0xA0 : 0x80;
        highest = lead == 0xED ? 0x9F : 0xBF;
    }
    else if (lead >= 0xF0 && lead <= 0xF4)
    {
        length  = 4;
        lowest  = lead == 0xF0 ? 0x90 : 0x80;
        highest = lead == 0xF4 ? 0x8F : 0xBF;
    }
    else
    {
        return 0;
    }
    if (index + length > text.size())
    {
        return 0;
    }
    for (size_t offset = 1; offset < length; offset++)
    {
        auto          continuation = static_cast<unsigned char>(text[index + offset]);
        unsigned char minimum      = offset == 1 ? lowest : 0x80;
        unsigned char maximum      = offset == 1 ? highest : 0xBF;
        if (continuation < minimum || continuation > maximum)
        {
            return 0;
        }
    }
    return length;
}

std::string withValidUTF8(const std::string &text)
{
    std::string result;
    size_t      copied = 0;
    size_t      index  = 0;
    while (index < text.size())
    {
        size_t length = validSequenceLength(text, index);
        if (length > 0)
        {
            index += length;
            continue;
        }
        result.append(text, copied, index - copied);
        result.append("\xEF\xBF\xBD");
        index++;
        copied = index;
    }
    if (copied == 0)
    {
        return text;
    }
    result.append(text, copied, std::string::npos);
    return result;
}

static bool textNestsTooDeeply(const std::string &text, size_t maximumDepth)
{
    size_t depth    = 0;
    bool   inString = false;
    bool   escaped  = false;
    for (char character : text)
    {
        if (inString)
        {
            if (escaped)
            {
                escaped = false;
            }
            else if (character == '\\')
            {
                escaped = true;
            }
            else if (character == '"')
            {
                inString = false;
            }
            continue;
        }
        if (character == '"')
        {
            inString = true;
        }
        else if (character == '{' || character == '[')
        {
            if (++depth > maximumDepth)
            {
                return true;
            }
        }
        else if ((character == '}' || character == ']') && depth > 0)
        {
            depth--;
        }
    }
    return false;
}

bool jsonNestsTooDeeply(const nlohmann::json &value, size_t maximumDepth)
{
    std::vector<std::pair<const nlohmann::json *, size_t>> pending{{&value, 1}};
    while (!pending.empty())
    {
        auto [current, depth] = pending.back();
        pending.pop_back();
        if (!current->is_structured())
        {
            continue;
        }
        if (depth > maximumDepth)
        {
            return true;
        }
        for (const nlohmann::json &child : *current)
        {
            pending.emplace_back(&child, depth + 1);
        }
    }
    return false;
}

nlohmann::json parseBoundedJSON(const std::string &text, size_t maximumDepth)
{
    if (textNestsTooDeeply(text, maximumDepth))
    {
        return nlohmann::json(nlohmann::json::value_t::discarded);
    }
    return nlohmann::json::parse(text, nullptr, false);
}
}
