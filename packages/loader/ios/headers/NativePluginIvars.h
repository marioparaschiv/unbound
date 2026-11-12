#pragma once

#include <jsi/jsi.h>

namespace loader::ios {
facebook::jsi::Value getIvar(facebook::jsi::Runtime &runtime, const facebook::jsi::Value *args,
                             size_t count);
facebook::jsi::Value setIvar(facebook::jsi::Runtime &runtime, const facebook::jsi::Value *args,
                             size_t count);
}
