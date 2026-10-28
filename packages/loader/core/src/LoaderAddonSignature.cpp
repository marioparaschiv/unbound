#include "LoaderAddonSignature.h"

#include <algorithm>
#include <utility>
#include <vector>

namespace loader {
static bool isBytecodeVersionKey(const std::string &key)
{
    return !key.empty() && key.size() <= 10 && std::all_of(key.begin(), key.end(), [](char c) {
        return c >= '0' && c <= '9';
    });
}

static bool isSha512Hex(const nlohmann::json &value)
{
    if (!value.is_string())
    {
        return false;
    }
    const auto &digest = value.get_ref<const std::string &>();
    return digest.size() == 128 && std::all_of(digest.begin(), digest.end(), [](char c) {
               return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f');
           });
}

bool isValidBytecodeDigests(const nlohmann::json &bytecode)
{
    if (!bytecode.is_object())
    {
        return false;
    }
    for (auto entry = bytecode.begin(); entry != bytecode.end(); ++entry)
    {
        if (!isBytecodeVersionKey(entry.key()) || !isSha512Hex(entry.value()))
        {
            return false;
        }
    }
    return true;
}

static std::vector<std::pair<uint64_t, std::string>> sortedDigests(const nlohmann::json &bytecode)
{
    std::vector<std::pair<uint64_t, std::string>> digests;
    if (!isValidBytecodeDigests(bytecode))
    {
        return digests;
    }
    for (auto entry = bytecode.begin(); entry != bytecode.end(); ++entry)
    {
        digests.emplace_back(std::stoull(entry.key()), entry.value().get<std::string>());
    }
    std::sort(digests.begin(), digests.end());
    return digests;
}

std::string addonSigningMessage(const std::string &id, const std::string &version,
                                const std::string &bundle, const nlohmann::json &bytecode)
{
    std::string message = "unbound-addon/v1\n" + id + "\n" + version + "\n" + sha512Hex(bundle);
    for (const auto &[bytecodeVersion, digest] : sortedDigests(bytecode))
    {
        message += "\nbytecode " + std::to_string(bytecodeVersion) + " " + digest;
    }
    return message;
}

static std::string stringField(const nlohmann::json &object, const char *key)
{
    auto field = object.find(key);
    return field != object.end() && field->is_string() ? field->get<std::string>() : "";
}

AddonSignatureResult verifyAddonSignature(const nlohmann::json &manifest, const std::string &bundle,
                                          const BundleTrust &trust)
{
    auto signature = manifest.find("signature");
    if (signature == manifest.end() || signature->is_null())
    {
        return {AddonSignatureStatus::Unsigned, TrustedSigner::None, {}};
    }
    if (!signature->is_object() || !(*signature)["version"].is_number_integer() ||
        (*signature)["version"].get<int64_t>() != 1)
    {
        return {AddonSignatureStatus::Invalid, TrustedSigner::None,
                "the manifest signature has an unknown format"};
    }

    std::string ed25519 = stringField(*signature, "ed25519");
    std::string id      = stringField(manifest, "id");
    std::string version = stringField(manifest, "version");
    if (ed25519.empty() || id.empty() || version.empty())
    {
        return {AddonSignatureStatus::Invalid, TrustedSigner::None,
                "the manifest signature, id or version is missing"};
    }
    auto bytecode = manifest.find("bytecode");
    if (bytecode != manifest.end() && !isValidBytecodeDigests(*bytecode))
    {
        return {AddonSignatureStatus::Invalid, TrustedSigner::None,
                "manifest.bytecode must map bytecode versions to SHA-512 digests"};
    }
    if (!trust.isEnabled())
    {
        return {AddonSignatureStatus::Unsigned, TrustedSigner::None,
                "this loader was built without a signing key"};
    }

    TrustedSigner signer = verifyTrustedSignature(
        addonSigningMessage(id, version, bundle,
                            bytecode != manifest.end() ? *bytecode : nlohmann::json()),
        ed25519, trust);
    if (signer == TrustedSigner::None)
    {
        return {AddonSignatureStatus::Invalid, TrustedSigner::None,
                "the signature does not match the bundle"};
    }
    return {AddonSignatureStatus::Signed, signer, {}};
}

const char *describeAddonSignature(AddonSignatureStatus status)
{
    switch (status)
    {
        case AddonSignatureStatus::Signed:
            return "signed";
        case AddonSignatureStatus::Invalid:
            return "invalid";
        case AddonSignatureStatus::Unsigned:
            return "unsigned";
    }
    return "unsigned";
}
}
