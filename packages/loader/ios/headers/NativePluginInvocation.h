#pragma once

#import <Foundation/Foundation.h>
#include <jsi/jsi.h>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#import "NativeArgumentValidation.h"
#import "NativeFFI.h"

namespace loader::ios {
class ObjCCallPlanHost;

typedef NS_ENUM(NSInteger, NativeMethodFamily) {
    NativeMethodFamilyNone,
    NativeMethodFamilyOwned,
    NativeMethodFamilyInit,
};

NativeMethodFamily nativeMethodFamily(SEL selector);
bool               returnsRetainableObject(const char *encoding);
void retainConsumedReceiver(NativeMethodFamily family, bool returnsObject, id receiver);
void autoreleaseOwnedResult(NativeMethodFamily family, bool returnsObject, const void *result);
void invokeFollowingOwnership(NSInvocation *invocation);

std::optional<loader::native::NativeNumberArgument> nativeNumberArgument(id value);
void validateNativeScalarArgument(id value, const std::string &type);

NSInvocation *
prepareInvocationWithSignature(id target, SEL selector, NSArray *arguments,
                               NSMethodSignature                    *signature,
                               const std::vector<loader::ffi::Type> *preparedTypes = nullptr);
NSInvocation *prepareInvocation(id target, SEL selector, NSArray *arguments);

facebook::jsi::Value returnValue(facebook::jsi::Runtime &runtime, NSInvocation *invocation,
                                 NSMethodSignature       *signature,
                                 const loader::ffi::Type *preparedType = nullptr);
facebook::jsi::Value invokeObject(facebook::jsi::Runtime &runtime, id target, SEL selector,
                                  NSArray *arguments);
facebook::jsi::Value
invokeInvocationWithThreadPolicy(facebook::jsi::Runtime &runtime, NSInvocation *invocation,
                                 const facebook::jsi::Value *options,
                                 const loader::ffi::Type    *preparedResult = nullptr);
facebook::jsi::Value invokeWithThreadPolicy(facebook::jsi::Runtime &runtime, id target,
                                            SEL selector, NSArray *arguments,
                                            const facebook::jsi::Value *options);
facebook::jsi::Value
invokeInvocationAsync(facebook::jsi::Runtime &runtime, NSInvocation *invocation,
                      std::shared_ptr<ObjCCallPlanHost> preparedPlan = nullptr);
facebook::jsi::Value invokeAsync(facebook::jsi::Runtime &runtime, id target, SEL selector,
                                 NSArray *arguments);
facebook::jsi::Value objcFunction(facebook::jsi::Runtime     &runtime,
                                  const facebook::jsi::Value &target,
                                  const facebook::jsi::Value &selectorValue,
                                  const facebook::jsi::Value *args, size_t count, size_t start);
}
