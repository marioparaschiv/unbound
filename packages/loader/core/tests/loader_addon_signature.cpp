#include <array>
#include <cassert>
#include <cstdint>
#include <string>

#include "LoaderAddonSignature.h"

extern "C" {
#include "monocypher/monocypher-ed25519.h"
}

static std::string base64(const uint8_t *data, size_t size)
{
    static const char alphabet[] =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string encoded;
    for (size_t index = 0; index < size; index += 3)
    {
        uint32_t chunk = static_cast<uint32_t>(data[index]) << 16;
        if (index + 1 < size)
            chunk |= static_cast<uint32_t>(data[index + 1]) << 8;
        if (index + 2 < size)
            chunk |= data[index + 2];
        encoded += alphabet[(chunk >> 18) & 63];
        encoded += alphabet[(chunk >> 12) & 63];
        encoded += index + 1 < size ? alphabet[(chunk >> 6) & 63] : '=';
        encoded += index + 2 < size ? alphabet[chunk & 63] : '=';
    }
    return encoded;
}

struct Signer {
    std::array<uint8_t, 64> secret{};
    std::array<uint8_t, 32> publicKey{};

    explicit Signer(uint8_t fill)
    {
        std::array<uint8_t, 32> seed{};
        seed.fill(fill);
        crypto_ed25519_key_pair(secret.data(), publicKey.data(), seed.data());
    }

    std::string publicBase64() const
    {
        return base64(publicKey.data(), publicKey.size());
    }

    std::string sign(const std::string &message) const
    {
        std::array<uint8_t, 64> signature{};
        crypto_ed25519_sign(signature.data(), secret.data(),
                            reinterpret_cast<const uint8_t *>(message.data()), message.size());
        return base64(signature.data(), signature.size());
    }
};

static nlohmann::json signedManifest(const Signer &signer, const std::string &bundle)
{
    nlohmann::json manifest = {{"id", "unbound.example"}, {"version", "1.2.3"}};
    manifest["signature"]   = {
        {"version", 1},
        {"ed25519", signer.sign(loader::addonSigningMessage("unbound.example", "1.2.3", bundle))}};
    return manifest;
}

int main()
{
    Signer              production(7);
    Signer              stranger(9);
    loader::BundleTrust trust;
    trust.productionKey = production.publicBase64();

    const std::string bundle   = "(()=>({start(){},stop(){}}))";
    nlohmann::json    manifest = signedManifest(production, bundle);

    auto verified = loader::verifyAddonSignature(manifest, bundle, trust);
    assert(verified.status == loader::AddonSignatureStatus::Signed);
    assert(verified.signer == loader::TrustedSigner::Production);

    assert(loader::verifyAddonSignature(manifest, bundle + " ", trust).status ==
           loader::AddonSignatureStatus::Invalid);

    nlohmann::json bumped = manifest;
    bumped["version"]     = "1.2.4";
    assert(loader::verifyAddonSignature(bumped, bundle, trust).status ==
           loader::AddonSignatureStatus::Invalid);

    nlohmann::json renamed = manifest;
    renamed["id"]          = "unbound.other";
    assert(loader::verifyAddonSignature(renamed, bundle, trust).status ==
           loader::AddonSignatureStatus::Invalid);

    assert(loader::verifyAddonSignature(signedManifest(stranger, bundle), bundle, trust).status ==
           loader::AddonSignatureStatus::Invalid);

    nlohmann::json unsignedManifest = {{"id", "unbound.example"}, {"version", "1.2.3"}};
    assert(loader::verifyAddonSignature(unsignedManifest, bundle, trust).status ==
           loader::AddonSignatureStatus::Unsigned);

    nlohmann::json future          = manifest;
    future["signature"]["version"] = 2;
    assert(loader::verifyAddonSignature(future, bundle, trust).status ==
           loader::AddonSignatureStatus::Invalid);

    nlohmann::json malformed = manifest;
    malformed["signature"]   = "not an object";
    assert(loader::verifyAddonSignature(malformed, bundle, trust).status ==
           loader::AddonSignatureStatus::Invalid);

    assert(loader::verifyAddonSignature(manifest, bundle, loader::BundleTrust{}).status ==
           loader::AddonSignatureStatus::Unsigned);

    loader::BundleTrust published;
    published.productionKey          = "6kpsY+KcUgq+9VB7Ey7F+ZVHdq6+vnuSQh7qaRRG0iw=";
    nlohmann::json fromPluginScripts = {
        {"id", "unbound.example"},
        {"version", "1.2.3"},
        {"signature",
         {{"version", 1},
          {"ed25519", "B/1NUxkn6rRdg/SVy2pTYAbi23ZM0OgMD/u88q6s7NoWxbmvz5EmiKzyyRMXTQk4jNFQpjx+"
                      "OwMmwlO0nyuEAA=="}}}};
    assert(loader::verifyAddonSignature(fromPluginScripts, bundle, published).status ==
           loader::AddonSignatureStatus::Signed);
    assert(production.publicBase64() == published.productionKey);

    assert(loader::addonSigningMessage("a", "1.0.0", "x") ==
           "unbound-addon/v1\na\n1.0.0\n" + loader::sha512Hex("x"));

    std::string    newer   = loader::sha512Hex("98");
    std::string    older   = loader::sha512Hex("96");
    nlohmann::json digests = {{"98", newer}, {"96", older}};
    assert(loader::addonSigningMessage("a", "1.0.0", "x", digests) ==
           "unbound-addon/v1\na\n1.0.0\n" + loader::sha512Hex("x") + "\nbytecode 96 " + older +
               "\nbytecode 98 " + newer);

    nlohmann::json withBytecode = {
        {"id", "unbound.example"}, {"version", "1.2.3"}, {"bytecode", digests}};
    withBytecode["signature"] = {{"version", 1},
                                 {"ed25519", production.sign(loader::addonSigningMessage(
                                                 "unbound.example", "1.2.3", bundle, digests))}};
    assert(loader::verifyAddonSignature(withBytecode, bundle, trust).status ==
           loader::AddonSignatureStatus::Signed);

    nlohmann::json swapped    = withBytecode;
    swapped["bytecode"]["98"] = loader::sha512Hex("tampered");
    assert(loader::verifyAddonSignature(swapped, bundle, trust).status ==
           loader::AddonSignatureStatus::Invalid);

    nlohmann::json added = manifest;
    added["bytecode"]    = digests;
    assert(loader::verifyAddonSignature(added, bundle, trust).status ==
           loader::AddonSignatureStatus::Invalid);

    for (const nlohmann::json &bad :
         {nlohmann::json("x"), nlohmann::json({{"98", "short"}}), nlohmann::json({{"v98", newer}}),
          nlohmann::json({{"98", 1}}), nlohmann::json({{"98", std::string(128, 'A')}})})
    {
        nlohmann::json malformedBytecode = withBytecode;
        malformedBytecode["bytecode"]    = bad;
        assert(!loader::isValidBytecodeDigests(bad));
        assert(loader::verifyAddonSignature(malformedBytecode, bundle, trust).status ==
               loader::AddonSignatureStatus::Invalid);
    }
    return 0;
}
