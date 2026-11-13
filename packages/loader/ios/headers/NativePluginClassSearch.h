#pragma once

#include <jsi/jsi.h>

namespace loader::ios {
void installObjCClassSearch(facebook::jsi::Runtime &runtime, facebook::jsi::Object &objc);
}
