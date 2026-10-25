#pragma once

#import <Foundation/Foundation.h>
#import <jsi/jsi.h>

namespace loader {
void registerNativePlatform(facebook::jsi::Runtime &runtime);
}
