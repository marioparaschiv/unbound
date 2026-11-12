#import "NativePluginBatch.h"

#import <Foundation/Foundation.h>
#import <objc/runtime.h>
#include <optional>
#include <stdexcept>
#include <vector>

#import "NativeArgumentValidation.h"
#import "NativeBatchReferences.h"
#import "NativeLimits.h"
#import "NativePluginInvocation.h"
#import "NativePluginObjCValues.h"
#import "NativePluginThreading.h"
#import "NativeTypeEncoding.h"

using namespace facebook;
using namespace facebook::jsi;

namespace loader::ios {
namespace {
    struct NativeBatchArgument {
        __strong id value       = nil;
        NSInteger   resultIndex = -1;
    };

    struct NativeBatchStep {
        __strong id                      target            = nil;
        NSInteger                        targetResultIndex = -1;
        __strong NSString               *selector          = nil;
        std::vector<NativeBatchArgument> arguments;
    };
}

static NSInteger batchResultIndex(Runtime &runtime, const Value &value, size_t stepIndex)
{
    std::optional<size_t> index = loader::native::batchResultIndex(runtime, value, stepIndex);
    return index ? static_cast<NSInteger>(*index) : -1;
}

static void validateBatchArgument(id value, const char *encoding)
{
    loader::native::NativeArgumentShape argument;
    argument.number      = nativeNumberArgument(value);
    argument.null        = value == [NSNull null];
    argument.string      = [value isKindOfClass:[NSString class]];
    argument.classObject = object_isClass(value);
    argument.boxedEncoding =
        [value isKindOfClass:[NSValue class]] ? [(NSValue *) value objCType] : nullptr;
    loader::native::validateBatchArgument(argument, encoding);
}

static id batchNativeResult(NSInvocation *invocation)
{
    NSMethodSignature *signature = invocation.methodSignature;
    const char        *type      = signature.methodReturnType;
    char               code      = normalizedType(type);
    if (code == 'v' || signature.methodReturnLength == 0)
    {
        return [NSNull null];
    }
    if (code == '@' || code == '#')
    {
        __unsafe_unretained id object = nil;
        [invocation getReturnValue:&object];
        return object ?: [NSNull null];
    }
    if (code == ':')
    {
        SEL selector = NULL;
        [invocation getReturnValue:&selector];
        return selector ? NSStringFromSelector(selector) : [NSNull null];
    }
    if (code == '^' || code == '*')
    {
        void *pointer = nullptr;
        [invocation getReturnValue:&pointer];
        return [NSValue valueWithPointer:pointer];
    }
    if (code == '{')
    {
        std::vector<uint8_t> bytes(signature.methodReturnLength);
        [invocation getReturnValue:bytes.data()];
        return [NSValue value:bytes.data() withObjCType:type];
    }
    if (code == 'f')
    {
        float value = 0;
        [invocation getReturnValue:&value];
        return @(value);
    }
    if (code == 'd')
    {
        double value = 0;
        [invocation getReturnValue:&value];
        return @(value);
    }
    if (code == 'B')
    {
        bool value = false;
        [invocation getReturnValue:&value];
        return @(value);
    }
    if (code == 'c')
    {
        int8_t value = 0;
        [invocation getReturnValue:&value];
        return @(value);
    }
    if (code == 'C')
    {
        uint8_t value = 0;
        [invocation getReturnValue:&value];
        return @(value);
    }
    if (code == 's')
    {
        int16_t value = 0;
        [invocation getReturnValue:&value];
        return @(value);
    }
    if (code == 'S')
    {
        uint16_t value = 0;
        [invocation getReturnValue:&value];
        return @(value);
    }
    if (code == 'i')
    {
        int32_t value = 0;
        [invocation getReturnValue:&value];
        return @(value);
    }
    if (code == 'I')
    {
        uint32_t value = 0;
        [invocation getReturnValue:&value];
        return @(value);
    }
    if (code == 'l' || code == 'q')
    {
        int64_t value = 0;
        [invocation getReturnValue:&value];
        return @(value);
    }
    if (code == 'L' || code == 'Q')
    {
        uint64_t value = 0;
        [invocation getReturnValue:&value];
        return @(value);
    }
    throw std::runtime_error("Unsupported native batch return type");
}

Value invokeBatch(Runtime &runtime, const Value *args, size_t count)
{
    if (count == 0 || !args[0].isObject() || !args[0].asObject(runtime).isArray(runtime))
    {
        throw JSError(runtime, "objc.batch expects an array of steps");
    }
    Array input = args[0].asObject(runtime).asArray(runtime);
    if (input.size(runtime) > loader::native::kMaximumBatchSteps)
    {
        throw JSError(runtime, "Native batch requires at most 64 steps");
    }

    std::vector<NativeBatchStep> steps;
    steps.reserve(input.size(runtime));
    for (size_t index = 0; index < input.size(runtime); index++)
    {
        Value rawStep = input.getValueAtIndex(runtime, index);
        if (!rawStep.isObject())
        {
            throw JSError(runtime, "Native batch step is malformed");
        }
        Object stepObject   = rawStep.asObject(runtime);
        Value  rawTarget    = stepObject.getProperty(runtime, "target");
        Value  rawSelector  = stepObject.getProperty(runtime, "selector");
        Value  rawArguments = stepObject.getProperty(runtime, "args");
        if (!rawSelector.isString() || !rawArguments.isObject() ||
            !rawArguments.asObject(runtime).isArray(runtime))
        {
            throw JSError(runtime, "Native batch step is malformed");
        }
        Array     arguments = rawArguments.asObject(runtime).asArray(runtime);
        NSString *selector  = jsiString(runtime, rawSelector);
        if (selector.length > 256 || arguments.size(runtime) > 16)
        {
            throw JSError(runtime, "Native batch step exceeds its limits");
        }

        NativeBatchStep step;
        step.targetResultIndex = batchResultIndex(runtime, rawTarget, index);
        step.target            = step.targetResultIndex >= 0 ? nil : objcValue(runtime, rawTarget);
        if (step.targetResultIndex < 0 && !step.target)
        {
            throw JSError(runtime, "Native batch target is not an object handle");
        }
        step.selector = selector;
        step.arguments.reserve(arguments.size(runtime));
        for (size_t argumentIndex = 0; argumentIndex < arguments.size(runtime); argumentIndex++)
        {
            Value               rawArgument = arguments.getValueAtIndex(runtime, argumentIndex);
            NativeBatchArgument argument;
            argument.resultIndex = batchResultIndex(runtime, rawArgument, index);
            if (argument.resultIndex < 0)
            {
                argument.value = valueToObjC(runtime, rawArgument) ?: [NSNull null];
            }
            step.arguments.push_back(argument);
        }
        steps.push_back(step);
    }

    NSMutableArray<NSInvocation *> *invocations = [NSMutableArray arrayWithCapacity:steps.size()];
    NSMutableArray                 *values      = [NSMutableArray arrayWithCapacity:steps.size()];
    return executeMainAsynchronously(
        runtime,
        [steps = std::move(steps), invocations, values]() {
            for (const NativeBatchStep &step : steps)
            {
                id target =
                    step.targetResultIndex >= 0 ? values[step.targetResultIndex] : step.target;
                if (target == [NSNull null])
                {
                    throw std::runtime_error("Native batch target is null");
                }
                NSMutableArray *arguments =
                    [NSMutableArray arrayWithCapacity:step.arguments.size()];
                for (const NativeBatchArgument &argument : step.arguments)
                {
                    [arguments addObject:argument.resultIndex >= 0
                                             ? values[argument.resultIndex]
                                             : argument.value ?: [NSNull null]];
                }
                SEL                selector  = NSSelectorFromString(step.selector);
                NSMethodSignature *signature = [target methodSignatureForSelector:selector];
                if (!signature || nativeFFITypeName(signature.methodReturnType).empty())
                {
                    throw std::runtime_error("Native batch method return type is unsupported");
                }
                if (signature.numberOfArguments < 2 ||
                    signature.numberOfArguments - 2 != arguments.count)
                {
                    throw std::runtime_error(
                        "Native batch argument count does not match the method signature");
                }
                for (NSUInteger index = 2; index < signature.numberOfArguments; index++)
                {
                    validateBatchArgument(arguments[index - 2],
                                          [signature getArgumentTypeAtIndex:index]);
                }
                NSInvocation *invocation = prepareInvocation(target, selector, arguments);
                invokeFollowingOwnership(invocation);
                [invocations addObject:invocation];
                [values addObject:batchNativeResult(invocation)];
            }
        },
        [invocations, values](Runtime &completionRuntime) -> Value {
            Array result(completionRuntime, invocations.count);
            for (NSUInteger index = 0; index < invocations.count; index++)
            {
                NSInvocation *invocation = invocations[index];
                result.setValueAtIndex(
                    completionRuntime, index,
                    returnValue(completionRuntime, invocation, invocation.methodSignature));
            }
            (void) values;
            return result;
        });
}
}
