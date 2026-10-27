#include <CommonCrypto/CommonCrypto.h>
#include <cassert>
#include <random>
#include <string>

#include "LoaderCrypto.h"

#include "vectors/CryptoVectors.h"

using cryptovectors::fromHex;
using cryptovectors::load;
using cryptovectors::Vector;
using namespace loader;

static std::string commonDigest(const std::string &message)
{
    std::string digest(CC_SHA256_DIGEST_LENGTH, '\0');
    CC_SHA256(message.data(), static_cast<CC_LONG>(message.size()),
              reinterpret_cast<unsigned char *>(digest.data()));
    return digest;
}

static std::string commonMAC(const std::string &key, const std::string &message)
{
    std::string mac(CC_SHA256_DIGEST_LENGTH, '\0');
    CCHmac(kCCHmacAlgSHA256, key.data(), key.size(), message.data(), message.size(), mac.data());
    return mac;
}

static std::optional<std::string> commonCrypt(CCOperation operation, const std::string &key,
                                              const std::string &iv, const std::string &input)
{
    std::string output(input.size() + kCCBlockSizeAES128, '\0');
    size_t      written = 0;
    if (CCCrypt(operation, kCCAlgorithmAES, kCCOptionPKCS7Padding, key.data(), key.size(),
                iv.data(), input.data(), input.size(), output.data(), output.size(),
                &written) != kCCSuccess)
    {
        return std::nullopt;
    }
    output.resize(written);
    return output;
}

static void matchesCommonCryptoOnVectors()
{
    for (const Vector &vector : load("aes256cbc"))
    {
        const std::string key        = fromHex(vector.fields[0]);
        const std::string iv         = fromHex(vector.fields[1]);
        const std::string plaintext  = fromHex(vector.fields[2]);
        const std::string ciphertext = fromHex(vector.fields[3]);
        assert(commonCrypt(kCCEncrypt, key, iv, plaintext) == ciphertext);
        assert(commonCrypt(kCCDecrypt, key, iv, ciphertext) == plaintext);
    }
    for (const Vector &vector : load("hmacsha256"))
    {
        assert(crypto::hex(commonMAC(fromHex(vector.fields[0]), fromHex(vector.fields[1]))) ==
               vector.fields[2]);
    }
    for (const Vector &vector : load("sha256"))
    {
        assert(crypto::hex(commonDigest(fromHex(vector.fields[0]))) == vector.fields[1]);
    }
}

static void matchesCommonCryptoOnRandomInputs()
{
    std::mt19937_64                       generator(20261027);
    std::uniform_int_distribution<int>    byte(0, 255);
    std::uniform_int_distribution<size_t> length(0, 600);
    auto                                  draw = [&](size_t count) {
        std::string value(count, '\0');
        for (char &character : value)
        {
            character = static_cast<char>(byte(generator));
        }
        return value;
    };

    for (int round = 0; round < 3000; round++)
    {
        const std::string key        = draw(crypto::kAES256KeyBytes);
        const std::string iv         = draw(crypto::kAESBlockBytes);
        const std::string plaintext  = draw(length(generator));
        const std::string ciphertext = *crypto::aes256CBCEncrypt(key, iv, plaintext);
        assert(commonCrypt(kCCEncrypt, key, iv, plaintext) == ciphertext);
        assert(commonCrypt(kCCDecrypt, key, iv, ciphertext) == plaintext);
        assert(crypto::aes256CBCDecrypt(key, iv, ciphertext) == plaintext);

        const std::string                garbage = draw((length(generator) / 16 + 1) * 16);
        const std::optional<std::string> strict  = crypto::aes256CBCDecrypt(key, iv, garbage);
        assert(!strict || commonCrypt(kCCDecrypt, key, iv, garbage) == strict);

        const std::string macKey = draw(length(generator) % 200);
        assert(crypto::hmacSHA256(macKey, plaintext) == commonMAC(macKey, plaintext));
        assert(crypto::sha256(plaintext) == commonDigest(plaintext));
    }
}

static std::string rawEncrypt(const std::string &key, const std::string &iv,
                              const std::string &blocks)
{
    std::string output(blocks.size(), '\0');
    size_t      written = 0;
    assert(CCCrypt(kCCEncrypt, kCCAlgorithmAES, 0, key.data(), key.size(), iv.data(), blocks.data(),
                   blocks.size(), output.data(), output.size(), &written) == kCCSuccess);
    return output;
}

static void rejectsPaddingCommonCryptoLetsThrough()
{
    const std::string key(crypto::kAES256KeyBytes, 'k');
    const std::string iv(crypto::kAESBlockBytes, 'i');
    for (char last : {'\x00', '\x11', '\xff'})
    {
        const std::string ciphertext = rawEncrypt(key, iv, std::string(15, 'p') + last);
        assert(commonCrypt(kCCDecrypt, key, iv, ciphertext) == std::string(15, 'p') + last);
        assert(!crypto::aes256CBCDecrypt(key, iv, ciphertext));
    }
    const std::string mixed = rawEncrypt(key, iv, std::string(14, 'p') + "\x01\x02");
    assert(commonCrypt(kCCDecrypt, key, iv, mixed) == std::string(14, 'p'));
    assert(!crypto::aes256CBCDecrypt(key, iv, mixed));
}

int main()
{
    matchesCommonCryptoOnVectors();
    matchesCommonCryptoOnRandomInputs();
    rejectsPaddingCommonCryptoLetsThrough();
    return 0;
}
