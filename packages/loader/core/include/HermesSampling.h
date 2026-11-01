#pragma once

#include <chrono>
#include <functional>
#include <optional>
#include <string>
#include <vector>

namespace loader::native {
inline constexpr size_t kSampledStackDepth = 4;

struct JavaScriptProfiler {
    std::function<bool()>        start;
    std::function<std::string()> stop;
};

void                       setJavaScriptProfiler(JavaScriptProfiler profiler);
bool                       startJavaScriptProfiler();
std::optional<std::string> stopJavaScriptProfiler();

std::vector<std::string> hottestStack(const std::string &chromeTrace,
                                      size_t             depth = kSampledStackDepth);
std::string              describeSampledStack(const std::vector<std::string> &frames,
                                              bool                            insideNativeCall = false);
std::string              formatSampledStack(const std::vector<std::string> &frames);
std::vector<std::string> sampleJavaScriptStack(std::chrono::milliseconds duration);
}
