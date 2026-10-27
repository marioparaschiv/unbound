#include "LoaderBundleManifest.h"

#include <cctype>
#include <limits>
#include <nlohmann/json.hpp>

namespace loader {
static constexpr size_t kSha512HexSize = 128;

static bool isSha512Hex(const std::string &value)
{
    if (value.size() != kSha512HexSize)
    {
        return false;
    }
    for (char character : value)
    {
        if (!std::isdigit(static_cast<unsigned char>(character)) &&
            (character < 'a' || character > 'f'))
        {
            return false;
        }
    }
    return true;
}

static std::optional<int> digitsAt(std::string_view text, size_t offset, size_t count)
{
    if (offset + count > text.size())
    {
        return std::nullopt;
    }
    int value = 0;
    for (size_t index = offset; index < offset + count; index++)
    {
        if (!std::isdigit(static_cast<unsigned char>(text[index])))
        {
            return std::nullopt;
        }
        value = value * 10 + (text[index] - '0');
    }
    return value;
}

static int64_t daysSinceEpoch(int year, int month, int day)
{
    year -= month <= 2 ? 1 : 0;
    const int64_t era       = (year >= 0 ? year : year - 399) / 400;
    const int64_t yearOfEra = year - era * 400;
    const int64_t dayOfYear = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 + day - 1;
    const int64_t dayOfEra  = yearOfEra * 365 + yearOfEra / 4 - yearOfEra / 100 + dayOfYear;
    return era * 146097 + dayOfEra - 719468;
}

static int daysInMonth(int year, int month)
{
    static constexpr int kDays[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
    const bool           leap    = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
    return month == 2 && leap ? 29 : kDays[month - 1];
}

std::optional<int64_t> parseBuildTime(std::string_view text)
{
    if (text.size() < 20 || text[4] != '-' || text[7] != '-' || text[10] != 'T' ||
        text[13] != ':' || text[16] != ':' || text.back() != 'Z')
    {
        return std::nullopt;
    }

    std::optional<int> year   = digitsAt(text, 0, 4);
    std::optional<int> month  = digitsAt(text, 5, 2);
    std::optional<int> day    = digitsAt(text, 8, 2);
    std::optional<int> hour   = digitsAt(text, 11, 2);
    std::optional<int> minute = digitsAt(text, 14, 2);
    std::optional<int> second = digitsAt(text, 17, 2);
    if (!year || !month || !day || !hour || !minute || !second || *month < 1 || *month > 12 ||
        *day < 1 || *day > daysInMonth(*year, *month) || *hour > 23 || *minute > 59 || *second > 59)
    {
        return std::nullopt;
    }

    int milliseconds = 0;
    if (text.size() > 20)
    {
        size_t fractionDigits = text.size() - 21;
        if (text[19] != '.' || fractionDigits < 1 || fractionDigits > 3)
        {
            return std::nullopt;
        }
        std::optional<int> fraction = digitsAt(text, 20, fractionDigits);
        if (!fraction)
        {
            return std::nullopt;
        }
        milliseconds = *fraction * (fractionDigits == 1 ? 100 : fractionDigits == 2 ? 10 : 1);
    }

    const int64_t seconds =
        daysSinceEpoch(*year, *month, *day) * 86400 + *hour * 3600 + *minute * 60 + *second;
    return seconds * 1000 + milliseconds;
}

static std::string stringField(const nlohmann::json &object, const char *key)
{
    auto field = object.find(key);
    return field != object.end() && field->is_string() ? field->get<std::string>() : "";
}

std::optional<BundleManifest> parseBundleManifest(const std::string &text)
{
    nlohmann::json json = nlohmann::json::parse(text, nullptr, false);
    if (json.is_discarded() || !json.is_object())
    {
        return std::nullopt;
    }

    BundleManifest manifest;
    manifest.revision              = stringField(json, "revision");
    manifest.channel               = stringField(json, "channel");
    manifest.buildTime             = stringField(json, "buildTime");
    manifest.buildTimeMilliseconds = parseBuildTime(manifest.buildTime);

    auto versions = json.find("bytecodeVersions");
    if (versions != json.end() && versions->is_array())
    {
        for (const nlohmann::json &version : *versions)
        {
            if (version.is_number_unsigned() &&
                version.get<uint64_t>() <= std::numeric_limits<uint32_t>::max())
            {
                manifest.bytecodeVersions.push_back(version.get<uint32_t>());
            }
        }
    }

    auto hashes = json.find("sha512");
    if (hashes != json.end() && hashes->is_object())
    {
        for (const auto &[file, hash] : hashes->items())
        {
            if (hash.is_string() && isSha512Hex(hash.get<std::string>()))
            {
                manifest.sha512[file] = hash.get<std::string>();
            }
        }
    }
    return manifest;
}

bool BundleManifest::isSignable() const
{
    return buildTimeMilliseconds.has_value() && !revision.empty() && !channel.empty() &&
           !sha512.empty();
}

std::string BundleManifest::bundleFile(uint32_t bytecodeVersion) const
{
    for (uint32_t version : bytecodeVersions)
    {
        if (version == bytecodeVersion)
        {
            return "unbound." + std::to_string(bytecodeVersion) + ".bundle";
        }
    }
    return "unbound.js";
}

std::string serializeBaseline(const BundleBaseline &baseline)
{
    return nlohmann::json{{"source", baseline.source},
                          {"channel", baseline.channel},
                          {"buildTime", baseline.buildTime},
                          {"revision", baseline.revision}}
        .dump();
}

std::optional<BundleBaseline> parseBaseline(const std::string &text)
{
    if (text.empty())
    {
        return std::nullopt;
    }
    nlohmann::json json = nlohmann::json::parse(text, nullptr, false);
    if (json.is_discarded() || !json.is_object())
    {
        return std::nullopt;
    }

    BundleBaseline baseline;
    baseline.source                              = stringField(json, "source");
    baseline.channel                             = stringField(json, "channel");
    baseline.buildTime                           = stringField(json, "buildTime");
    baseline.revision                            = stringField(json, "revision");
    std::optional<int64_t> buildTimeMilliseconds = parseBuildTime(baseline.buildTime);
    if (baseline.source.empty() || !buildTimeMilliseconds)
    {
        return std::nullopt;
    }
    baseline.buildTimeMilliseconds = *buildTimeMilliseconds;
    return baseline;
}

BundleBaseline baselineFromManifest(const BundleManifest &manifest, const std::string &source)
{
    BundleBaseline baseline;
    baseline.source                = source;
    baseline.channel               = manifest.channel;
    baseline.buildTime             = manifest.buildTime;
    baseline.revision              = manifest.revision;
    baseline.buildTimeMilliseconds = manifest.buildTimeMilliseconds.value_or(0);
    return baseline;
}

std::optional<std::string> rollbackProblem(const BundleManifest                &manifest,
                                           const std::string                   &source,
                                           const std::optional<BundleBaseline> &baseline)
{
    if (!baseline || baseline->source != source)
    {
        return std::nullopt;
    }
    if (manifest.channel != baseline->channel)
    {
        return "its channel " + manifest.channel + " is not the active bundle's channel " +
               baseline->channel;
    }
    if (!manifest.buildTimeMilliseconds ||
        *manifest.buildTimeMilliseconds < baseline->buildTimeMilliseconds)
    {
        return "it was built at " + manifest.buildTime + ", before the active bundle (" +
               baseline->revision + ", built at " + baseline->buildTime + ")";
    }
    return std::nullopt;
}
}
