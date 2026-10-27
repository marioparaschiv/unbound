#pragma once

#include <cstddef>
#include <mutex>
#include <optional>
#include <string>
#include <string_view>

namespace loader::browserlogin {
enum class CallbackCheck
{
    NoSession,
    StateMismatch,
    Invalid,
    Valid,
};

enum class ApplyResult
{
    Applied,
    Retry,
    GaveUp,
};

struct Session {
    std::string           state;
    size_t                secretLength = 0;
    std::optional<double> ageSeconds;
};

struct Callback {
    std::string state;
    size_t      ivLength         = 0;
    size_t      ciphertextLength = 0;
    size_t      macLength        = 0;
};

struct Handoff {
    std::string state;
    std::string secret;
    std::string key;
};

enum class OpenStatus
{
    Opened,
    Unverified,
    Unreadable,
};

struct OpenedCallback {
    OpenStatus  status = OpenStatus::Unreadable;
    std::string token;
};

constexpr size_t      kStateBytes             = 24;
constexpr size_t      kSecretBytes            = 64;
constexpr size_t      kKeyBytes               = 32;
constexpr size_t      kIVBytes                = 16;
constexpr size_t      kMACBytes               = 32;
constexpr size_t      kMinimumTokenLength     = 20;
constexpr double      kSessionLifetimeSeconds = 600;
constexpr unsigned    kMaximumRetries         = 3;
constexpr double      kRetrySeconds           = 0.5;
constexpr const char *kCallbackScheme         = "com.hammerandchisel.discord";
constexpr const char *kCallbackHost           = "login";
constexpr const char *kFailedTitle            = "Could Not Finish Login";
constexpr const char *kStartFailedTitle       = "Could Not Start Login";
constexpr const char *kRetryFailedMessage =
    "Discord could not finish browser login. Please try again.";
constexpr const char *kInvalidSessionMessage =
    "The browser login session was invalid or expired. Please try again.";
constexpr const char *kUnverifiedMessage =
    "The browser login response could not be verified. Please try again.";
constexpr const char *kUnreadableMessage =
    "The browser login response could not be read. Please try again.";
constexpr const char *kInvalidTokenMessage =
    "Safari did not return a valid Discord session. Please try again.";

std::string            base64URLEncode(std::string_view bytes);
std::string            paddedBase64(std::string_view base64URL);
std::string            loginURL(const std::string &state, const std::string &key);
bool                   isCallbackURL(const std::string &scheme, const std::string &host);
bool                   isFresh(std::optional<double> ageSeconds);
CallbackCheck          checkCallback(const Session &session, const Callback &callback);
std::string            authenticatedData(const std::string &state, std::string_view iv,
                                         std::string_view ciphertext);
std::optional<Handoff> createHandoff();
OpenedCallback openCallback(std::string_view secret, const std::string &state, std::string_view iv,
                            std::string_view ciphertext, std::string_view mac);

class PendingLogin
{
public:
    bool                       submit(const std::string &token);
    std::optional<std::string> begin(bool canApply);
    ApplyResult                finish(const std::string &token, bool applied);
    unsigned                   failures() const;

private:
    std::string        token_;
    bool               applying_ = false;
    unsigned           failures_ = 0;
    mutable std::mutex mutex_;
};
}
