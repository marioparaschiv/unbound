#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <string_view>

namespace loader {
constexpr const char *kBundleSignatureSuffix = ".sig";

struct BundleTrust {
    std::string productionKey;
    std::string pullRequestKey;
    uint32_t    pullRequestNumber = 0;

    bool isEnabled() const;
    bool trustsPullRequestKey() const;
};

std::optional<std::string> decodeBase64(std::string_view encoded);
std::string                compiledBundleSigningKey();
BundleTrust                compiledBundleTrust();
std::string                pullRequestSigningContext(uint32_t pullRequestNumber);
std::string                sha512Hex(std::string_view data);

bool verifyBundleSignature(const std::string &bundle, const std::string &signatureBase64,
                           const std::string &publicKeyBase64);

enum class TrustedSigner
{
    None,
    Production,
    PullRequest
};

TrustedSigner verifyTrustedSignature(const std::string &message, const std::string &signatureBase64,
                                     const BundleTrust &trust);
std::string   describeSigner(TrustedSigner signer, const BundleTrust &trust);

bool isDevelopmentBundleURL(const std::string &url);
}
