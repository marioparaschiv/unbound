#include "LoaderTelemetry.h"

#include <cctype>
#include <initializer_list>
#include <regex>
#include <string>

namespace loader {
// Whether `host` is `domain` or one of its subdomains.
static bool isUnder(std::string_view host, std::string_view domain)
{
    return host == domain
           || (host.size() > domain.size() && host.substr(host.size() - domain.size()) == domain
               && host[host.size() - domain.size() - 1] == '.');
}

static bool isUnderAny(std::string_view host, std::initializer_list<std::string_view> domains)
{
    for (std::string_view domain : domains)
    {
        if (isUnder(host, domain))
        {
            return true;
        }
    }

    return false;
}

// Hosts that serve only crash reporting, attribution, video analytics or surveys, never a feature.
static bool isTrackerHost(std::string_view host)
{
    return isUnderAny(host, {"sentry.io", "appsflyer.com", "appsflyersdk.com", "litix.io",
                             "qualtrics.com", "app-measurement.com", "google-analytics.com",
                             "crashlytics.com"});
}

bool isTelemetryURL(std::string_view url)
{
    static const std::regex pattern(R"(^https://([^/?#:]+)(?::\d+)?(/[^?#]*)?(?:[?#].*)?$)",
                                    std::regex::icase);
    static const std::regex path(
        R"(^(?:/api(?:/v\d+)?/(?:science|metrics)|/error-reporting-proxy)(?:/.*)?$)",
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

    if (isTrackerHost(host))
    {
        return true;
    }

    return isUnderAny(host, {"discord.com", "discordapp.com"}) && match[2].matched
           && std::regex_match(match[2].str(), path);
}
}
