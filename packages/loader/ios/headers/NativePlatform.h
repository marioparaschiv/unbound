#pragma once

#import <Foundation/Foundation.h>
#import <jsi/jsi.h>

namespace loader {
void registerNativePlatformProvider(void);
void registerNativePlatform(facebook::jsi::Runtime &runtime);
}
