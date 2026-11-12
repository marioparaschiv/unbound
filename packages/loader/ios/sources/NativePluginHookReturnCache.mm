#import "NativePluginHookReturnCache.h"

#include <cstring>
#include <mutex>
#include <vector>

#import "NativePluginHookDispatch.h"
#import "NativePluginObjCValues.h"
#import "NativePluginRuntime.h"
#import "NativeResourceBudget.h"
#import "NativeTypeEncoding.h"

using namespace facebook;
using namespace facebook::jsi;

namespace loader::ios {
static id hookCacheComponent(const loader::ffi::Type &spec, const uint8_t *bytes)
{
    if (spec.name == "object" || spec.name == "class")
    {
        id object = (__bridge id) loadNativeValue<void *>(bytes);
        return object ?: [NSNull null];
    }
    if (spec.name == "selector")
    {
        SEL selector = loadNativeValue<SEL>(bytes);
        return selector ? NSStringFromSelector(selector) : [NSNull null];
    }
    if (spec.name == "pointer")
    {
        return [NSValue valueWithPointer:loadNativeValue<void *>(bytes)];
    }
    if (spec.name == "cstring")
    {
        const char *string = loadNativeValue<const char *>(bytes);
        return string ? ([NSString stringWithUTF8String:string] ?: [NSNull null]) : [NSNull null];
    }
    if (spec.name == "bool")
    {
        return @(loadNativeValue<bool>(bytes));
    }
    if (spec.name == "i8")
    {
        return @(loadNativeValue<int8_t>(bytes));
    }
    if (spec.name == "u8")
    {
        return @(loadNativeValue<uint8_t>(bytes));
    }
    if (spec.name == "i16")
    {
        return @(loadNativeValue<int16_t>(bytes));
    }
    if (spec.name == "u16")
    {
        return @(loadNativeValue<uint16_t>(bytes));
    }
    if (spec.name == "i32")
    {
        return @(loadNativeValue<int32_t>(bytes));
    }
    if (spec.name == "u32")
    {
        return @(loadNativeValue<uint32_t>(bytes));
    }
    if (spec.name == "i64")
    {
        return @(loadNativeValue<int64_t>(bytes));
    }
    if (spec.name == "u64")
    {
        return @(loadNativeValue<uint64_t>(bytes));
    }
    if (spec.name == "float")
    {
        return @(loadNativeValue<float>(bytes));
    }
    if (spec.name == "double")
    {
        return @(loadNativeValue<double>(bytes));
    }
    if (spec.kind == loader::ffi::Kind::Struct)
    {
        const char *encoding = nativeStructEncoding(spec.layout->name);
        return encoding ? [NSValue value:bytes withObjCType:encoding] : nil;
    }
    return nil;
}

static NSArray *hookReturnCacheKey(Runtime &runtime, const std::shared_ptr<HookState> &state,
                                   const Value *args, size_t count)
{
    if (!state || !state->cacheOnly || count < 2 || !args[1].isObject() ||
        !args[1].asObject(runtime).isArray(runtime))
    {
        throw JSError(runtime, "Native hook return caching is unavailable");
    }

    std::shared_ptr<HookDispatcher> dispatcher = state->dispatcher.lock();
    if (!dispatcher)
    {
        throw JSError(runtime, "Native hook has been removed");
    }

    id     target   = objcValue(runtime, args[0]);
    Array  values   = args[1].asObject(runtime).asArray(runtime);
    size_t expected = dispatcher->signature->arguments.size() - 2;
    if (!target || values.size(runtime) != expected)
    {
        throw JSError(runtime, "Native hook return cache arguments do not match the method");
    }

    NSMutableArray *components = [NSMutableArray arrayWithCapacity:expected + 2];
    [components addObject:target];
    [components addObject:NSStringFromSelector(dispatcher->selector)];
    for (size_t index = 0; index < expected; index++)
    {
        const loader::ffi::Type     &spec = dispatcher->signature->arguments[index + 2];
        std::vector<uint8_t>         bytes(loader::ffi::valueStorageSize(spec));
        loader::ffi::ArgumentStorage storage;
        loader::ffi::writeValue(runtime, values.getValueAtIndex(runtime, index), spec, bytes.data(),
                                storage);
        id component = hookCacheComponent(spec, bytes.data());
        if (!component)
        {
            throw JSError(runtime, "Native hook return cache argument type is unsupported");
        }
        [components addObject:component];
    }
    return [components copy];
}

static NSArray *hookReturnCacheKey(const std::shared_ptr<HookDispatcher> &dispatcher,
                                   void                                 **arguments)
{
    if (!dispatcher || !arguments)
    {
        return nil;
    }

    NSMutableArray *components =
        [NSMutableArray arrayWithCapacity:dispatcher->signature->arguments.size()];
    for (size_t index = 0; index < dispatcher->signature->arguments.size(); index++)
    {
        id component = hookCacheComponent(dispatcher->signature->arguments[index],
                                          static_cast<const uint8_t *>(arguments[index]));
        if (!component)
        {
            return nil;
        }
        [components addObject:component];
    }
    return [components copy];
}

bool applyCachedHookReturn(const std::shared_ptr<HookState>      &state,
                           const std::shared_ptr<HookDispatcher> &dispatcher, void **arguments,
                           void *returnValue)
{
    NSArray *key    = hookReturnCacheKey(dispatcher, arguments);
    NSData  *cached = nil;
    if (key)
    {
        std::lock_guard<std::mutex> lock(state->returnCacheMutex);
        cached = state->returnCache[key];
    }
    if (cached && returnValue &&
        cached.length == loader::ffi::typeSize(dispatcher->signature->result))
    {
        memcpy(returnValue, cached.bytes, cached.length);
        return true;
    }
    return false;
}

static void reserveHookCacheEntry(Runtime &runtime, const std::shared_ptr<HookState> &state,
                                  NSMutableDictionary *cache, NSArray *key)
{
    if (!state->active.load())
    {
        loader::native::throwCoded(runtime, loader::native::kNativeBridgeErrorCode,
                                   "Native hook has been removed");
    }
    if (cache[key] == nil && !loader::native::nativeCachedReturnBudget().acquire())
    {
        loader::native::throwCoded(runtime, loader::native::kNativeBridgeErrorCode,
                                   "Too many cached native hook results");
    }
}

static void releaseHookCacheEntry(NSMutableDictionary *cache, NSArray *key)
{
    if (cache[key] != nil)
    {
        [cache removeObjectForKey:key];
        loader::native::nativeCachedReturnBudget().release();
    }
}

void setHookReturnCache(Runtime &runtime, const std::shared_ptr<HookState> &state,
                        const Value *args, size_t count)
{
    if (!state || !state->cacheOnly || count < 3)
    {
        throw JSError(runtime, "Native hook does not support cached return values");
    }

    std::shared_ptr<HookDispatcher> dispatcher = state->dispatcher.lock();
    if (!dispatcher)
    {
        throw JSError(runtime, "Native hook has been removed");
    }

    const loader::ffi::Type &result = dispatcher->signature->result;
    std::vector<uint8_t>     bytes(loader::ffi::valueStorageSize(result));
    if (!setHookReturn(runtime, result, args[2], bytes.data()))
    {
        throw JSError(runtime, "Native hook return value has an unsupported type");
    }

    NSArray *key   = hookReturnCacheKey(runtime, state, args, count);
    NSData  *value = [NSData dataWithBytes:bytes.data() length:loader::ffi::typeSize(result)];
    std::lock_guard<std::mutex> lock(state->returnCacheMutex);
    reserveHookCacheEntry(runtime, state, state->returnCache, key);
    state->returnCache[key] = value;
}

void removeHookReturnCache(Runtime &runtime, const std::shared_ptr<HookState> &state,
                           const Value *args, size_t count)
{
    NSArray                    *key = hookReturnCacheKey(runtime, state, args, count);
    std::lock_guard<std::mutex> lock(state->returnCacheMutex);
    releaseHookCacheEntry(state->returnCache, key);
}

void clearHookReturnCache(const std::shared_ptr<HookState> &state)
{
    if (!state)
    {
        return;
    }
    std::lock_guard<std::mutex> lock(state->returnCacheMutex);
    loader::native::nativeCachedReturnBudget().release(state->returnCache.count);
    [state->returnCache removeAllObjects];
}
}
