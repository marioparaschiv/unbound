#pragma once

#import <Foundation/Foundation.h>
#include <functional>
#include <memory>

#include "NativeFabric.h"

namespace facebook::jsi {
class Runtime;
class Value;
}

namespace loader::ios {
using NativeObjCResolver =
    std::function<id(facebook::jsi::Runtime &, const facebook::jsi::Value &)>;
using NativeObjCGuard           = std::function<void(std::function<void()>)>;
using NativeOperationSignposter = std::function<void(const char *, const std::function<void()> &)>;

std::shared_ptr<loader::native::FabricAdapter>
makeNativePluginFabricAdapter(NativeObjCResolver resolver, NativeObjCGuard guard,
                              NativeOperationSignposter signposter);
void setNativePluginFabricHost(id instance);
void observeNativePluginFabricMemoryWarnings();
}
