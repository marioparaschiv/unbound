#pragma once

#include <jsi/jsi.h>
#include <memory>

#include "NativePlatformBridge.h"

namespace loader {
// Builds `NativePlatform.android`: the in-app Discord installer, backed by
// provider->androidInstaller.
facebook::jsi::Object androidPlatformObject(facebook::jsi::Runtime                 &runtime,
                                            std::shared_ptr<NativePlatformProvider> provider);
}
