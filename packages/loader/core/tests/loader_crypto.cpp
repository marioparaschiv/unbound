#include <cassert>
#include <string>

#include "LoaderCrypto.h"

#include "vectors/CryptoVectors.h"

using cryptovectors::fromHex;
using namespace loader::crypto;

static void hashesFIPS180Messages()
{
    assert(hex(sha256("")) == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    assert(hex(sha256("abc")) ==
           "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    assert(hex(sha256("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")) ==
           "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
    assert(hex(sha256("abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklm"
                      "nopqklmnopqrlmnopqrsmnopqrstnopqrstu")) ==
           "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1");
    assert(hex(sha256(std::string(1000000, 'a'))) ==
           "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0");
}

static void authenticatesRFC4231Messages()
{
    assert(hex(hmacSHA256(std::string(20, '\x0b'), "Hi There")) ==
           "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7");
    assert(hex(hmacSHA256("Jefe", "what do ya want for nothing?")) ==
           "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
    assert(hex(hmacSHA256(std::string(20, '\xaa'), std::string(50, '\xdd'))) ==
           "773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe");
    assert(hex(hmacSHA256(fromHex("0102030405060708090a0b0c0d0e0f10111213141516171819"),
                          std::string(50, '\xcd'))) ==
           "82558a389a443c0ea4cc819899f2083a85f0faa3e578f8077a2e3ff46729665b");
    assert(hex(hmacSHA256(std::string(20, '\x0c'), "Test With Truncation")).substr(0, 32) ==
           "a3b6167473100ee06e0c796c2955552b");
    assert(hex(hmacSHA256(std::string(131, '\xaa'),
                          "Test Using Larger Than Block-Size Key - Hash Key First")) ==
           "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54");
    assert(hex(hmacSHA256(std::string(131, '\xaa'),
                          "This is a test using a larger than block-size key and a larger than "
                          "block-size data. The key needs to be hashed before being used by the "
                          "HMAC algorithm.")) ==
           "9b09ffa71b942fcb27635fbcd5b0e944bfdc63644f0713938a7f51535c3a35e2");
}

static void encryptsFIPS197Block()
{
    const std::string key =
        fromHex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
    const std::string ciphertext =
        *aes256CBCEncrypt(key, std::string(16, '\0'), fromHex("00112233445566778899aabbccddeeff"));
    assert(ciphertext.size() == 32);
    assert(hex(ciphertext.substr(0, 16)) == "8ea2b7ca516745bfeafc49904b496089");
}

static void encryptsSP80038AChain()
{
    const std::string key =
        fromHex("603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4");
    const std::string iv = fromHex("000102030405060708090a0b0c0d0e0f");
    const std::string plaintext =
        fromHex("6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e51"
                "30c81c46a35ce411e5fbc1191a0a52eff69f2445df4f9b17ad2b417be66c3710");
    const std::string expected = "f58c4c04d6e5f1ba779eabfb5f7bfbd69cfc4e967edb808d679f777bc6702c7d"
                                 "39f23369a9d9bacfa530e26304231461b2eb05e2c39be9fcda6c19078c6a9d1b";

    const std::string ciphertext = *aes256CBCEncrypt(key, iv, plaintext);
    assert(ciphertext.size() == plaintext.size() + kAESBlockBytes);
    assert(hex(ciphertext.substr(0, plaintext.size())) == expected);
    assert(aes256CBCDecrypt(key, iv, ciphertext) == plaintext);
}

static void padsWithPKCS7()
{
    const std::string key(32, 'k');
    const std::string iv(16, 'i');
    for (size_t length = 0; length <= 48; length++)
    {
        const std::string plaintext(length, 'p');
        const std::string ciphertext = *aes256CBCEncrypt(key, iv, plaintext);
        assert(ciphertext.size() == (length / kAESBlockBytes + 1) * kAESBlockBytes);
        assert(aes256CBCDecrypt(key, iv, ciphertext) == plaintext);
    }
}

static void rejectsMalformedCiphertext()
{
    const std::string key(32, 'k');
    const std::string iv(16, 'i');
    const std::string ciphertext = *aes256CBCEncrypt(key, iv, "token");

    assert(!aes256CBCEncrypt(std::string(16, 'k'), iv, "token"));
    assert(!aes256CBCEncrypt(key, std::string(8, 'i'), "token"));
    assert(!aes256CBCDecrypt(std::string(31, 'k'), iv, ciphertext));
    assert(!aes256CBCDecrypt(key, std::string(17, 'i'), ciphertext));
    assert(!aes256CBCDecrypt(key, iv, ""));
    assert(!aes256CBCDecrypt(key, iv, ciphertext.substr(0, 15)));
    assert(!aes256CBCDecrypt(key, iv, ciphertext + "x"));

    const std::string zeroPadded = aes256CBCEncrypt(key, iv, std::string(16, '\0'))->substr(0, 16);
    assert(!aes256CBCDecrypt(key, iv, zeroPadded));

    std::string wrongPadding = std::string(15, 'p') + '\x02';
    assert(!aes256CBCDecrypt(key, iv, aes256CBCEncrypt(key, iv, wrongPadding)->substr(0, 16)));
    std::string oversizedPadding = std::string(15, 'p') + '\x11';
    assert(!aes256CBCDecrypt(key, iv, aes256CBCEncrypt(key, iv, oversizedPadding)->substr(0, 16)));
}

static void comparesInConstantTime()
{
    assert(constantTimeEqual("", ""));
    assert(constantTimeEqual("secret", "secret"));
    assert(!constantTimeEqual("secret", "secreT"));
    assert(!constantTimeEqual("secret", "Secret"));
    assert(!constantTimeEqual("secret", "secrets"));
    assert(!constantTimeEqual(std::string("\0", 1), ""));
}

static void drawsRandomBytes()
{
    assert(randomBytes(0) == std::string());
    const std::string first  = *randomBytes(64);
    const std::string second = *randomBytes(64);
    assert(first.size() == 64 && second.size() == 64);
    assert(first != second);
    assert(first != std::string(64, '\0'));
    assert(randomBytes(4096)->size() == 4096);
}

static void verifiesRFC8032Signatures()
{
    const std::string firstKey =
        fromHex("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a");
    const std::string firstSignature =
        fromHex("e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bac"
                "c61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b");
    assert(verifyEd25519("", firstSignature, firstKey));
    assert(!verifyEd25519("x", firstSignature, firstKey));

    const std::string thirdKey =
        fromHex("fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025");
    const std::string thirdSignature =
        fromHex("6291d657deec24024827e69c3abe01a30ce548a284743a445e3680d7db5ac3ac18ff9b538d16f290"
                "ae67f760984dc6594a7c15e9716ed28dc027beceea1ec40a");
    assert(verifyEd25519(fromHex("af82"), thirdSignature, thirdKey));
    assert(!verifyEd25519(fromHex("af82"), thirdSignature, firstKey));

    std::string tampered = thirdSignature;
    tampered[0] ^= 1;
    assert(!verifyEd25519(fromHex("af82"), tampered, thirdKey));
    assert(!verifyEd25519(fromHex("af82"), thirdSignature.substr(0, 63), thirdKey));
    assert(!verifyEd25519(fromHex("af82"), thirdSignature, thirdKey.substr(0, 31)));
}

static void encodesHex()
{
    assert(hex("") == "");
    assert(hex(std::string("\x00\x0f\xf0\xff", 4)) == "000ff0ff");
}

int main()
{
    hashesFIPS180Messages();
    authenticatesRFC4231Messages();
    encryptsFIPS197Block();
    encryptsSP80038AChain();
    padsWithPKCS7();
    rejectsMalformedCiphertext();
    comparesInConstantTime();
    drawsRandomBytes();
    verifiesRFC8032Signatures();
    encodesHex();
    return 0;
}
