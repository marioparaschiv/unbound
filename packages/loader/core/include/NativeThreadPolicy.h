#pragma once

#include <jsi/jsi.h>
#include <nlohmann/json.hpp>
#include <string>
#include <string_view>

namespace loader::native {
inline constexpr const char *kCurrentThreadPolicy = "current";

std::string threadPolicy(const nlohmann::json &options);
std::string threadPolicy(facebook::jsi::Runtime &runtime, const facebook::jsi::Value *options);
bool        crossesToMain(std::string_view policy);
bool        runsInPlace(std::string_view policy, bool onMainThread);
bool        postsToMain(std::string_view policy, bool returnsVoid);
}
