#pragma once

#include <jsi/jsi.h>

namespace loader::native {
void attachDefaultCode(facebook::jsi::Runtime &runtime, const facebook::jsi::JSError &error);
}
