#include "LoaderBrowserLogin.h"

#include <algorithm>
#include <cctype>

namespace loader::browserlogin {
static constexpr std::string_view kBase64Alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static std::string standardBase64(std::string_view bytes)
{
    std::string encoded;
    for (size_t index = 0; index < bytes.size(); index += 3)
    {
        const size_t remaining = std::min<size_t>(3, bytes.size() - index);
        uint32_t     chunk     = 0;
        for (size_t offset = 0; offset < 3; offset++)
        {
            chunk <<= 8;
            if (offset < remaining)
            {
                chunk |= static_cast<uint8_t>(bytes[index + offset]);
            }
        }
        for (size_t offset = 0; offset < 4; offset++)
        {
            encoded +=
                offset <= remaining ? kBase64Alphabet[(chunk >> (18 - 6 * offset)) & 0x3F] : '=';
        }
    }
    return encoded;
}

std::string base64URLEncode(std::string_view bytes)
{
    std::string encoded = standardBase64(bytes);
    std::replace(encoded.begin(), encoded.end(), '+', '-');
    std::replace(encoded.begin(), encoded.end(), '/', '_');
    encoded.erase(std::remove(encoded.begin(), encoded.end(), '='), encoded.end());
    return encoded;
}

std::string paddedBase64(std::string_view base64URL)
{
    std::string base64(base64URL);
    std::replace(base64.begin(), base64.end(), '-', '+');
    std::replace(base64.begin(), base64.end(), '_', '/');
    base64.append((4 - base64.size() % 4) % 4, '=');
    return base64;
}

bool constantTimeEqual(std::string_view left, std::string_view right)
{
    if (left.size() != right.size())
    {
        return false;
    }
    uint8_t difference = 0;
    for (size_t index = 0; index < left.size(); index++)
    {
        difference |= static_cast<uint8_t>(left[index]) ^ static_cast<uint8_t>(right[index]);
    }
    return difference == 0;
}

std::string loginURL(const std::string &state, const std::string &key)
{
    return "https://discord.com/login#login-state=" + state + "&login-secret=" + key;
}

static std::string lowercase(std::string value)
{
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char character) {
        return static_cast<char>(std::tolower(character));
    });
    return value;
}

bool isCallbackURL(const std::string &scheme, const std::string &host)
{
    return lowercase(scheme) == kCallbackScheme && lowercase(host) == kCallbackHost;
}

bool isFresh(std::optional<double> ageSeconds)
{
    return ageSeconds && *ageSeconds >= 0 && *ageSeconds <= kSessionLifetimeSeconds;
}

CallbackCheck checkCallback(const Session &session, const Callback &callback)
{
    if (session.state.empty() || session.secretLength == 0 || !session.ageSeconds)
    {
        return CallbackCheck::NoSession;
    }
    if (session.state != callback.state)
    {
        return CallbackCheck::StateMismatch;
    }
    const bool validSession = session.secretLength == kSecretBytes && isFresh(session.ageSeconds);
    if (!validSession || callback.ivLength != kIVBytes || callback.ciphertextLength == 0 ||
        callback.macLength != kMACBytes)
    {
        return CallbackCheck::Invalid;
    }
    return CallbackCheck::Valid;
}

std::string authenticatedData(const std::string &state, std::string_view iv,
                              std::string_view ciphertext)
{
    std::string data = state;
    data.append(iv);
    data.append(ciphertext);
    return data;
}

bool PendingLogin::submit(const std::string &token)
{
    if (token.empty())
    {
        return false;
    }
    std::lock_guard<std::mutex> lock(mutex_);
    token_    = token;
    failures_ = 0;
    return true;
}

std::optional<std::string> PendingLogin::begin(bool canApply)
{
    std::lock_guard<std::mutex> lock(mutex_);
    if (!canApply || token_.empty() || applying_)
    {
        return std::nullopt;
    }
    applying_ = true;
    return token_;
}

ApplyResult PendingLogin::finish(const std::string &token, bool applied)
{
    std::lock_guard<std::mutex> lock(mutex_);
    applying_ = false;
    if (applied)
    {
        if (token_ == token)
        {
            token_.clear();
        }
        failures_ = 0;
        return ApplyResult::Applied;
    }
    failures_++;
    return failures_ <= kMaximumRetries ? ApplyResult::Retry : ApplyResult::GaveUp;
}

unsigned PendingLogin::failures() const
{
    std::lock_guard<std::mutex> lock(mutex_);
    return failures_;
}
}
