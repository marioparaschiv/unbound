#import "NativePluginSuperCalls.h"

#include <memory>
#import <objc/message.h>
#import <objc/runtime.h>
#include <string>
#include <vector>

#import "NativeFFI.h"
#import "NativeNumericValidation.h"
#import "NativePluginInvocation.h"
#import "NativePluginObjCValues.h"
#import "NativePluginThreading.h"
#import "NativeThreadPolicy.h"
#import "NativeTypeEncoding.h"

using namespace facebook;
using namespace facebook::jsi;

namespace loader::ios {
static void setSuperFFIArgument(Runtime &runtime, const char *encoding, id object, uint8_t *target,
                                size_t capacity, loader::ffi::ArgumentStorage &storage,
                                std::vector<id> &retained)
{
    std::string scalarType = nativeFFITypeName(encoding);
    if (isNativeScalarType(scalarType))
    {
        validateNativeScalarArgument(object, scalarType);
    }
    char code  = normalizedType(encoding);
    id   value = object == [NSNull null] ? @0 : object;
    if (code == '@' || code == '#')
    {
        id retainedValue = object == [NSNull null] ? nil : object;
        retained.push_back(retainedValue);
        storeNativeValue<void *>(target, (__bridge void *) retainedValue);
        return;
    }
    if (code == ':')
    {
        SEL selector = NULL;
        if ([value isKindOfClass:[NSString class]])
        {
            selector = sel_registerName([(NSString *) value UTF8String]);
        }
        else if ([value isKindOfClass:[NSValue class]])
        {
            selector = (SEL)[(NSValue *) value pointerValue];
        }
        storeNativeValue<SEL>(target, selector);
        return;
    }
    if (code == '^' || code == '*')
    {
        const void *pointer = nullptr;
        if (code == '*' && [value isKindOfClass:[NSString class]])
        {
            pointer = storage.keep([(NSString *) value UTF8String] ?: "");
        }
        else if ([value isKindOfClass:[NSValue class]])
        {
            pointer = [(NSValue *) value pointerValue];
        }
        storeNativeValue<const void *>(target, pointer);
        return;
    }
    if (code == 'B')
    {
        storeNativeValue<bool>(target, [value boolValue]);
        return;
    }
    if (code == 'c' || code == 'C')
    {
        storeNativeValue<uint8_t>(target, code == 'c' ? (uint8_t) [value charValue]
                                                      : [value unsignedCharValue]);
        return;
    }
    if (code == 's' || code == 'S')
    {
        storeNativeValue<uint16_t>(target, code == 's' ? (uint16_t) [value shortValue]
                                                       : [value unsignedShortValue]);
        return;
    }
    if (code == 'i' || code == 'I')
    {
        storeNativeValue<uint32_t>(target, code == 'i' ? (uint32_t) [value intValue]
                                                       : [value unsignedIntValue]);
        return;
    }
    if (code == 'l' || code == 'L' || code == 'q' || code == 'Q')
    {
        storeNativeValue<uint64_t>(target, code == 'l' || code == 'q'
                                               ? (uint64_t) [value longLongValue]
                                               : [value unsignedLongLongValue]);
        return;
    }
    if (code == 'f')
    {
        storeNativeValue<float>(target, [value floatValue]);
        return;
    }
    if (code == 'd')
    {
        storeNativeValue<double>(target, [value doubleValue]);
        return;
    }
    if (code == '{')
    {
        NSUInteger size      = 0;
        NSUInteger alignment = 0;
        NSGetSizeAndAlignment(encoding, &size, &alignment);
        if (![value isKindOfClass:[NSValue class]] || size > capacity)
        {
            throw JSError(runtime, "Native super struct argument expected");
        }
        [(NSValue *) value getValue:target size:size];
        return;
    }
    throw JSError(runtime, "Unsupported native super argument type");
}

static std::vector<loader::ffi::Type> superArgumentTypes(Runtime           &runtime,
                                                         NSMethodSignature *signature)
{
    std::vector<loader::ffi::Type> types{loader::ffi::resolveType("pointer"),
                                         loader::ffi::resolveType("selector")};
    for (NSUInteger index = 2; index < signature.numberOfArguments; index++)
    {
        std::string name = nativeFFITypeName([signature getArgumentTypeAtIndex:index]);
        if (name.empty())
        {
            throw JSError(runtime, "Unsupported native super argument type encoding");
        }
        types.push_back(loader::ffi::resolveType(name));
    }
    return types;
}

static std::unique_ptr<loader::ffi::CallFrame> superCallFrame(Runtime           &runtime,
                                                              NSMethodSignature *signature)
{
    std::string resultName = nativeFFITypeName(signature.methodReturnType);
    if (resultName.empty())
    {
        throw JSError(runtime, "Unsupported native super return type encoding");
    }
    std::vector<loader::ffi::Type> types = superArgumentTypes(runtime, signature);
    return std::make_unique<loader::ffi::CallFrame>(
        loader::ffi::callInterface(loader::ffi::resolveType(resultName), types));
}

static void setSuperFFIArguments(Runtime &runtime, NSMethodSignature *signature, NSArray *arguments,
                                 struct objc_super *superInfo, SEL selector,
                                 loader::ffi::CallFrame &frame, std::vector<id> &retained)
{
    storeNativeValue<void *>(frame.argument(0), superInfo);
    storeNativeValue<SEL>(frame.argument(1), selector);
    retained.reserve(arguments.count);
    for (NSUInteger index = 0; index < arguments.count; index++)
    {
        setSuperFFIArgument(runtime, [signature getArgumentTypeAtIndex:index + 2], arguments[index],
                            frame.argument(index + 2),
                            loader::ffi::valueStorageSize(frame.interface().arguments[index + 2]),
                            frame.storage(), retained);
    }
}

Value invokeSuperObject(Runtime &runtime, id target, Class currentClass, SEL selector,
                        NSArray *arguments)
{
    if (!target || !currentClass || !selector)
    {
        throw JSError(runtime, "Invalid native Objective-C super target");
    }

    Class  superclass = class_getSuperclass(currentClass);
    Method method     = superclass ? class_getInstanceMethod(superclass, selector) : NULL;
    if (!method)
    {
        throw JSError(runtime, "Objective-C super selector is not available");
    }

    NSMethodSignature *signature =
        [NSMethodSignature signatureWithObjCTypes:method_getTypeEncoding(method)];
    NSUInteger expected = signature.numberOfArguments >= 2 ? signature.numberOfArguments - 2 : 0;
    if (expected != arguments.count)
    {
        throw JSError(runtime,
                      "Objective-C super argument count does not match the method signature");
    }

    std::unique_ptr<loader::ffi::CallFrame> frame = superCallFrame(runtime, signature);
    std::vector<id>                         retained;
    struct objc_super                       superInfo = {target, currentClass};
    setSuperFFIArguments(runtime, signature, arguments, &superInfo, selector, *frame, retained);
    NativeMethodFamily family        = nativeMethodFamily(selector);
    bool               returnsObject = returnsRetainableObject(signature.methodReturnType);
    retainConsumedReceiver(family, returnsObject, target);
    frame->invoke((void *) objc_msgSendSuper);
    autoreleaseOwnedResult(family, returnsObject, frame->result());
    return loader::ffi::readValue(runtime, frame->interface().result, frame->result());
}

namespace {
    struct AsyncSuperCall {
        struct objc_super                       superInfo{};
        std::unique_ptr<loader::ffi::CallFrame> frame;
        std::vector<id>                         retainedArguments;
        __strong id                             retainedTarget = nil;
        __strong id                             retainedResult = nil;
        NativeMethodFamily                      family         = NativeMethodFamilyNone;
        bool                                    returnsObject  = false;
    };
}

Value invokeSuperAsync(Runtime &runtime, id target, Class currentClass, SEL selector,
                       NSArray *arguments)
{
    if (!target || !currentClass || !selector)
    {
        throw JSError(runtime, "Invalid native Objective-C super target");
    }

    Class  superclass = class_getSuperclass(currentClass);
    Method method     = superclass ? class_getInstanceMethod(superclass, selector) : NULL;
    if (!method)
    {
        throw JSError(runtime, "Objective-C super selector is not available");
    }

    NSMethodSignature *signature =
        [NSMethodSignature signatureWithObjCTypes:method_getTypeEncoding(method)];
    NSUInteger expected = signature.numberOfArguments >= 2 ? signature.numberOfArguments - 2 : 0;
    if (expected != arguments.count)
    {
        throw JSError(runtime,
                      "Objective-C super argument count does not match the method signature");
    }

    auto call            = std::make_shared<AsyncSuperCall>();
    call->retainedTarget = target;
    call->superInfo      = {target, currentClass};
    call->frame          = superCallFrame(runtime, signature);
    setSuperFFIArguments(runtime, signature, arguments, &call->superInfo, selector, *call->frame,
                         call->retainedArguments);
    call->family        = nativeMethodFamily(selector);
    call->returnsObject = returnsRetainableObject(signature.methodReturnType);

    return executeMainAsynchronously(
        runtime,
        [call]() {
            retainConsumedReceiver(call->family, call->returnsObject, call->retainedTarget);
            call->frame->invoke((void *) objc_msgSendSuper);
            autoreleaseOwnedResult(call->family, call->returnsObject, call->frame->result());
            const loader::ffi::Type &result = call->frame->interface().result;
            if (result.name == "object" || result.name == "class")
            {
                __unsafe_unretained id object = nil;
                memcpy(&object, call->frame->result(), sizeof(object));
                call->retainedResult = object;
            }
        },
        [call](Runtime &completionRuntime) {
            return loader::ffi::readValue(completionRuntime, call->frame->interface().result,
                                          call->frame->result());
        });
}

Value invokeSuperWithThreadPolicy(Runtime &runtime, id target, Class currentClass, SEL selector,
                                  NSArray *arguments, const Value *options)
{
    std::string policy = loader::native::threadPolicy(runtime, options);
    if (loader::native::runsInPlace(policy, [NSThread isMainThread]))
    {
        return invokeSuperObject(runtime, target, currentClass, selector, arguments);
    }
    if (!loader::native::crossesToMain(policy))
    {
        throw JSError(runtime, "Unsupported native thread policy");
    }

    throw JSError(runtime, "Native super invocation cannot synchronously cross to the main thread");
}
}
