#pragma once

#include <chrono>
#include <functional>
#include <string>
#include <vector>

namespace loader::native {
inline constexpr size_t kSampledStackDepth = 4;

using JavaScriptSampler = std::function<std::string(std::chrono::milliseconds)>;

void setJavaScriptSampler(JavaScriptSampler sampler);

std::vector<std::string> hottestStack(const std::string &chromeTrace,
                                      size_t             depth = kSampledStackDepth);
std::string              describeSampledStack(const std::vector<std::string> &frames,
                                              bool                            insideNativeCall = false);
std::vector<std::string> sampleJavaScriptStack(std::chrono::milliseconds duration);
}
