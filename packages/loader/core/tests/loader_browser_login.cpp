#include <cassert>
#include <string>

#include "LoaderBrowserLogin.h"

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
    assert(constantTimeEqual("", ""));
    assert(constantTimeEqual("secret", "secret"));
    assert(!constantTimeEqual("secret", "secreT"));
    assert(!constantTimeEqual("secret", "secrets"));

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

int main()
{
    checkBase64URL();
    checkCallbacks();
    checkPendingLogin();
    return 0;
}
