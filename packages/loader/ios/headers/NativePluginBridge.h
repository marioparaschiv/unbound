#pragma once

#import <Foundation/Foundation.h>
#import <functional>
#import <jsi/jsi.h>

#include "NativePluginVersion.h"

namespace loader {

void registerNativePluginBridge(facebook::jsi::Runtime &runtime);
void setNativePluginRuntimeExecutor(id instance);
/// Stops messaging an RCTInstance that is about to invalidate. Call before -invalidate runs.
void retireNativePluginRuntimeExecutor(id instance);
/// Queues work on the live RCTInstance's buffered runtime executor; false when none is live.
bool runOnNativePluginRuntime(std::function<void(facebook::jsi::Runtime &)> work);
void setNativePluginFabricHost(id instance);

}
