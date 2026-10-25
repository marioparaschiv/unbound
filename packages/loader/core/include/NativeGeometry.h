#pragma once

#include <jsi/jsi.h>
#include <nlohmann/json.hpp>

namespace loader::native {
inline constexpr double kMaximumNativeDimension  = 32768;
inline constexpr double kMaximumNativeCoordinate = 100000;

struct NativeSize {
    double width  = 0;
    double height = 0;
};

struct NativeFrame {
    double x      = 0;
    double y      = 0;
    double width  = 0;
    double height = 0;
};

NativeSize  parseSize(const nlohmann::json &value);
NativeFrame parseFrame(const nlohmann::json &value);
NativeSize  parseSize(facebook::jsi::Runtime &runtime, const facebook::jsi::Value &value);
NativeFrame parseFrame(facebook::jsi::Runtime &runtime, const facebook::jsi::Value &value);

nlohmann::json toJSON(const NativeSize &size);
nlohmann::json toJSON(const NativeFrame &frame);
}
