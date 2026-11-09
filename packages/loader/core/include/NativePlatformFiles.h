#pragma once

#include <jsi/jsi.h>
#include <string>

namespace loader {
// `NativePlatform.files`: synchronous reads, writes and removals by path relative to `documents`.
facebook::jsi::Object filesBridge(facebook::jsi::Runtime &runtime, const std::string &documents);
}
