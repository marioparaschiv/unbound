#pragma once

#include <jsi/jsi.h>

namespace loader {
// Adds `log(level, scope, message)` and `logs.subscribe(callback) -> unsubscribe` to the
// `UnboundNative` bridge. Subscribers receive batches of entries on the runtime thread, shaped as
// the JSON lines on disk; with none subscribed nothing is buffered.
void installLogBridge(facebook::jsi::Runtime &runtime, facebook::jsi::Object &bridge);
}
