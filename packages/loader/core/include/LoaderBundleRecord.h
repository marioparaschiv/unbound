#pragma once

#include <nlohmann/json.hpp>
#include <optional>
#include <string>

namespace loader {
// A bundle's verification record (`<bundle>.trust`) as an object, or null when absent or malformed.
inline nlohmann::json parseBundleRecord(const std::optional<std::string> &text)
{
    if (!text)
    {
        return nlohmann::json();
    }
    nlohmann::json record = nlohmann::json::parse(*text, nullptr, false);
    return record.is_object() ? record : nlohmann::json();
}

// One string field of a verification record, or empty when it is missing or not a string.
inline std::string bundleRecordField(const nlohmann::json &record, const char *key)
{
    auto field = record.find(key);
    return field != record.end() && field->is_string() ? field->get<std::string>() : "";
}
}
