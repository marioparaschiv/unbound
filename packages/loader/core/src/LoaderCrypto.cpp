#include "LoaderCrypto.h"

#include <bearssl_block.h>
#include <bearssl_hash.h>
#include <bearssl_hmac.h>
#include <cstdint>
#include <cstdlib>
#include <monocypher/monocypher-ed25519.h>
#include <monocypher/monocypher.h>

#if !defined(__APPLE__) && !defined(__ANDROID__)
#include <cerrno>
#include <sys/random.h>
#endif

namespace loader::crypto {
static const unsigned char *bytes(std::string_view value)
{
    return reinterpret_cast<const unsigned char *>(value.data());
}

static unsigned char *mutableBytes(std::string &value)
{
    return reinterpret_cast<unsigned char *>(value.data());
}

std::string sha256(std::string_view data)
{
    br_sha256_context context;
    br_sha256_init(&context);
    br_sha256_update(&context, data.data(), data.size());
    std::string digest(kSHA256Bytes, '\0');
    br_sha256_out(&context, mutableBytes(digest));
    return digest;
}

std::string hmacSHA256(std::string_view key, std::string_view message)
{
    br_hmac_key_context keyContext;
    br_hmac_key_init(&keyContext, &br_sha256_vtable, key.data(), key.size());
    br_hmac_context context;
    br_hmac_init(&context, &keyContext, 0);
    br_hmac_update(&context, message.data(), message.size());
    std::string mac(kSHA256Bytes, '\0');
    br_hmac_out(&context, mutableBytes(mac));
    return mac;
}

static bool hasCipherParameters(std::string_view key, std::string_view iv)
{
    return key.size() == kAES256KeyBytes && iv.size() == kAESBlockBytes;
}

std::optional<std::string> aes256CBCEncrypt(std::string_view key, std::string_view iv,
                                            std::string_view plaintext)
{
    if (!hasCipherParameters(key, iv))
    {
        return std::nullopt;
    }
    const size_t padding = kAESBlockBytes - plaintext.size() % kAESBlockBytes;
    std::string  buffer(plaintext);
    buffer.append(padding, static_cast<char>(padding));

    br_aes_ct64_cbcenc_keys keys;
    br_aes_ct64_cbcenc_init(&keys, key.data(), key.size());
    std::string chain(iv);
    br_aes_ct64_cbcenc_run(&keys, chain.data(), buffer.data(), buffer.size());
    return buffer;
}

static std::optional<size_t> paddingLength(std::string_view decrypted)
{
    const auto padding = static_cast<unsigned char>(decrypted.back());
    if (padding == 0 || padding > kAESBlockBytes)
    {
        return std::nullopt;
    }
    unsigned char difference = 0;
    for (size_t index = decrypted.size() - padding; index < decrypted.size(); index++)
    {
        difference |= static_cast<unsigned char>(decrypted[index]) ^ padding;
    }
    if (difference != 0)
    {
        return std::nullopt;
    }
    return padding;
}

std::optional<std::string> aes256CBCDecrypt(std::string_view key, std::string_view iv,
                                            std::string_view ciphertext)
{
    if (!hasCipherParameters(key, iv) || ciphertext.empty() ||
        ciphertext.size() % kAESBlockBytes != 0)
    {
        return std::nullopt;
    }
    br_aes_ct64_cbcdec_keys keys;
    br_aes_ct64_cbcdec_init(&keys, key.data(), key.size());
    std::string chain(iv);
    std::string buffer(ciphertext);
    br_aes_ct64_cbcdec_run(&keys, chain.data(), buffer.data(), buffer.size());

    std::optional<size_t> padding = paddingLength(buffer);
    if (!padding)
    {
        return std::nullopt;
    }
    buffer.resize(buffer.size() - *padding);
    return buffer;
}

bool constantTimeEqual(std::string_view left, std::string_view right)
{
    if (left.size() != right.size())
    {
        return false;
    }
    unsigned char difference = 0;
    for (size_t index = 0; index < left.size(); index++)
    {
        difference |= static_cast<unsigned char>(left[index] ^ right[index]);
    }
    return difference == 0;
}

static bool fillFromPlatform(unsigned char *buffer, size_t count)
{
#if defined(__APPLE__) || defined(__ANDROID__)
    arc4random_buf(buffer, count);
    return true;
#else
    while (count > 0)
    {
        ssize_t written = getrandom(buffer, count, 0);
        if (written < 0)
        {
            if (errno == EINTR)
            {
                continue;
            }
            return false;
        }
        buffer += written;
        count -= static_cast<size_t>(written);
    }
    return true;
#endif
}

std::optional<std::string> randomBytes(size_t count)
{
    std::string buffer(count, '\0');
    if (!fillFromPlatform(mutableBytes(buffer), count))
    {
        crypto_wipe(buffer.data(), buffer.size());
        return std::nullopt;
    }
    return buffer;
}

bool verifyEd25519(std::string_view message, std::string_view signature, std::string_view publicKey)
{
    if (signature.size() != kEd25519SignatureBytes || publicKey.size() != kEd25519PublicKeyBytes)
    {
        return false;
    }
    return crypto_ed25519_check(bytes(signature), bytes(publicKey), bytes(message),
                                message.size()) == 0;
}

std::string hex(std::string_view value)
{
    static constexpr char kDigits[] = "0123456789abcdef";
    std::string           encoded;
    encoded.reserve(value.size() * 2);
    for (unsigned char byte : value)
    {
        encoded.push_back(kDigits[byte >> 4]);
        encoded.push_back(kDigits[byte & 0x0f]);
    }
    return encoded;
}
}
