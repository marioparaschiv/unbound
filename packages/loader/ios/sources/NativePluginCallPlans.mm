#import "NativePluginCallPlans.h"

#include <exception>
#include <stdexcept>
#include <string>

#import "NativeConversionBudget.h"
#import "NativePluginRuntime.h"
#import "NativeResourceBudget.h"
#import "NativeRuntimeResources.h"
#import "NativeTypeEncoding.h"

using namespace facebook;
using namespace facebook::jsi;

namespace loader::ios {

ObjCCallPlanHost::ObjCCallPlanHost(Class ownerClass, SEL selector, bool classMethod,
                                   NSMethodSignature *signature, loader::ffi::Type resultType,
                                   std::vector<loader::ffi::Type> argumentTypes,
                                   uint64_t runtimeIdentity, uint64_t runtimeGeneration)
    : ownerClass_(ownerClass), selector_(selector), classMethod_(classMethod),
      signature_(signature), resultType_(std::move(resultType)),
      argumentTypes_(std::move(argumentTypes)), runtimeIdentity_(runtimeIdentity),
      runtimeGeneration_(runtimeGeneration)
{
}

ObjCCallPlanHost::~ObjCCallPlanHost()
{
    releasePlanSlot();
}

void ObjCCallPlanHost::validate(Runtime &runtime, id target) const
{
    if (!active_.load(std::memory_order_acquire) ||
        runtimeGeneration_ != loader::native::runtimeGeneration() ||
        runtimeIdentity_ != loader::native::runtimeResourceRegistry(runtime)->identity())
    {
        throw JSError(runtime, "The Objective-C call plan is stale or disposed");
    }
    bool matchesTarget = false;
    if (classMethod_ && object_isClass(target))
    {
        for (Class current = (Class) target; current; current = class_getSuperclass(current))
        {
            if (current == ownerClass_)
            {
                matchesTarget = true;
                break;
            }
        }
    }
    else if (!classMethod_ && target && !object_isClass(target))
    {
        matchesTarget = [target isKindOfClass:ownerClass_];
    }
    if (!matchesTarget)
    {
        throw JSError(runtime, "The Objective-C call target does not match its prepared class");
    }
}

void ObjCCallPlanHost::dispose()
{
    active_.store(false, std::memory_order_release);
    signature_ = nil;
    releasePlanSlot();
}

void ObjCCallPlanHost::releasePlanSlot()
{
    if (slotActive_.exchange(false, std::memory_order_acq_rel))
    {
        loader::native::nativePreparedCallBudget().release();
    }
}

std::shared_ptr<ObjCCallPlanHost> objcCallPlanHost(Runtime &runtime, const Value &value)
{
    if (!value.isObject() || !value.asObject(runtime).isHostObject<ObjCCallPlanHost>(runtime))
    {
        throw JSError(runtime, "An Objective-C call plan is required");
    }
    return value.asObject(runtime).getHostObject<ObjCCallPlanHost>(runtime);
}

std::shared_ptr<ObjCCallPlanHost> prepareObjCCallPlan(Runtime &runtime, id target, SEL selector)
{
    if (!target || !selector)
    {
        throw JSError(runtime, "Invalid native Objective-C call-plan target or selector");
    }
    bool   classMethod = object_isClass(target);
    Class  ownerClass  = classMethod ? (Class) target : [target class];
    Method method      = classMethod ? class_getClassMethod(ownerClass, selector)
                                     : class_getInstanceMethod(ownerClass, selector);
    if (!method)
    {
        throw JSError(runtime, "Objective-C call-plan selector is unavailable");
    }
    NSMethodSignature *signature =
        [NSMethodSignature signatureWithObjCTypes:method_getTypeEncoding(method)];
    if (!signature || signature.numberOfArguments < 2 ||
        signature.numberOfArguments - 2 > kMaximumNativeArguments)
    {
        throw JSError(runtime, "Objective-C call-plan signature is invalid");
    }
    std::string resultName = nativeFFITypeName(signature.methodReturnType);
    if (resultName.empty())
    {
        throw JSError(runtime, "Unsupported Objective-C call-plan return type");
    }
    loader::ffi::Type              resultType;
    std::vector<loader::ffi::Type> argumentTypes;
    argumentTypes.reserve(signature.numberOfArguments - 2);
    try
    {
        resultType = loader::ffi::resolveType(resultName);
        for (NSUInteger index = 2; index < signature.numberOfArguments; index++)
        {
            const char *encoding = [signature getArgumentTypeAtIndex:index];
            char        code     = normalizedType(encoding);
            if (code != '@' && code != '#' && code != 'c' && code != 'C' && code != 's' &&
                code != 'S' && code != 'i' && code != 'I' && code != 'l' && code != 'L' &&
                code != 'q' && code != 'Q' && code != 'B' && code != 'f' && code != 'd' &&
                code != '{')
            {
                throw std::invalid_argument("Unsupported Objective-C call-plan argument type");
            }
            std::string name = nativeFFITypeName(encoding);
            if (name.empty())
            {
                throw std::invalid_argument("Unsupported Objective-C call-plan argument type");
            }
            argumentTypes.push_back(loader::ffi::resolveType(name));
        }
    }
    catch (const std::exception &error)
    {
        throw JSError(runtime, error.what());
    }
    if (!loader::native::nativePreparedCallBudget().acquire())
    {
        throw JSError(runtime, "Too many prepared Objective-C calls are active");
    }
    try
    {
        auto resources = loader::native::runtimeResourceRegistry(runtime);
        return std::make_shared<ObjCCallPlanHost>(
            ownerClass, selector, classMethod, signature, std::move(resultType),
            std::move(argumentTypes), resources->identity(), loader::native::runtimeGeneration());
    }
    catch (...)
    {
        loader::native::nativePreparedCallBudget().release();
        throw;
    }
}
}
