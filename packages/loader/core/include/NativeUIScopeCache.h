#pragma once

#include <cstdint>
#include <functional>
#include <jsi/jsi.h>
#include <string>

namespace loader::native {
uint64_t nextUIScopeCacheId();

facebook::jsi::Value cachedUIScopeNamespace(facebook::jsi::Runtime &runtime, const std::string &key,
                                            const std::function<facebook::jsi::Object()> &create,
                                            std::function<bool()>                         active);
}
