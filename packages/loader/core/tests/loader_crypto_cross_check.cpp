#include <cassert>
#include <string>

#include "LoaderBrowserLogin.h"
#include "LoaderCrypto.h"

#include "vectors/CryptoVectors.h"

using cryptovectors::fromHex;
using cryptovectors::load;
using cryptovectors::Vector;
using namespace loader;

static void matchesOpenSSLCiphertexts()
{
    for (const Vector &vector : load("aes256cbc"))
    {
        const std::string key        = fromHex(vector.fields[0]);
        const std::string iv         = fromHex(vector.fields[1]);
        const std::string plaintext  = fromHex(vector.fields[2]);
        const std::string ciphertext = fromHex(vector.fields[3]);
        assert(crypto::aes256CBCEncrypt(key, iv, plaintext) == ciphertext);
        assert(crypto::aes256CBCDecrypt(key, iv, ciphertext) == plaintext);
    }
}

static void matchesOpenSSLMACs()
{
    for (const Vector &vector : load("hmacsha256"))
    {
        const std::string mac =
            crypto::hmacSHA256(fromHex(vector.fields[0]), fromHex(vector.fields[1]));
        assert(crypto::hex(mac) == vector.fields[2]);
    }
}

static void matchesOpenSSLDigests()
{
    for (const Vector &vector : load("sha256"))
    {
        assert(crypto::hex(crypto::sha256(fromHex(vector.fields[0]))) == vector.fields[1]);
    }
}

static void opensWebCryptoCallbacks()
{
    for (const Vector &vector : load("browserlogin"))
    {
        const std::string secret     = fromHex(vector.fields[0]);
        const std::string state      = vector.fields[1];
        const std::string iv         = fromHex(vector.fields[2]);
        const std::string token      = vector.fields[3];
        const std::string ciphertext = fromHex(vector.fields[4]);
        const std::string mac        = fromHex(vector.fields[5]);

        const browserlogin::OpenedCallback opened =
            browserlogin::openCallback(secret, state, iv, ciphertext, mac);
        assert(opened.status == browserlogin::OpenStatus::Opened);
        assert(opened.token == token);

        std::string flippedMAC = mac;
        flippedMAC[5] ^= 1;
        assert(browserlogin::openCallback(secret, state, iv, ciphertext, flippedMAC).status ==
               browserlogin::OpenStatus::Unverified);
        std::string flippedCiphertext = ciphertext;
        flippedCiphertext.back() ^= 1;
        assert(browserlogin::openCallback(secret, state, iv, flippedCiphertext, mac).status ==
               browserlogin::OpenStatus::Unverified);
        assert(browserlogin::openCallback(secret, state + "x", iv, ciphertext, mac).status ==
               browserlogin::OpenStatus::Unverified);
    }
}

int main()
{
    matchesOpenSSLCiphertexts();
    matchesOpenSSLMACs();
    matchesOpenSSLDigests();
    opensWebCryptoCallbacks();
    return 0;
}
