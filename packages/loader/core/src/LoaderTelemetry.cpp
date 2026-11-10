#include "LoaderTelemetry.h"

#include <cctype>
#include <regex>
#include <string>

namespace loader {
static bool isDiscordHost(std::string_view host)
{
    for (std::string_view domain : {"discord.com", "discordapp.com"})
    {
        if (host == domain ||
            (host.size() > domain.size() && host.substr(host.size() - domain.size()) == domain &&
             host[host.size() - domain.size() - 1] == '.'))
        {
            return true;
        }
    }
    return false;
}

bool isTelemetryURL(std::string_view url)
{
    static const std::regex pattern(R"(^https://([^/?#:]+)(?::\d+)?(/[^?#]*)?(?:[?#].*)?$)",
                                    std::regex::icase);
    static const std::regex path(R"(^/api(?:/v\d+)?/(?:science|metrics)(?:/.*)?$)",
                                 std::regex::icase);

    std::match_results<std::string_view::const_iterator> match;
    if (!std::regex_match(url.begin(), url.end(), match, pattern))
    {
        return false;
    }
    std::string host = match[1].str();
    for (char &character : host)
    {
        character = static_cast<char>(std::tolower(static_cast<unsigned char>(character)));
    }
    return isDiscordHost(host) && match[2].matched && std::regex_match(match[2].str(), path);
}
}
