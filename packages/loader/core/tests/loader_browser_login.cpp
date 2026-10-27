#include <cassert>
#include <string>

#include "LoaderBrowserLogin.h"
#include "LoaderBundleSignature.h"
#include "LoaderCrypto.h"

using namespace loader::browserlogin;

static void checkBase64URL()
{
    assert(base64URLEncode("") == "");
    assert(base64URLEncode("f") == "Zg");
    assert(base64URLEncode("fo") == "Zm8");
    assert(base64URLEncode("foo") == "Zm9v");
    assert(base64URLEncode("foob") == "Zm9vYg");
    assert(base64URLEncode(std::string("\xfb\xff\xbf", 3)) == "-_-_");
    assert(base64URLEncode(std::string("\0\0", 2)) == "AAA");

    assert(paddedBase64("") == "");
    assert(paddedBase64("Zg") == "Zg==");
    assert(paddedBase64("Zm8") == "Zm8=");
    assert(paddedBase64("Zm9v") == "Zm9v");
    assert(paddedBase64("Z") == "Z===");
    assert(paddedBase64("-_-_") == "+/+/");
    assert(paddedBase64("a-b_c") == "a+b/c===");
    assert(paddedBase64(base64URLEncode("foob")) == "Zm9vYg==");
}

static void checkCallbacks()
{
    assert(loginURL("abc", "def") == "https://discord.com/login#login-state=abc&login-secret=def");
    assert(isCallbackURL("com.hammerandchisel.discord", "login"));
    assert(isCallbackURL("COM.HammerAndChisel.Discord", "LOGIN"));
    assert(!isCallbackURL("discord", "login"));
    assert(!isCallbackURL("com.hammerandchisel.discord", "invite"));

    assert(!isFresh(std::nullopt));
    assert(!isFresh(-0.1));
    assert(isFresh(0));
    assert(isFresh(600));
    assert(!isFresh(600.5));

    const Session  session{"state", kSecretBytes, 12};
    const Callback callback{"state", kIVBytes, 48, kMACBytes};
    assert(checkCallback(session, callback) == CallbackCheck::Valid);
    assert(checkCallback({"", kSecretBytes, 12}, callback) == CallbackCheck::NoSession);
    assert(checkCallback({"state", 0, 12}, callback) == CallbackCheck::NoSession);
    assert(checkCallback({"state", kSecretBytes, std::nullopt}, callback) ==
           CallbackCheck::NoSession);
    assert(checkCallback(session, {"other", kIVBytes, 48, kMACBytes}) ==
           CallbackCheck::StateMismatch);
    assert(checkCallback(session, {"", kIVBytes, 48, kMACBytes}) == CallbackCheck::StateMismatch);
    assert(checkCallback({"state", 32, 12}, callback) == CallbackCheck::Invalid);
    assert(checkCallback({"state", kSecretBytes, 601}, callback) == CallbackCheck::Invalid);
    assert(checkCallback({"state", kSecretBytes, -5}, callback) == CallbackCheck::Invalid);
    assert(checkCallback(session, {"state", 8, 48, kMACBytes}) == CallbackCheck::Invalid);
    assert(checkCallback(session, {"state", kIVBytes, 0, kMACBytes}) == CallbackCheck::Invalid);
    assert(checkCallback(session, {"state", kIVBytes, 48, 20}) == CallbackCheck::Invalid);

    assert(authenticatedData("st", std::string("\0\1", 2), "ct") == std::string("st\0\1ct", 6));
}

static void checkPendingLogin()
{
    PendingLogin pending;
    assert(!pending.begin(true));
    assert(!pending.submit(""));
    assert(pending.submit("token-1"));
    assert(!pending.begin(false));

    auto token = pending.begin(true);
    assert(token == "token-1");
    assert(!pending.begin(true));
    assert(pending.finish(*token, false) == ApplyResult::Retry);
    assert(pending.failures() == 1);

    for (unsigned attempt = 2; attempt <= kMaximumRetries; attempt++)
    {
        token = pending.begin(true);
        assert(token == "token-1");
        assert(pending.finish(*token, false) == ApplyResult::Retry);
    }
    token = pending.begin(true);
    assert(pending.finish(*token, false) == ApplyResult::GaveUp);
    assert(pending.failures() == kMaximumRetries + 1);

    assert(pending.submit("token-2"));
    assert(pending.failures() == 0);
    token = pending.begin(true);
    assert(token == "token-2");
    assert(pending.finish(*token, true) == ApplyResult::Applied);
    assert(!pending.begin(true));

    assert(pending.submit("token-3"));
    token = pending.begin(true);
    assert(pending.submit("token-4"));
    assert(pending.finish(*token, true) == ApplyResult::Applied);
    assert(pending.begin(true) == "token-4");
}

struct Sealed {
    std::string iv;
    std::string ciphertext;
    std::string mac;
};

static Sealed sealLikeTheExtension(const Handoff &handoff, const std::string &token)
{
    const std::string secret = *loader::decodeBase64(paddedBase64(handoff.key));
    Sealed            sealed;
    sealed.iv = *loader::crypto::randomBytes(kIVBytes);
    sealed.ciphertext =
        *loader::crypto::aes256CBCEncrypt(secret.substr(0, kKeyBytes), sealed.iv, token);
    sealed.mac = loader::crypto::hmacSHA256(
        secret.substr(kKeyBytes), authenticatedData(handoff.state, sealed.iv, sealed.ciphertext));
    return sealed;
}

static void createsHandoffs()
{
    const Handoff first  = *createHandoff();
    const Handoff second = *createHandoff();
    assert(first.secret.size() == kSecretBytes);
    assert(first.state.size() == 32);
    assert(first.key == base64URLEncode(first.secret));
    assert(first.state.find_first_of("+/=") == std::string::npos);
    assert(first.key.find_first_of("+/=") == std::string::npos);
    assert(first.state != second.state);
    assert(first.secret != second.secret);
    assert(loginURL(first.state, first.key).find(first.key) != std::string::npos);
}

static void roundTripsTokens()
{
    for (size_t length : {size_t{1}, kMinimumTokenLength, size_t{70}, size_t{200}})
    {
        const Handoff     handoff = *createHandoff();
        const std::string token(length, 't');
        const Sealed      sealed = sealLikeTheExtension(handoff, token);

        const Callback callback{handoff.state, sealed.iv.size(), sealed.ciphertext.size(),
                                sealed.mac.size()};
        assert(checkCallback({handoff.state, handoff.secret.size(), 1}, callback) ==
               CallbackCheck::Valid);

        const OpenedCallback opened =
            openCallback(handoff.secret, handoff.state, sealed.iv, sealed.ciphertext, sealed.mac);
        assert(opened.status == OpenStatus::Opened);
        assert(opened.token == token);
    }
}

static void rejectsTamperedCallbacks()
{
    const Handoff     handoff = *createHandoff();
    const Sealed      sealed  = sealLikeTheExtension(handoff, "a-token-that-is-long-enough");
    const std::string other   = createHandoff()->secret;

    assert(openCallback(other, handoff.state, sealed.iv, sealed.ciphertext, sealed.mac).status ==
           OpenStatus::Unverified);
    assert(openCallback(handoff.secret.substr(1), handoff.state, sealed.iv, sealed.ciphertext,
                        sealed.mac)
               .status == OpenStatus::Unverified);
    assert(openCallback(handoff.secret, "other", sealed.iv, sealed.ciphertext, sealed.mac).status ==
           OpenStatus::Unverified);
    std::string iv = sealed.iv;
    iv[0] ^= 1;
    assert(openCallback(handoff.secret, handoff.state, iv, sealed.ciphertext, sealed.mac).status ==
           OpenStatus::Unverified);
    assert(openCallback(handoff.secret, handoff.state, sealed.iv, sealed.ciphertext, "").status ==
           OpenStatus::Unverified);

    const std::string encryptionKey = handoff.secret.substr(0, kKeyBytes);
    const std::string unpadded =
        loader::crypto::aes256CBCEncrypt(encryptionKey, sealed.iv, std::string(16, '\0'))
            ->substr(0, 16);
    const std::string mac = loader::crypto::hmacSHA256(
        handoff.secret.substr(kKeyBytes), authenticatedData(handoff.state, sealed.iv, unpadded));
    assert(openCallback(handoff.secret, handoff.state, sealed.iv, unpadded, mac).status ==
           OpenStatus::Unreadable);
}

int main()
{
    checkBase64URL();
    checkCallbacks();
    checkPendingLogin();
    createsHandoffs();
    roundTripsTokens();
    rejectsTamperedCallbacks();
    return 0;
}
