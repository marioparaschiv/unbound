#pragma once

#include <jsi/jsi.h>

namespace loader::ios {
void installObjCBlocks(facebook::jsi::Runtime &runtime, facebook::jsi::Object &objc);
void installObjCClassDefinition(facebook::jsi::Runtime &runtime, facebook::jsi::Object &objc);
}
