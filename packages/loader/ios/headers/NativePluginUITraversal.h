#pragma once

#include <jsi/jsi.h>

namespace loader::ios {
facebook::jsi::Value snapshotUI(facebook::jsi::Runtime &runtime, const facebook::jsi::Value *args,
                                size_t count);
facebook::jsi::Value findUIViews(facebook::jsi::Runtime &runtime, const facebook::jsi::Value *args,
                                 size_t count);
}
