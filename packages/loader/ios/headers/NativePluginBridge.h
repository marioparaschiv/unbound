#pragma once

#import <Foundation/Foundation.h>
#import <jsi/jsi.h>

#include "NativePluginVersion.h"

namespace loader {

void registerNativePluginBridge(facebook::jsi::Runtime &runtime);
void setNativePluginRuntimeExecutor(id instance);
void setNativePluginFabricHost(id instance);

}
