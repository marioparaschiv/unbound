#include "LoaderBundleSignature.h"

#include <array>
#include <cctype>
#include <cstdint>
#include <vector>

#include "LoaderCrypto.h"

#ifndef UNBOUND_BUNDLE_SIGNING_KEY
#define UNBOUND_BUNDLE_SIGNING_KEY ""
#endif

namespace loader {
static int base64Value(char character)
{
    if (character >= 'A' && character <= 'Z')
    {
        return character - 'A';
    }
    if (character >= 'a' && character <= 'z')
    {
        return character - 'a' + 26;
    }
    if (character >= '0' && character <= '9')
    {
        return character - '0' + 52;
    }
    if (character == '+')
    {
        return 62;
    }
    if (character == '/')
    {
        return 63;
    }
    return -1;
}

static std::string_view withoutSurroundingSpace(std::string_view value)
{
    while (!value.empty() && std::isspace(static_cast<unsigned char>(value.front())))
    {
        value.remove_prefix(1);
    }
    while (!value.empty() && std::isspace(static_cast<unsigned char>(value.back())))
    {
        value.remove_suffix(1);
    }
    return value;
}

std::optional<std::string> decodeBase64(std::string_view encoded)
{
    encoded = withoutSurroundingSpace(encoded);
    if (encoded.empty() || encoded.size() % 4 != 0)
    {
        return std::nullopt;
    }

    size_t padding = 0;
    while (padding < 2 && encoded.size() > padding && encoded[encoded.size() - 1 - padding] == '=')
    {
        padding++;
    }

    std::string decoded;
    decoded.reserve(encoded.size() / 4 * 3);
    uint32_t accumulator = 0;
    int      bits        = 0;
    for (size_t index = 0; index < encoded.size() - padding; index++)
    {
        int value = base64Value(encoded[index]);
        if (value < 0)
        {
            return std::nullopt;
        }
        accumulator = (accumulator << 6) | static_cast<uint32_t>(value);
        bits += 6;
        if (bits >= 8)
        {
            bits -= 8;
            decoded.push_back(static_cast<char>((accumulator >> bits) & 0xff));
        }
    }

    if ((accumulator & ((1u << bits) - 1)) != 0)
    {
        return std::nullopt;
    }
    return decoded;
}

std::string compiledBundleSigningKey()
{
    return UNBOUND_BUNDLE_SIGNING_KEY;
}

bool verifyBundleSignature(const std::string &bundle, const std::string &signatureBase64,
                           const std::string &publicKeyBase64)
{
    std::optional<std::string> publicKey = decodeBase64(publicKeyBase64);
    std::optional<std::string> signature = decodeBase64(signatureBase64);
    return publicKey && signature && crypto::verifyEd25519(bundle, *signature, *publicKey);
}

static std::string lowercase(std::string value)
{
    for (char &character : value)
    {
        character = static_cast<char>(std::tolower(static_cast<unsigned char>(character)));
    }
    return value;
}

static std::optional<std::array<int, 4>> ipv4Octets(const std::string &host)
{
    std::array<int, 4> octets{};
    size_t             start = 0;
    for (size_t index = 0; index < octets.size(); index++)
    {
        size_t end = index + 1 < octets.size() ? host.find('.', start) : host.size();
        if (end == std::string::npos || end == start || end - start > 3)
        {
            return std::nullopt;
        }
        int value = 0;
        for (size_t position = start; position < end; position++)
        {
            if (!std::isdigit(static_cast<unsigned char>(host[position])))
            {
                return std::nullopt;
            }
            value = value * 10 + (host[position] - '0');
        }
        if (value > 255)
        {
            return std::nullopt;
        }
        octets[index] = value;
        start         = end + 1;
    }
    return octets;
}

static bool isPrivateIPv4(const std::string &host)
{
    std::optional<std::array<int, 4>> octets = ipv4Octets(host);
    if (!octets)
    {
        return false;
    }
    int first  = (*octets)[0];
    int second = (*octets)[1];
    return first == 127 || first == 10 || (first == 172 && second >= 16 && second <= 31) ||
           (first == 192 && second == 168) || (first == 169 && second == 254);
}

static bool hasSuffix(const std::string &value, const std::string &suffix)
{
    return value.size() > suffix.size() &&
           value.compare(value.size() - suffix.size(), suffix.size(), suffix) == 0;
}

static std::optional<std::string> httpHost(const std::string &url)
{
    const std::string scheme = "http://";
    if (lowercase(url.substr(0, scheme.size())) != scheme)
    {
        return std::nullopt;
    }

    size_t      authorityEnd = url.find_first_of("/?#", scheme.size());
    std::string authority =
        url.substr(scheme.size(), authorityEnd == std::string::npos ? std::string::npos
                                                                    : authorityEnd - scheme.size());
    size_t credentials = authority.rfind('@');
    if (credentials != std::string::npos)
    {
        authority.erase(0, credentials + 1);
    }

    if (!authority.empty() && authority.front() == '[')
    {
        size_t closing = authority.find(']');
        return closing == std::string::npos
                   ? std::nullopt
                   : std::optional<std::string>(lowercase(authority.substr(1, closing - 1)));
    }
    return lowercase(authority.substr(0, authority.find(':')));
}

bool isDevelopmentBundleURL(const std::string &url)
{
    std::optional<std::string> host = httpHost(url);
    if (!host || host->empty())
    {
        return false;
    }
    return *host == "localhost" || hasSuffix(*host, ".localhost") || hasSuffix(*host, ".local") ||
           *host == "::1" || isPrivateIPv4(*host);
}
}
