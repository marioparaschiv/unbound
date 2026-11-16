#include "LoaderBase64.h"

#include <array>

namespace loader {
static constexpr std::string_view kAlphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static constexpr std::array<std::int8_t, 256> decodingTable()
{
    std::array<std::int8_t, 256> table{};
    for (auto &entry : table)
    {
        entry = -1;
    }

    for (std::size_t index = 0; index < kAlphabet.size(); index++)
    {
        table[static_cast<unsigned char>(kAlphabet[index])] = static_cast<std::int8_t>(index);
    }

    return table;
}

std::string base64Encode(const std::uint8_t *bytes, std::size_t length)
{
    std::string text;
    text.reserve((length + 2) / 3 * 4);
    for (std::size_t index = 0; index < length; index += 3)
    {
        std::uint32_t chunk = static_cast<std::uint32_t>(bytes[index]) << 16;
        if (index + 1 < length)
        {
            chunk |= static_cast<std::uint32_t>(bytes[index + 1]) << 8;
        }

        if (index + 2 < length)
        {
            chunk |= bytes[index + 2];
        }

        text += kAlphabet[(chunk >> 18) & 63];
        text += kAlphabet[(chunk >> 12) & 63];
        text += index + 1 < length ? kAlphabet[(chunk >> 6) & 63] : '=';
        text += index + 2 < length ? kAlphabet[chunk & 63] : '=';
    }

    return text;
}

std::optional<std::vector<std::uint8_t>> base64Decode(std::string_view text)
{
    static constexpr auto kTable = decodingTable();
    if (text.size() % 4 != 0)
    {
        return std::nullopt;
    }

    std::vector<std::uint8_t> bytes;
    bytes.reserve(text.size() / 4 * 3);
    for (std::size_t index = 0; index < text.size(); index += 4)
    {
        std::uint32_t chunk = 0;
        std::size_t padding = 0;
        for (std::size_t offset = 0; offset < 4; offset++)
        {
            char character = text[index + offset];
            bool last      = index + 4 == text.size();
            if (character == '=' && last && offset >= 2)
            {
                padding++;
                chunk <<= 6;
                continue;
            }

            std::int8_t value = kTable[static_cast<unsigned char>(character)];
            if (value < 0 || padding)
            {
                return std::nullopt;
            }

            chunk = (chunk << 6) | static_cast<std::uint32_t>(value);
        }

        bytes.push_back(static_cast<std::uint8_t>(chunk >> 16));
        if (padding < 2)
        {
            bytes.push_back(static_cast<std::uint8_t>(chunk >> 8));
        }

        if (padding < 1)
        {
            bytes.push_back(static_cast<std::uint8_t>(chunk));
        }
    }

    return bytes;
}
}
