#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <string_view>

namespace loader::native {
inline constexpr const char *kIOSHookPlatform     = "ios";
inline constexpr const char *kAndroidHookPlatform = "android";

uint64_t                   nextHookIdentifier();
std::string                hookCallbackKey(std::string_view platform, std::string_view id);
std::string                receiverCoalesceKey(std::string_view platform, std::string_view id,
                                               std::string_view receiver);
std::optional<std::string> coalescedHookKey(std::string_view platform, std::string_view token,
                                            const std::string &payload);
}
