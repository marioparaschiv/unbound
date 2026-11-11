#pragma once

#import <Foundation/Foundation.h>
#include <memory>

#include "NativePlatformBridge.h"

namespace loader {
// iOS's device facts; the loader fills in its documents, settings and fonts.
std::shared_ptr<NativePlatformProvider> makeNativePlatformProvider(void);
}
