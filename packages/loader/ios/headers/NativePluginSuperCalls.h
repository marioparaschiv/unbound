#pragma once

#import <Foundation/Foundation.h>
#include <jsi/jsi.h>

namespace loader::ios {
facebook::jsi::Value invokeSuperObject(facebook::jsi::Runtime &runtime, id target,
                                       Class currentClass, SEL selector, NSArray *arguments);
facebook::jsi::Value invokeSuperAsync(facebook::jsi::Runtime &runtime, id target,
                                      Class currentClass, SEL selector, NSArray *arguments);
facebook::jsi::Value invokeSuperWithThreadPolicy(facebook::jsi::Runtime &runtime, id target,
                                                 Class currentClass, SEL selector,
                                                 NSArray                    *arguments,
                                                 const facebook::jsi::Value *options);
}
