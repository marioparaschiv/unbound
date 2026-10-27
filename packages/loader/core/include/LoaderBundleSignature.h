#pragma once

#include <optional>
#include <string>
#include <string_view>

namespace loader {
constexpr const char *kBundleSignatureSuffix = ".sig";

std::optional<std::string> decodeBase64(std::string_view encoded);
std::string                compiledBundleSigningKey();
bool verifyBundleSignature(const std::string &bundle, const std::string &signatureBase64,
                           const std::string &publicKeyBase64);
bool isDevelopmentBundleURL(const std::string &url);
}
