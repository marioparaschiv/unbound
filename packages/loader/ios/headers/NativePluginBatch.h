#pragma once

#include <jsi/jsi.h>

namespace loader::ios {
facebook::jsi::Value invokeBatch(facebook::jsi::Runtime &runtime, const facebook::jsi::Value *args,
                                 size_t count);
}
