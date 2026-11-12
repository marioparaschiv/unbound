#pragma once

#include <jsi/jsi.h>

namespace loader::ios {
// Installs the debugger's `objc.inspect*` methods over UnboundInspector.dylib, which loads on the
// first call that passes the developer-mode/debugger gate and never at launch.
void installInspector(facebook::jsi::Runtime &runtime, facebook::jsi::Object &objc);
}
