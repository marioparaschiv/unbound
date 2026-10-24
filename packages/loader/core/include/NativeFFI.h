#pragma once

#include <cstddef>

#include <jsi/jsi.h>

namespace loader::ffi
{
    facebook::jsi::Value lookupSymbol(facebook::jsi::Runtime &runtime, const facebook::jsi::Value *args,
                                      std::size_t count);
    facebook::jsi::Value callFunction(facebook::jsi::Runtime &runtime, const facebook::jsi::Value *args,
                                      std::size_t count);
}
