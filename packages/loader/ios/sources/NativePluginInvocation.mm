#import "NativePluginInvocation.h"

#import <UIKit/UIKit.h>
#include <cstring>
#include <mutex>
#import <objc/message.h>
#import <objc/runtime.h>
#include <stdexcept>
#include <unordered_set>

#import "LoaderAddonActivity.h"
#include "LoaderPreferences.h"
#include "LoaderThreadWarnings.h"
#import "Logger.h"
#import "NativeAddressValidation.h"
#import "NativeNumericValidation.h"
#import "NativePluginCallPlans.h"
#import "NativePluginObjCValues.h"
#import "NativePluginRuntime.h"
#import "NativePluginThreading.h"
#import "NativeThreadPolicy.h"
#import "NativeTypeEncoding.h"
#import "SettingsCore.h"

using namespace facebook;
using namespace facebook::jsi;

namespace loader::ios {
Value returnValue(Runtime &runtime, NSInvocation *invocation, NSMethodSignature *signature,
                  const loader::ffi::Type *preparedType)
{
    std::string name = nativeFFITypeName(signature.methodReturnType);
    if (name.empty())
        throw JSError(runtime, "Unsupported native return type");
    if (name == "void")
        return Value::undefined();

    NSUInteger length = signature.methodReturnLength;
    if (length == 0 || length > 4096)
    {
        throw JSError(runtime, "Native return value has an invalid size");
    }

    loader::ffi::Type    type = preparedType ? *preparedType : loader::ffi::resolveType(name);
    std::vector<uint8_t> bytes(std::max<size_t>(length, loader::ffi::valueStorageSize(type)));
    [invocation getReturnValue:bytes.data()];
    return loader::ffi::readValue(runtime, type, bytes.data());
}

std::optional<loader::native::NativeNumberArgument> nativeNumberArgument(id value)
{
    if (![value isKindOfClass:[NSNumber class]])
    {
        return std::nullopt;
    }
    NSNumber                            *number     = (NSNumber *) value;
    const char                          *numberType = number.objCType;
    loader::native::NativeNumberArgument argument;
    argument.value = number.doubleValue;
    if (strcmp(numberType, @encode(long long)) == 0 || strcmp(numberType, @encode(long)) == 0)
    {
        argument.integer     = loader::native::NativeIntegerKind::Signed;
        argument.signedValue = number.longLongValue;
    }
    else if (strcmp(numberType, @encode(unsigned long long)) == 0 ||
             strcmp(numberType, @encode(unsigned long)) == 0)
    {
        argument.integer       = loader::native::NativeIntegerKind::Unsigned;
        argument.unsignedValue = number.unsignedLongLongValue;
    }
    return argument;
}

void validateNativeScalarArgument(id value, const std::string &type)
{
    loader::native::validateScalarArgument(nativeNumberArgument(value), type);
}

static bool isRegisteredClassAddress(uintptr_t candidate)
{
    static std::mutex                    mutex;
    static std::unordered_set<uintptr_t> classes;
    static int                           known = 0;

    std::lock_guard<std::mutex> lock(mutex);
    int                         count = objc_getClassList(nullptr, 0);
    if (count != known)
    {
        unsigned int               copied = 0;
        __unsafe_unretained Class *list   = objc_copyClassList(&copied);
        classes.clear();
        for (unsigned int index = 0; index < copied; index++)
        {
            classes.insert(reinterpret_cast<uintptr_t>((__bridge void *) list[index]));
        }
        free(list);
        known = count;
    }
    return classes.count(candidate) != 0;
}

static bool isObjectPointer(const void *pointer)
{
    uintptr_t address = reinterpret_cast<uintptr_t>(pointer);
    if (address == 0 || (address >> 63) != 0)
    {
        return true;
    }
    if (address % alignof(void *) != 0)
    {
        return false;
    }
    if (isRegisteredClassAddress(address))
    {
        return true;
    }
    uintptr_t isa = 0;
    if (!readMemorySafely(pointer, &isa, sizeof(isa)))
    {
        return false;
    }
    for (uintptr_t mask :
         {~uintptr_t(0), uintptr_t(0x007ffffffffffff8ULL), uintptr_t(0x0000000ffffffff8ULL)})
    {
        if (isRegisteredClassAddress(isa & mask))
        {
            return true;
        }
    }
    return false;
}

static bool isSelectorPointer(const void *pointer)
{
    char first = 0;
    return pointer && readMemorySafely(pointer, &first, sizeof(first)) &&
           sel_isMapped(static_cast<SEL>(const_cast<void *>(pointer)));
}

static void setInvocationArgument(NSInvocation *invocation, NSMethodSignature *signature, id object,
                                  NSUInteger index, std::vector<id> &retained,
                                  std::vector<std::vector<uint8_t>> &storage,
                                  const loader::ffi::Type           *preparedType = nullptr)
{
    const char *type       = [signature getArgumentTypeAtIndex:index];
    char        code       = normalizedType(type);
    std::string scalarType = preparedType ? preparedType->name : nativeFFITypeName(type);
    if (isNativeScalarType(scalarType))
    {
        validateNativeScalarArgument(object, scalarType);
    }

    if (code == '@')
    {
        id argument = object == [NSNull null] ? nil : object;
        if ([object isKindOfClass:[NSValue class]] &&
            strncmp([(NSValue *) object objCType], "^", 1) == 0)
        {
            void *pointer = [(NSValue *) object pointerValue];
            if (!isObjectPointer(pointer))
            {
                throw std::runtime_error(
                    "Native pointer passed for an object argument is not an Objective-C object");
            }
            argument = (__bridge id) pointer;
        }
        retained.push_back(argument);
        id retainedArgument = retained.back();
        [invocation setArgument:&retainedArgument atIndex:index];
        return;
    }

    if (code == '#')
    {
        Class argument = object && object_isClass(object) ? object : Nil;
        [invocation setArgument:&argument atIndex:index];
        return;
    }

    if (code == ':')
    {
        SEL argument = NULL;
        if ([object isKindOfClass:[NSString class]])
        {
            argument = NSSelectorFromString((NSString *) object);
        }
        else if ([object isKindOfClass:[NSValue class]])
        {
            void *pointer = [(NSValue *) object pointerValue];
            if (!isSelectorPointer(pointer))
            {
                throw std::runtime_error(
                    "Native pointer passed for a selector argument is not a registered selector");
            }
            argument = static_cast<SEL>(pointer);
        }
        [invocation setArgument:&argument atIndex:index];
        return;
    }

    if (code == '^' || code == '*')
    {
        void *pointer = nullptr;
        if (code == '*' && [object isKindOfClass:[NSString class]])
        {
            retained.push_back(object);
            pointer = (void *) [(NSString *) object UTF8String];
        }
        else if ([object isKindOfClass:[NSValue class]])
        {
            pointer = [(NSValue *) object pointerValue];
        }
        [invocation setArgument:&pointer atIndex:index];
        return;
    }

    if (code == 'B')
    {
        bool argument = [object respondsToSelector:@selector(boolValue)] && [object boolValue];
        [invocation setArgument:&argument atIndex:index];
        return;
    }

    if (code == 'f')
    {
        float argument =
            [object respondsToSelector:@selector(floatValue)] ? [object floatValue] : 0;
        [invocation setArgument:&argument atIndex:index];
        return;
    }

    if (code == 'd')
    {
        double argument =
            [object respondsToSelector:@selector(doubleValue)] ? [object doubleValue] : 0;
        [invocation setArgument:&argument atIndex:index];
        return;
    }

    if (code == 'q')
    {
        long long argument =
            [object respondsToSelector:@selector(longLongValue)] ? [object longLongValue] : 0;
        [invocation setArgument:&argument atIndex:index];
        return;
    }

    if (code == 'Q')
    {
        unsigned long long argument = [object respondsToSelector:@selector(unsignedLongLongValue)]
                                          ? [object unsignedLongLongValue]
                                          : 0;
        [invocation setArgument:&argument atIndex:index];
        return;
    }

    if (code == 'c')
    {
        int8_t argument = [object respondsToSelector:@selector(charValue)] ? [object charValue] : 0;
        storage.emplace_back(sizeof(argument));
        memcpy(storage.back().data(), &argument, sizeof(argument));
        [invocation setArgument:storage.back().data() atIndex:index];
        return;
    }

    if (code == 'C')
    {
        uint8_t argument = [object respondsToSelector:@selector(unsignedCharValue)]
                               ? [object unsignedCharValue]
                               : 0;
        storage.emplace_back(sizeof(argument));
        memcpy(storage.back().data(), &argument, sizeof(argument));
        [invocation setArgument:storage.back().data() atIndex:index];
        return;
    }

    if (code == 's')
    {
        int16_t argument =
            [object respondsToSelector:@selector(shortValue)] ? [object shortValue] : 0;
        storage.emplace_back(sizeof(argument));
        memcpy(storage.back().data(), &argument, sizeof(argument));
        [invocation setArgument:storage.back().data() atIndex:index];
        return;
    }

    if (code == 'S')
    {
        uint16_t argument = [object respondsToSelector:@selector(unsignedShortValue)]
                                ? [object unsignedShortValue]
                                : 0;
        storage.emplace_back(sizeof(argument));
        memcpy(storage.back().data(), &argument, sizeof(argument));
        [invocation setArgument:storage.back().data() atIndex:index];
        return;
    }

    if (code == 'i')
    {
        int32_t argument = [object respondsToSelector:@selector(intValue)] ? [object intValue] : 0;
        storage.emplace_back(sizeof(argument));
        memcpy(storage.back().data(), &argument, sizeof(argument));
        [invocation setArgument:storage.back().data() atIndex:index];
        return;
    }

    if (code == 'I')
    {
        uint32_t argument =
            [object respondsToSelector:@selector(unsignedIntValue)] ? [object unsignedIntValue] : 0;
        storage.emplace_back(sizeof(argument));
        memcpy(storage.back().data(), &argument, sizeof(argument));
        [invocation setArgument:storage.back().data() atIndex:index];
        return;
    }

    if (code == 'l' || code == 'q')
    {
        int64_t argument =
            [object respondsToSelector:@selector(longLongValue)] ? [object longLongValue] : 0;
        storage.emplace_back(sizeof(argument));
        memcpy(storage.back().data(), &argument, sizeof(argument));
        [invocation setArgument:storage.back().data() atIndex:index];
        return;
    }

    if (code == 'L' || code == 'Q')
    {
        uint64_t argument = [object respondsToSelector:@selector(unsignedLongLongValue)]
                                ? [object unsignedLongLongValue]
                                : 0;
        storage.emplace_back(sizeof(argument));
        memcpy(storage.back().data(), &argument, sizeof(argument));
        [invocation setArgument:storage.back().data() atIndex:index];
        return;
    }

    if (code == '{')
    {
        if (![object isKindOfClass:[NSValue class]])
        {
            throw std::runtime_error("Native struct argument expected");
        }

        NSValue   *structValue = (NSValue *) object;
        NSUInteger size        = 0;
        NSUInteger alignment   = 0;
        NSGetSizeAndAlignment(type, &size, &alignment);
        storage.emplace_back(size);
        [structValue getValue:storage.back().data() size:size];
        [invocation setArgument:storage.back().data() atIndex:index];
        return;
    }

    throw std::runtime_error("Unsupported native argument type");
}

NSInvocation *prepareInvocationWithSignature(id target, SEL selector, NSArray *arguments,
                                             NSMethodSignature                    *signature,
                                             const std::vector<loader::ffi::Type> *preparedTypes)
{
    if (!target || !selector || !signature)
    {
        throw std::runtime_error("Invalid native Objective-C target or selector");
    }

    NSUInteger expected = signature.numberOfArguments >= 2 ? signature.numberOfArguments - 2 : 0;
    if (expected != arguments.count)
    {
        throw std::runtime_error("Objective-C argument count does not match the method signature");
    }

    NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:signature];
    invocation.target        = target;
    invocation.selector      = selector;

    std::vector<id>                   retained;
    std::vector<std::vector<uint8_t>> storage;
    retained.reserve(arguments.count);
    storage.reserve(arguments.count);

    for (NSUInteger index = 0; index < arguments.count; index++)
    {
        const loader::ffi::Type *preparedType =
            preparedTypes && index < preparedTypes->size() ? &(*preparedTypes)[index] : nullptr;
        setInvocationArgument(invocation, signature, arguments[index], index + 2, retained, storage,
                              preparedType);
    }

    [invocation retainArguments];
    NSMutableArray *backingArguments = [NSMutableArray arrayWithCapacity:retained.size()];
    for (id argument : retained)
    {
        if (argument)
            [backingArguments addObject:argument];
    }
    if (backingArguments.count)
    {
        static char backingArgumentsKey;
        objc_setAssociatedObject(invocation, &backingArgumentsKey, backingArguments,
                                 OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    }
    return invocation;
}

static bool selectorHasFamilyPrefix(const char *name, const char *prefix)
{
    size_t length = strlen(prefix);
    if (strncmp(name, prefix, length) != 0)
        return false;
    char next = name[length];
    return next == '\0' || next == ':' || !(next >= 'a' && next <= 'z');
}

NativeMethodFamily nativeMethodFamily(SEL selector)
{
    const char *name = selector ? sel_getName(selector) : nullptr;
    if (!name)
        return NativeMethodFamilyNone;
    while (*name == '_')
        name++;
    if (selectorHasFamilyPrefix(name, "init"))
        return NativeMethodFamilyInit;
    if (selectorHasFamilyPrefix(name, "alloc") || selectorHasFamilyPrefix(name, "new") ||
        selectorHasFamilyPrefix(name, "copy") || selectorHasFamilyPrefix(name, "mutableCopy"))
    {
        return NativeMethodFamilyOwned;
    }
    return NativeMethodFamilyNone;
}

bool returnsRetainableObject(const char *encoding)
{
    return encoding && normalizedType(encoding) == '@';
}

void retainConsumedReceiver(NativeMethodFamily family, bool returnsObject, id receiver)
{
    if (family == NativeMethodFamilyInit && returnsObject && receiver)
        CFRetain((__bridge CFTypeRef) receiver);
}

void autoreleaseOwnedResult(NativeMethodFamily family, bool returnsObject, const void *result)
{
    if (family == NativeMethodFamilyNone || !returnsObject || !result)
        return;
    __unsafe_unretained id object = nil;
    memcpy(&object, result, sizeof(object));
    if (object)
        CFAutorelease((__bridge CFTypeRef) object);
}

void invokeFollowingOwnership(NSInvocation *invocation)
{
    NativeMethodFamily family = nativeMethodFamily(invocation.selector);
    bool returnsObject = returnsRetainableObject(invocation.methodSignature.methodReturnType);
    retainConsumedReceiver(family, returnsObject, invocation.target);
    [invocation invoke];
    if (family == NativeMethodFamilyNone || !returnsObject)
        return;
    __unsafe_unretained id object = nil;
    [invocation getReturnValue:&object];
    autoreleaseOwnedResult(family, returnsObject, &object);
}

NSInvocation *prepareInvocation(id target, SEL selector, NSArray *arguments)
{
    if (!target || !selector)
    {
        throw std::runtime_error("Invalid native Objective-C target or selector");
    }

    NSMethodSignature *signature = [target methodSignatureForSelector:selector];
    if (!signature)
    {
        throw std::runtime_error("Objective-C selector is not available");
    }

    return prepareInvocationWithSignature(target, selector, arguments, signature);
}

Value invokeObject(Runtime &runtime, id target, SEL selector, NSArray *arguments)
{
    NSInvocation *invocation = prepareInvocation(target, selector, arguments);
    invokeFollowingOwnership(invocation);
    return returnValue(runtime, invocation, invocation.methodSignature);
}

static std::string invocationDescription(NSInvocation *invocation)
{
    return std::string("objc.invoke ") + (sel_getName(invocation.selector) ?: "");
}

static void postInvocation(NSInvocation *invocation)
{
    loader::native::postMainOperation(objcGuarded([invocation]() {
                                          invokeFollowingOwnership(invocation);
                                      }),
                                      invocationDescription(invocation));
}

Value invokeInvocationWithThreadPolicy(Runtime &runtime, NSInvocation *invocation,
                                       const Value             *options,
                                       const loader::ffi::Type *preparedResult)
{
    std::string policy = loader::native::threadPolicy(runtime, options);
    if (loader::native::runsInPlace(policy, [NSThread isMainThread]))
    {
        invokeFollowingOwnership(invocation);
        return returnValue(runtime, invocation, invocation.methodSignature, preparedResult);
    }
    if (!loader::native::crossesToMain(policy))
    {
        throw JSError(runtime, "Unsupported native thread policy");
    }
    if (loader::native::postsToMain(
            policy, normalizedType(invocation.methodSignature.methodReturnType) == 'v'))
    {
        postInvocation(invocation);
        return Value::undefined();
    }
    if (loader::native::mainThreadIsWaitingForRuntime())
    {
        throwWrongThread(runtime, loader::native::kMainWaitsForRuntimeMessage);
    }

    __strong id  retainedResult = nil;
    NSException *failure        = nil;
    executeMainSynchronouslyUnlessMainWaits([&]() {
        @try
        {
            invokeFollowingOwnership(invocation);
            char code = normalizedType(invocation.methodSignature.methodReturnType);
            if (code == '@' || code == '#')
            {
                __unsafe_unretained id object = nil;
                [invocation getReturnValue:&object];
                retainedResult = object;
            }
        }
        @catch (NSException *exception)
        {
            failure = exception;
        }
    });
    if (failure)
    {
        throw JSError(runtime, std::string("Objective-C invocation failed: ") +
                                   (failure.reason.UTF8String ?: "unknown"));
    }
    Value result = returnValue(runtime, invocation, invocation.methodSignature, preparedResult);
    (void) retainedResult;
    return result;
}

Value invokeWithThreadPolicy(Runtime &runtime, id target, SEL selector, NSArray *arguments,
                             const Value *options)
{
    return invokeInvocationWithThreadPolicy(runtime, prepareInvocation(target, selector, arguments),
                                            options);
}

namespace {
    struct NativeRetainedObject {
        __strong id value = nil;
    };
}

Value invokeInvocationAsync(Runtime &runtime, NSInvocation *invocation,
                            std::shared_ptr<ObjCCallPlanHost> preparedPlan)
{
    auto retainedResult = std::make_shared<NativeRetainedObject>();
    return executeMainAsynchronously(
        runtime,
        [invocation, retainedResult]() {
            invokeFollowingOwnership(invocation);
            char code = normalizedType(invocation.methodSignature.methodReturnType);
            if (code == '@' || code == '#')
            {
                __unsafe_unretained id object = nil;
                [invocation getReturnValue:&object];
                retainedResult->value = object;
            }
        },
        [invocation, retainedResult, preparedPlan](Runtime &completionRuntime) {
            return returnValue(completionRuntime, invocation, invocation.methodSignature,
                               preparedPlan ? &preparedPlan->resultType() : nullptr);
        });
}

Value invokeAsync(Runtime &runtime, id target, SEL selector, NSArray *arguments)
{
    return invokeInvocationAsync(runtime, prepareInvocation(target, selector, arguments));
}

static void warnOffMainViewCall(id object, NSString *selectorName)
{
    static loader::threading::OffMainViewWarnings warnings([] {
        return loader::preferences::developerMode(UnboundSettingsStore());
    });
    if ([NSThread isMainThread] || !warnings.enabled() || ![object isKindOfClass:[UIView class]] ||
        [NSObject instancesRespondToSelector:NSSelectorFromString(selectorName)])
    {
        return;
    }

    NSString *call =
        [NSString stringWithFormat:@"-[%@ %@]", NSStringFromClass([object class]), selectorName];
    if (auto warning = warnings.warning(loader::currentAddon(), call.UTF8String))
    {
        [Logger warning:LOG_CATEGORY_PLUGINS format:@"%s", warning->c_str()];
    }
}

Value objcFunction(Runtime &runtime, const Value &target, const Value &selectorValue,
                   const Value *args, size_t count, size_t start)
{
    id        object       = objcValue(runtime, target);
    NSString *selectorName = jsiString(runtime, selectorValue);
    if (!object || selectorName.length == 0)
    {
        throw JSError(runtime, "objc.call expects an object handle and selector");
    }

    warnOffMainViewCall(object, selectorName);

    return invokeObject(runtime, object, NSSelectorFromString(selectorName),
                        argumentArray(runtime, args, count, start));
}
}
