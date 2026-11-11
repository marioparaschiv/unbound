#pragma once

#include <jsi/jsi.h>
#include <nlohmann/json.hpp>

// JSON to JSI and back, for values the loader hands to and reads from JavaScript. Functions read as
// null, and a value nested deeper than 128 levels or referring to itself throws.
namespace loader {
facebook::jsi::Value toJSIValue(facebook::jsi::Runtime &runtime, const nlohmann::json &value);
nlohmann::json fromJSIValue(facebook::jsi::Runtime &runtime, const facebook::jsi::Value &value);
}
