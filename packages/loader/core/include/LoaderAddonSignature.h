#pragma once

#include <nlohmann/json.hpp>
#include <string>

#include "LoaderBundleSignature.h"

namespace loader {
enum class AddonSignatureStatus
{
    Unsigned,
    Signed,
    Invalid,
};

struct AddonSignatureResult {
    AddonSignatureStatus status = AddonSignatureStatus::Unsigned;
    TrustedSigner        signer = TrustedSigner::None;
    std::string          problem;
};

std::string addonSigningMessage(const std::string &id, const std::string &version,
                                const std::string &bundle, const nlohmann::json &bytecode = nullptr,
                                const std::string *bundleDigest = nullptr);
bool        isValidBytecodeDigests(const nlohmann::json &bytecode);
AddonSignatureResult verifyAddonSignature(const nlohmann::json &manifest, const std::string &bundle,
                                          const BundleTrust &trust,
                                          const std::string *bundleDigest = nullptr);
const char          *describeAddonSignature(AddonSignatureStatus status);
}
