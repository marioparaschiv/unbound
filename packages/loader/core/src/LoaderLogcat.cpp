#include "LoaderLogcat.h"

#include <array>
#include <cctype>
#include <cstdio>

namespace loader {
static bool startsWith(std::string_view value, std::string_view prefix)
{
    return value.substr(0, prefix.size()) == prefix;
}

static bool containsInsensitive(std::string_view value, std::string_view needle)
{
    if (needle.size() > value.size())
    {
        return false;
    }
    for (std::size_t start = 0; start + needle.size() <= value.size(); start++)
    {
        std::size_t index = 0;
        while (index < needle.size() &&
               std::tolower(static_cast<unsigned char>(value[start + index])) ==
                   std::tolower(static_cast<unsigned char>(needle[index])))
        {
            index++;
        }
        if (index == needle.size())
        {
            return true;
        }
    }
    return false;
}

std::optional<LogSource> logcatTagSource(std::string_view tag)
{
    if (tag == kLoaderLogcatTag || tag == "ReactNativeJS" || tag == "unknown:ReactNativeJS")
    {
        return std::nullopt;
    }
    // FLog writes React Native's Java tags as `unknown:<tag>`.
    std::string_view name = startsWith(tag, "unknown:") ? tag.substr(8) : tag;
    static constexpr std::array<std::string_view, 5> kReactNativeTags = {
        "SoLoader", "BridgelessReact", "MountingManager", "SurfaceMountingManager", "UIManager"};
    for (std::string_view known : kReactNativeTags)
    {
        if (name == known)
        {
            return LogSource::ReactNative;
        }
    }
    if (startsWith(name, "React") || containsInsensitive(name, "Fabric") ||
        containsInsensitive(name, "Hermes"))
    {
        return LogSource::ReactNative;
    }
    return LogSource::Native;
}

static std::optional<LogLevel> logcatLevel(char priority)
{
    switch (priority)
    {
        case 'V':
        case 'D':
            return LogLevel::Debug;
        case 'I':
            return LogLevel::Info;
        case 'W':
            return LogLevel::Warning;
        case 'E':
        case 'F':
        case 'A':
            return LogLevel::Error;
        default:
            return std::nullopt;
    }
}

static void skipSpaces(std::string_view &rest)
{
    while (!rest.empty() && rest.front() == ' ')
    {
        rest.remove_prefix(1);
    }
}

// Reads up to `maximumDigits` digits as a number and skips any further digits.
static std::optional<long long> readNumber(std::string_view &rest, std::size_t maximumDigits = 18)
{
    long long   value  = 0;
    std::size_t digits = 0;
    while (!rest.empty() && std::isdigit(static_cast<unsigned char>(rest.front())))
    {
        if (digits < maximumDigits)
        {
            value = value * 10 + (rest.front() - '0');
        }
        digits++;
        rest.remove_prefix(1);
    }
    if (digits == 0)
    {
        return std::nullopt;
    }
    return value;
}

static std::optional<long long> readTime(std::string_view &rest)
{
    std::optional<long long> seconds = readNumber(rest);
    if (!seconds || rest.empty() || rest.front() != '.')
    {
        return std::nullopt;
    }
    rest.remove_prefix(1);
    // `-v usec` and `-v nsec` print more fractional digits; only milliseconds are kept.
    std::size_t              before       = rest.size();
    std::optional<long long> milliseconds = readNumber(rest, 3);
    if (!milliseconds)
    {
        return std::nullopt;
    }
    for (std::size_t digits = before - rest.size(); digits < 3; digits++)
    {
        *milliseconds *= 10;
    }
    return *seconds * 1000 + *milliseconds;
}

std::optional<LogEntry> logcatEntry(std::string_view line)
{
    while (!line.empty() && (line.back() == '\n' || line.back() == '\r'))
    {
        line.remove_suffix(1);
    }
    std::string_view rest = line;
    skipSpaces(rest);
    std::optional<long long> time = readTime(rest);
    skipSpaces(rest);
    std::optional<long long> pid = readNumber(rest);
    skipSpaces(rest);
    std::optional<long long> tid = readNumber(rest);
    skipSpaces(rest);
    if (!time || !pid || !tid || rest.size() < 2 || rest[1] != ' ')
    {
        return std::nullopt;
    }
    std::optional<LogLevel> level = logcatLevel(rest.front());
    rest.remove_prefix(2);
    // logcat pads short tags with spaces before the `: ` separator.
    std::size_t separator = rest.find(": ");
    if (!level || separator == std::string_view::npos)
    {
        if (!level || rest.empty() || rest.back() != ':')
        {
            return std::nullopt;
        }
        separator = rest.size() - 1;
    }
    std::string_view tag = rest.substr(0, separator);
    while (!tag.empty() && tag.back() == ' ')
    {
        tag.remove_suffix(1);
    }
    std::optional<LogSource> source = logcatTagSource(tag);
    if (tag.empty() || !source)
    {
        return std::nullopt;
    }
    std::string_view message = rest.substr(std::min(rest.size(), separator + 2));
    return LogEntry{*time, *source, *level, {std::string(tag)}, std::string(message)};
}

std::string logcatTime(long long time)
{
    char buffer[32];
    std::snprintf(buffer, sizeof(buffer), "%lld.%03lld", time / 1000, time % 1000);
    return buffer;
}
}
