#import "NativePluginBridge.h"

#import <UIKit/UIKit.h>
#import <algorithm>
#import <atomic>
#import <cmath>
#import <cstdint>
#import <cstring>
#import <exception>
#import <functional>
#import <memory>
#import <mutex>
#import <objc/message.h>
#import <objc/runtime.h>
#import <optional>
#import <os/signpost.h>
#import <stdexcept>
#import <string>
#import <string_view>
#import <substrate.h>
#import <thread>
#import <type_traits>
#import <unordered_map>
#import <unordered_set>
#import <vector>

#import "CoreConversions.h"
#import "LoaderAddonActivity.h"
#import "Logger.h"
#import "NativeAddressValidation.h"
#import "NativeAssociationPolicy.h"
#import "NativeConversionBudget.h"
#import "NativeEvaluations.h"
#import "NativeFFI.h"
#import "NativeFabric.h"
#import "NativeGeometry.h"
#import "NativeLimits.h"
#import "NativeNumericValidation.h"
#import "NativeOperationGate.h"
#import "NativePlatformBridge.h"
#import "NativePluginRoot.h"
#import "NativePluginRuntime.h"
#import "NativeResourceBudget.h"
#import "NativeStructLayouts.h"
#import "NativeTraversalOptions.h"
#import "NativeTypeEncoding.h"

using namespace facebook;
using namespace facebook::jsi;

@interface NSObject (RuntimeExecutor)
- (void)callFunctionOnBufferedRuntimeExecutor:
    (std::function<void(facebook::jsi::Runtime &)> &&)executor;
@end

@interface NSObject (FabricHost)
- (id)createSurfaceWithModuleName:(NSString *)moduleName
                             mode:(NSInteger)mode
                initialProperties:(NSDictionary *)properties;
@end

@interface                          FabricContainer : UIView
@property (nonatomic, weak) UIView *surfaceView;
- (void)setFabricFrame:(CGRect)frame;
@end

@implementation FabricContainer

{
    BOOL _fabricFrameProtected;
    BOOL _fabricSettingFrame;
}

- (void)setFrame:(CGRect)frame
{
    if (_fabricFrameProtected && !_fabricSettingFrame)
    {
        return;
    }
    [super setFrame:frame];
}

- (void)setFabricFrame:(CGRect)frame
{
    _fabricFrameProtected = YES;
    _fabricSettingFrame   = YES;
    [super setFrame:frame];
    _fabricSettingFrame = NO;
}

- (void)layoutSubviews
{
    [super layoutSubviews];
    UIView *surfaceView = self.surfaceView;
    if (surfaceView)
    {
        surfaceView.frame = self.bounds;
        surfaceView.autoresizingMask =
            UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    }
}

@end

namespace {

static std::atomic<size_t> gLiveObjCHandles{0};

class ObjCHandleHost final : public HostObject
{
public:
    explicit ObjCHandleHost(id value) : value_(value)
    {
        gLiveObjCHandles++;
    }

    ~ObjCHandleHost() override
    {
        gLiveObjCHandles--;
    }

    id value(void) const
    {
        return value_;
    }

private:
    __strong id value_;
};

class NativeDataBuffer final : public MutableBuffer
{
public:
    explicit NativeDataBuffer(NSData *value)
    {
        if (value.length == 0)
        {
            return;
        }

        const uint8_t *bytes = static_cast<const uint8_t *>(value.bytes);
        bytes_.assign(bytes, bytes + value.length);
    }

    size_t size() const override
    {
        return bytes_.size();
    }

    uint8_t *data() override
    {
        return bytes_.data();
    }

private:
    std::vector<uint8_t> bytes_;
};

using loader::ffi::PointerHost;

static Value structFields(Runtime &runtime, NSString *name, NSValue *value);

class StructHost final : public HostObject
{
public:
    StructHost(NSString *name, NSValue *value) : name_([name copy]), value_(value) {}

    Value get(Runtime &runtime, const PropNameID &name) override;

    NSString *name(void) const
    {
        return name_;
    }

    NSValue *value(void) const
    {
        return value_;
    }

private:
    NSString *name_;
    NSValue  *value_;
};

class AssociationKeyHost final : public HostObject
{
public:
    explicit AssociationKeyHost(id value) : value_(value) {}

    const void *key(void) const
    {
        return (__bridge const void *) value_;
    }

private:
    __strong id value_;
};

struct HookSignature {
    loader::ffi::Type                           result;
    std::vector<loader::ffi::Type>              arguments;
    std::shared_ptr<loader::ffi::CallInterface> interface;
};

struct HookState;
struct HookDispatcher;

struct HookCallbacks {
    std::shared_ptr<Function> before;
    std::shared_ptr<Function> after;
    std::shared_ptr<Function> replace;
};

struct HookDispatcher {
    Class                                   cls;
    SEL                                     selector;
    IMP                                     original;
    std::shared_ptr<HookSignature>          signature;
    ffi_closure                            *closure = nullptr;
    void                                   *code    = nullptr;
    std::vector<std::shared_ptr<HookState>> hooks;
    std::atomic_uint                        activeCalls{0};
    std::atomic_bool                        retired{false};
};

struct HookState {
    uint64_t                      identifier;
    uint64_t                      runtimeGeneration;
    std::weak_ptr<HookCallbacks>  callbacks;
    bool                          hasBefore  = false;
    bool                          hasAfter   = false;
    bool                          hasReplace = false;
    std::weak_ptr<HookDispatcher> dispatcher;
    __strong id                   instanceTarget = nil;
    std::mutex                    returnCacheMutex;
    __strong NSMutableDictionary<NSArray *, NSData *> *returnCache =
        [NSMutableDictionary dictionary];
    bool              cacheOnly = false;
    bool              once      = false;
    loader::AddonSlot addon     = loader::kNoAddon;
    std::atomic_bool  active{true};
    std::atomic_bool  afterOncePending{false};
};

class HookTokenHost final : public HostObject
{
public:
    HookTokenHost(std::shared_ptr<HookState> state, std::shared_ptr<HookCallbacks> callbacks)
        : state_(std::move(state)), callbacks_(std::move(callbacks))
    {
    }

    std::shared_ptr<HookState> state(void) const
    {
        return state_;
    }

    Value get(Runtime &runtime, const PropNameID &name) override;

private:
    std::shared_ptr<HookState>     state_;
    std::shared_ptr<HookCallbacks> callbacks_;
};

static std::mutex                                                            gHookMutex;
static std::unordered_map<std::string, std::shared_ptr<HookDispatcher>>      gDispatchers;
static std::unordered_map<HookDispatcher *, std::shared_ptr<HookDispatcher>> gClosureDispatchers;
static std::atomic_uint64_t                                                  gNextHookIdentifier{1};
static __weak id gRuntimeExecutorInstance = nil;
static __weak id gFabricHostInstance      = nil;

static os_log_t nativePerformanceLog()
{
    static os_log_t log = os_log_create("app.unbound", "NativePluginPerformance");
    return log;
}

class NativeOperationSignpost
{
public:
    explicit NativeOperationSignpost(const char *operation)
        : log_(nativePerformanceLog()), enabled_(os_signpost_enabled(log_))
    {
        if (!enabled_)
            return;
        identifier_ = os_signpost_id_generate(log_);
        os_signpost_interval_begin(log_, identifier_, "Native Operation", "operation=%{public}s",
                                   operation);
    }

    ~NativeOperationSignpost()
    {
        if (enabled_)
            os_signpost_interval_end(log_, identifier_, "Native Operation");
    }

private:
    os_log_t         log_;
    os_signpost_id_t identifier_ = OS_SIGNPOST_ID_INVALID;
    bool             enabled_;
};

static void  dispatchFFIHook(ffi_cif *cif, void *returnValue, void **arguments, void *userData);
static void  dispatchFFIHookBody(ffi_cif *cif, void *returnValue, void **arguments, void *userData);
static void  executeRuntimeAsynchronously(std::function<void(Runtime &)> callback);
static Value executeMainAsynchronously(Runtime &runtime, std::function<void(void)> operation,
                                       std::function<Value(Runtime &)> result);
static std::function<void(void)> objcGuarded(std::function<void(void)> operation);
static void                      dispatchVoidHook(id object, SEL selector);
static Value                     makeHook(Runtime &runtime, const Value *args, size_t count);
static void invokeHookOriginal(const std::shared_ptr<HookDispatcher> &dispatcher, void **arguments,
                               void *returnValue);
static void setHookReturnCache(Runtime &runtime, const std::shared_ptr<HookState> &state,
                               const Value *args, size_t count);
static void removeHookReturnCache(Runtime &runtime, const std::shared_ptr<HookState> &state,
                                  const Value *args, size_t count);
static void clearHookReturnCache(const std::shared_ptr<HookState> &state);

class IOSNativePluginExecutor final : public loader::native::NativePluginExecutor
{
public:
    bool isMainThread() override
    {
        return [NSThread isMainThread];
    }

    void runOnMain(std::function<void()> work) override
    {
        auto task = std::make_shared<std::function<void()>>(std::move(work));
        dispatch_async(dispatch_get_main_queue(), ^{
            @autoreleasepool
            {
                (*task)();
            }
        });
    }

    void runOnRuntime(std::function<void(Runtime &)> work) override
    {
        id instance = gRuntimeExecutorInstance;
        if (!instance)
        {
            return;
        }

        [instance callFunctionOnBufferedRuntimeExecutor:[work = std::move(work)](Runtime &runtime) {
            @autoreleasepool
            {
                work(runtime);
            }
        }];
    }

    void runAfter(double seconds, std::function<void()> work) override
    {
        auto task = std::make_shared<std::function<void()>>(std::move(work));
        dispatch_after(
            dispatch_time(DISPATCH_TIME_NOW, static_cast<int64_t>(seconds * NSEC_PER_SEC)),
            dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{ (*task)(); });
    }
};

[[noreturn]] static void throwWrongThread(Runtime &runtime, const char *message)
{
    loader::native::throwCoded(runtime, "NATIVE_WRONG_THREAD", message);
}

static Value objcJSIValue(Runtime &runtime, id value)
{
    return loader::toJSIValue(runtime, unbound::ios::jsonFromObject(value));
}

static NSString *jsiString(Runtime &runtime, const Value &value)
{
    return value.isString() ? unbound::ios::toNSString(value.asString(runtime).utf8(runtime)) : nil;
}

static Value makeFunction(const char *name, unsigned int argCount, Runtime &runtime,
                          const HostFunctionType &handler)
{
    HostFunctionType translated = [handler](Runtime &rt, const Value &thisValue, const Value *args,
                                            size_t count) -> Value {
        @try
        {
            return handler(rt, thisValue, args, count);
        }
        @catch (NSException *exception)
        {
            throw loader::native::NativeCodedError("NATIVE_BRIDGE_ERROR",
                                                   std::string("Objective-C exception: ") +
                                                       (exception.reason.UTF8String ?: "unknown"));
        }
    };
    return loader::native::makeFunction(runtime, name, argCount, std::move(translated));
}

static Value makeFunction(const char *name, unsigned int argCount, Runtime &runtime,
                          Value (*handler)(Runtime &, const Value *, size_t))
{
    HostFunctionType wrappedHandler = [handler](Runtime &rt, const Value &, const Value *args,
                                                size_t count) -> Value {
        return handler(rt, args, count);
    };
    return makeFunction(name, argCount, runtime, wrappedHandler);
}

static std::string hookKey(Class cls, SEL selector)
{
    return std::string(class_getName(cls)) + ":" + sel_getName(selector);
}

static std::shared_ptr<ObjCHandleHost> objcHost(Runtime &runtime, const Value &value)
{
    if (!value.isObject())
    {
        return nullptr;
    }

    Object object = value.asObject(runtime);
    if (!object.isHostObject<ObjCHandleHost>(runtime))
    {
        return nullptr;
    }

    return object.getHostObject<ObjCHandleHost>(runtime);
}

static id objcValue(Runtime &runtime, const Value &value)
{
    std::shared_ptr<ObjCHandleHost> host = objcHost(runtime, value);
    return host ? host->value() : nil;
}

static Value objcHandleResult(Runtime &runtime, id value)
{
    if (!value)
    {
        return Value::null();
    }

    return Object::createFromHostObject(runtime, std::make_shared<ObjCHandleHost>(value));
}

static Value pointerResult(Runtime &runtime, void *pointer)
{
    return loader::ffi::pointerValue(runtime, pointer);
}

template <typename T> static void storeNativeValue(uint8_t *target, T value)
{
    memcpy(target, &value, sizeof(value));
}

template <typename T> static T loadNativeValue(const uint8_t *source)
{
    T value{};
    memcpy(&value, source, sizeof(value));
    return value;
}

struct ConversionState {
    explicit ConversionState(const NativeConversionProfile &profile = kNativeValueConversion)
        : budget(profile)
    {
    }

    NativeConversionBudget    budget;
    std::vector<const void *> nativePath;
    std::vector<Object>       javascriptPath;

    void enter(Runtime &runtime)
    {
        if (!budget.enter())
        {
            throw JSError(runtime, "Native value exceeds conversion limits");
        }
    }

    void addBytes(Runtime &runtime, size_t count)
    {
        if (!budget.addBytes(count))
        {
            throw JSError(runtime, "Native value exceeds conversion byte limit");
        }
    }

    void addString(Runtime &runtime, size_t count)
    {
        if (!budget.addString(count))
        {
            throw JSError(runtime, "Native value exceeds conversion string limit");
        }
    }

    void addName(Runtime &runtime, size_t count)
    {
        if (!budget.addName(count))
        {
            throw JSError(runtime, "Native value exceeds conversion name limit");
        }
    }

    void ensureEntries(Runtime &runtime, size_t count)
    {
        if (!budget.reserveEntries(count))
        {
            throw JSError(runtime, "Native value exceeds conversion limits");
        }
    }
};

struct ConversionGuard {
    explicit ConversionGuard(Runtime &runtime, ConversionState &state) : state(state)
    {
        state.enter(runtime);
    }

    ~ConversionGuard()
    {
        state.budget.leave();
    }

    ConversionState &state;
};

struct NativeConversionVisit {
    NativeConversionVisit(Runtime &runtime, ConversionState &state, id value) : state(state)
    {
        const void *identity = (__bridge const void *) value;
        if (std::find(state.nativePath.begin(), state.nativePath.end(), identity) !=
            state.nativePath.end())
        {
            throw JSError(runtime, "Native value contains a collection cycle");
        }
        state.nativePath.push_back(identity);
    }

    ~NativeConversionVisit()
    {
        state.nativePath.pop_back();
    }

    ConversionState &state;
};

struct JavaScriptConversionVisit {
    JavaScriptConversionVisit(Runtime &runtime, ConversionState &state, const Value &value)
        : state(state)
    {
        Object object = value.asObject(runtime);
        for (const Object &ancestor : state.javascriptPath)
        {
            if (Object::strictEquals(runtime, ancestor, object))
            {
                throw JSError(runtime, "JavaScript value contains a collection cycle");
            }
        }
        state.javascriptPath.push_back(std::move(object));
    }

    ~JavaScriptConversionVisit()
    {
        state.javascriptPath.pop_back();
    }

    ConversionState &state;
};

static Value objcResultValue(Runtime &runtime, id value, ConversionState &state)
{
    ConversionGuard guard(runtime, state);
    if (!value)
    {
        return Value::null();
    }

    if ([value isKindOfClass:[NSString class]])
    {
        state.addBytes(runtime,
                       [(NSString *) value lengthOfBytesUsingEncoding:NSUTF8StringEncoding]);
        return objcJSIValue(runtime, value);
    }

    if ([value isKindOfClass:[NSNumber class]])
    {
        NSNumber   *number = (NSNumber *) value;
        const char *type   = number.objCType;
        if (strcmp(type, @encode(long long)) == 0 || strcmp(type, @encode(long)) == 0)
        {
            int64_t integer = number.longLongValue;
            if (integer > 9007199254740991LL || integer < -9007199254740991LL)
            {
                return Value(runtime, BigInt::fromInt64(runtime, integer));
            }
        }
        if (strcmp(type, @encode(unsigned long long)) == 0 ||
            strcmp(type, @encode(unsigned long)) == 0)
        {
            uint64_t integer = number.unsignedLongLongValue;
            if (integer > 9007199254740991ULL)
            {
                return Value(runtime, BigInt::fromUint64(runtime, integer));
            }
        }
        return objcJSIValue(runtime, value);
    }

    if ([value isKindOfClass:[NSData class]])
    {
        state.addBytes(runtime, [(NSData *) value length]);
        auto        data = std::make_shared<NativeDataBuffer>((NSData *) value);
        ArrayBuffer buffer(runtime, data);
        return Uint8Array(runtime, buffer, 0, buffer.size(runtime));
    }

    if ([value isKindOfClass:[NSArray class]])
    {
        NativeConversionVisit visit(runtime, state, value);
        NSArray              *array = (NSArray *) value;
        state.ensureEntries(runtime, array.count);
        Array result(runtime, array.count);
        for (NSUInteger index = 0; index < array.count; index++)
        {
            result.setValueAtIndex(runtime, index, objcResultValue(runtime, array[index], state));
        }
        return result;
    }

    if ([value isKindOfClass:[NSDictionary class]])
    {
        NativeConversionVisit visit(runtime, state, value);
        NSDictionary         *dictionary = (NSDictionary *) value;
        state.ensureEntries(runtime, dictionary.count);
        Object result(runtime);
        for (id key in dictionary)
        {
            if (![key isKindOfClass:[NSString class]])
            {
                continue;
            }
            state.addBytes(runtime,
                           [(NSString *) key lengthOfBytesUsingEncoding:NSUTF8StringEncoding]);
            result.setProperty(runtime, ((NSString *) key).UTF8String,
                               objcResultValue(runtime, dictionary[key], state));
        }
        return result;
    }

    return Object::createFromHostObject(runtime, std::make_shared<ObjCHandleHost>(value));
}

static Value objcResult(Runtime &runtime, id value)
{
    ConversionState state;
    return objcResultValue(runtime, value, state);
}

static id valueToObjCValue(Runtime &runtime, const Value &value, ConversionState &state)
{
    ConversionGuard guard(runtime, state);
    if (value.isNull() || value.isUndefined())
    {
        return [NSNull null];
    }

    if (value.isString())
    {
        NSString *string = jsiString(runtime, value);
        state.addString(runtime, [string lengthOfBytesUsingEncoding:NSUTF8StringEncoding]);
        return string ?: @"";
    }

    if (value.isBool())
    {
        return @(value.getBool());
    }

    if (value.isNumber())
    {
        return @(value.getNumber());
    }

    if (value.isBigInt())
    {
        BigInt bigint = value.asBigInt(runtime);
        if (runtime.bigintIsInt64(bigint))
        {
            return @((long long) runtime.truncate(bigint));
        }
        if (runtime.bigintIsUint64(bigint))
        {
            return @((unsigned long long) runtime.truncate(bigint));
        }
        throw JSError(runtime, "Native integer exceeds 64-bit range");
    }

    if (!value.isObject())
    {
        return [NSNull null];
    }

    Object object = value.asObject(runtime);
    if (std::shared_ptr<ObjCHandleHost> host = objcHost(runtime, value))
    {
        return host->value();
    }

    if (object.isHostObject<StructHost>(runtime))
    {
        return object.getHostObject<StructHost>(runtime)->value();
    }

    if (object.isHostObject<PointerHost>(runtime))
    {
        return [NSValue valueWithPointer:object.getHostObject<PointerHost>(runtime)->value()];
    }

    if (object.isArray(runtime))
    {
        JavaScriptConversionVisit visit(runtime, state, value);
        Array                     array = object.asArray(runtime);
        size_t                    count = array.size(runtime);
        state.ensureEntries(runtime, count);
        NSMutableArray *result = [NSMutableArray arrayWithCapacity:count];
        for (size_t index = 0; index < count; index++)
        {
            [result
                addObject:valueToObjCValue(runtime, array.getValueAtIndex(runtime, index), state)
                              ?: [NSNull null]];
        }
        return result;
    }

    JavaScriptConversionVisit visit(runtime, state, value);
    NSMutableDictionary      *result = [NSMutableDictionary dictionary];
    Array                     names  = object.getPropertyNames(runtime);
    size_t                    count  = names.size(runtime);
    state.ensureEntries(runtime, count);
    for (size_t index = 0; index < count; index++)
    {
        Value name = names.getValueAtIndex(runtime, index);
        if (!name.isString())
        {
            continue;
        }

        NSString *key = jsiString(runtime, name);
        if (key.length == 0)
        {
            continue;
        }

        state.addName(runtime, [key lengthOfBytesUsingEncoding:NSUTF8StringEncoding]);
        id item     = valueToObjCValue(runtime, object.getProperty(runtime, key.UTF8String), state);
        result[key] = item ?: [NSNull null];
    }
    return result;
}

static id valueToObjC(Runtime &runtime, const Value &value)
{
    ConversionState state;
    return valueToObjCValue(runtime, value, state);
}

static std::function<void(void)> objcGuarded(std::function<void(void)> operation)
{
    return [operation = std::move(operation)]() {
        @try
        {
            operation();
        }
        @catch (NSException *exception)
        {
            throw std::runtime_error(exception.reason.UTF8String ?: "Native operation failed");
        }
    };
}

static void executeMainSynchronously(std::function<void(void)> callback)
{
    NativeOperationSignpost signpost("main thread crossing");
    loader::native::executeMainSynchronously(objcGuarded(std::move(callback)));
}

static void fabricStart(id surface)
{
    using Function = void (*)(id, SEL);
    ((Function) objc_msgSend)(surface, @selector(start));
}

static void fabricStop(id surface)
{
    using Function = void (*)(id, SEL);
    ((Function) objc_msgSend)(surface, @selector(stop));
}

static UIView *fabricView(id surface)
{
    using Function = UIView *(*)(id, SEL);
    return ((Function) objc_msgSend)(surface, @selector(view));
}

static void fabricSetProps(id surface, NSDictionary *properties)
{
    using Function = void (*)(id, SEL, NSDictionary *);
    ((Function) objc_msgSend)(surface, @selector(setProps:), properties);
}

static void fabricSetMinimumSize(id surface, CGSize minimumSize, CGSize maximumSize)
{
    using Function = void (*)(id, SEL, CGSize, CGSize);
    ((Function) objc_msgSend)(surface, @selector(setMinimumSize:maximumSize:), minimumSize,
                              maximumSize);
}

static void fabricRequire(bool condition, const char *message)
{
    if (!condition)
    {
        throw std::runtime_error(message);
    }
}

struct IOSFabricSurface {
    __strong id      surface     = nil;
    __strong UIView *view        = nil;
    __strong UIView *surfaceView = nil;
};

static IOSFabricSurface fabricMountNative(id host, UIView *containerView, NSString *moduleName,
                                          NSDictionary *properties)
{
    NativeOperationSignpost signpost("fabric mount");
    fabricRequire(host != nil, "Fabric host is unavailable");
    fabricRequire(
        [host respondsToSelector:@selector(createSurfaceWithModuleName:mode:initialProperties:)],
        "Fabric host does not expose surface creation");
    id surface = [host createSurfaceWithModuleName:moduleName mode:0 initialProperties:properties];
    fabricRequire(surface != nil, "Fabric host could not create the requested surface");
    fabricRequire([surface respondsToSelector:@selector(start)] &&
                      [surface respondsToSelector:@selector(view)],
                  "Fabric surface does not expose start and view");

    fabricStart(surface);
    UIView *view = fabricView(surface);
    if (!view)
    {
        fabricStop(surface);
        throw std::runtime_error("Fabric surface did not create a view");
    }

    FabricContainer *surfaceContainer =
        [[FabricContainer alloc] initWithFrame:containerView.bounds];
    surfaceContainer.clipsToBounds = NO;
    surfaceContainer.autoresizingMask =
        UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    surfaceContainer.surfaceView = view;
    view.frame                   = surfaceContainer.bounds;
    view.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    [surfaceContainer addSubview:view];
    [containerView addSubview:surfaceContainer];
    [surfaceContainer setNeedsLayout];
    [surfaceContainer layoutIfNeeded];
    return {surface, surfaceContainer, view};
}

static void fabricUpdateNative(id surface, NSDictionary *properties)
{
    if ([surface respondsToSelector:@selector(setProps:)])
    {
        fabricSetProps(surface, properties);
    }
}

static void fabricSetSizeNative(id surface, CGSize minimumSize, CGSize maximumSize)
{
    if ([surface respondsToSelector:@selector(setMinimumSize:maximumSize:)])
    {
        fabricSetMinimumSize(surface, minimumSize, maximumSize);
    }
}

static void fabricSetFrameNative(UIView *view, UIView *surfaceView, CGRect frame)
{
    view.autoresizingMask = UIViewAutoresizingNone;
    if ([view respondsToSelector:@selector(setFabricFrame:)])
    {
        [(FabricContainer *) view setFabricFrame:frame];
    }
    else
    {
        view.frame = frame;
    }
    [view setNeedsLayout];
    [view layoutIfNeeded];
    if (surfaceView)
    {
        surfaceView.frame = view.bounds;
        surfaceView.autoresizingMask =
            UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    }
}

static void fabricUnmountNative(id surface, UIView *view)
{
    [view removeFromSuperview];
    if ([surface respondsToSelector:@selector(stop)])
    {
        fabricStop(surface);
    }
}

class IOSFabricView final : public loader::native::FabricView
{
public:
    explicit IOSFabricView(UIView *view) : view_(view) {}

    UIView *view() const
    {
        return view_;
    }

private:
    __strong UIView *view_;
};

static NSDictionary *fabricDictionary(const nlohmann::json &properties)
{
    id object = unbound::ios::objectFromJSON(properties);
    return [object isKindOfClass:[NSDictionary class]] ? object : @{};
}

static loader::native::NativeFrame nativeFrame(CGRect frame)
{
    return {frame.origin.x, frame.origin.y, frame.size.width, frame.size.height};
}

static CGSize cgSize(const loader::native::NativeSize &size)
{
    return CGSizeMake(size.width, size.height);
}

class IOSFabricAdapter final : public loader::native::FabricAdapter
{
public:
    std::shared_ptr<loader::native::FabricView> view(Runtime &runtime, const Value &handle) override
    {
        id object = objcValue(runtime, handle);
        if (![object isKindOfClass:[UIView class]])
        {
            throw JSError(runtime, "Fabric expects a UIView");
        }
        return std::make_shared<IOSFabricView>((UIView *) object);
    }

    std::string mount(const loader::native::FabricView &container, const std::string &moduleName,
                      const nlohmann::json &properties) override
    {
        IOSFabricSurface mounted;
        guarded([&]() {
            NSString *name = [NSString stringWithUTF8String:moduleName.c_str()] ?: @"";
            mounted = fabricMountNative(gFabricHostInstance,
                                        static_cast<const IOSFabricView &>(container).view(), name,
                                        fabricDictionary(properties));
        });
        std::lock_guard<std::mutex> lock(mutex_);
        std::string                 id = "surface-" + std::to_string(next_++);
        surfaces_[id]                  = mounted;
        return id;
    }

    void update(const std::string &surface, const nlohmann::json &properties) override
    {
        IOSFabricSurface mounted    = find(surface);
        NSDictionary    *dictionary = fabricDictionary(properties);
        guarded([&]() {
            fabricUpdateNative(mounted.surface, dictionary);
        });
    }

    void setSize(const std::string &surface, const loader::native::NativeSize &minimum,
                 const loader::native::NativeSize &maximum) override
    {
        IOSFabricSurface mounted = find(surface);
        guarded([&]() {
            fabricSetSizeNative(mounted.surface, cgSize(minimum), cgSize(maximum));
        });
    }

    void setFrame(const std::string &surface, const loader::native::NativeFrame &frame) override
    {
        IOSFabricSurface mounted = find(surface);
        guarded([&]() {
            fabricSetFrameNative(mounted.view, mounted.surfaceView,
                                 CGRectMake(frame.x, frame.y, frame.width, frame.height));
        });
    }

    loader::native::NativeFrame measure(const loader::native::FabricView &view) override
    {
        return nativeFrame(static_cast<const IOSFabricView &>(view).view().frame);
    }

    loader::native::NativeFrame measureSurface(const std::string &surface) override
    {
        return nativeFrame(find(surface).view.frame);
    }

    void unmount(const std::string &surface) override
    {
        IOSFabricSurface mounted;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            auto                        found = surfaces_.find(surface);
            if (found == surfaces_.end())
            {
                return;
            }
            mounted = found->second;
            surfaces_.erase(found);
        }
        guarded([&]() {
            fabricUnmountNative(mounted.surface, mounted.view);
        });
    }

private:
    static void guarded(std::function<void(void)> operation)
    {
        objcGuarded(std::move(operation))();
    }

    IOSFabricSurface find(const std::string &surface)
    {
        std::lock_guard<std::mutex> lock(mutex_);
        auto                        found = surfaces_.find(surface);
        if (found == surfaces_.end())
        {
            throw std::runtime_error("The Fabric surface is no longer mounted");
        }
        return found->second;
    }

    std::mutex                                        mutex_;
    std::unordered_map<std::string, IOSFabricSurface> surfaces_;
    uint64_t                                          next_ = 1;
};

static id valueToData(Runtime &runtime, const Value &value)
{
    if (!value.isObject())
    {
        return nil;
    }

    Object object = value.asObject(runtime);
    if (object.isArrayBuffer(runtime))
    {
        ArrayBuffer buffer = object.getArrayBuffer(runtime);
        return [NSData dataWithBytes:buffer.data(runtime) length:buffer.size(runtime)];
    }

    if (object.isTypedArray(runtime))
    {
        TypedArray  array  = object.getTypedArray(runtime);
        ArrayBuffer buffer = array.buffer(runtime);
        return [NSData dataWithBytes:buffer.data(runtime) + array.byteOffset(runtime)
                              length:array.byteLength(runtime)];
    }

    return nil;
}

static Value structResult(Runtime &runtime, NSString *name, NSValue *value)
{
    return Object::createFromHostObject(runtime, std::make_shared<StructHost>(name, value));
}

static Value structValue(Runtime &runtime, NSString *name, const Value &fields)
{
    const loader::native::StructLayout *layout =
        loader::native::structLayout(std::string(name.UTF8String ?: ""));
    if (!layout)
    {
        throw JSError(runtime, "Unsupported native struct");
    }
    std::vector<uint8_t> bytes;
    try
    {
        bytes = loader::native::structFromJS(runtime, *layout, fields);
    }
    catch (const std::invalid_argument &error)
    {
        throw JSError(runtime, error.what());
    }
    std::string encoding(layout->encoding);
    return structResult(runtime, name,
                        [NSValue valueWithBytes:bytes.data() objCType:encoding.c_str()]);
}

static Value returnValue(Runtime &runtime, NSInvocation *invocation, NSMethodSignature *signature)
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

    loader::ffi::Type    type = loader::ffi::resolveType(name);
    std::vector<uint8_t> bytes(std::max<size_t>(length, loader::ffi::valueStorageSize(type)));
    [invocation getReturnValue:bytes.data()];
    return loader::ffi::readValue(runtime, type, bytes.data());
}

static void validateNativeScalarArgument(id value, const std::string &type)
{
    if (![value isKindOfClass:[NSNumber class]])
    {
        throw std::runtime_error("Native scalar argument must be a number");
    }
    NSNumber *number = (NSNumber *) value;
    if (type == "bool")
    {
        double raw = number.doubleValue;
        if (raw == 0 || raw == 1)
            return;
        throw std::runtime_error("Native boolean argument is invalid");
    }
    const char *numberType = number.objCType;
    bool        signedInteger =
        strcmp(numberType, @encode(long long)) == 0 || strcmp(numberType, @encode(long)) == 0;
    bool unsignedInteger = strcmp(numberType, @encode(unsigned long long)) == 0 ||
                           strcmp(numberType, @encode(unsigned long)) == 0;
    if (type == "i64")
    {
        if (signedInteger || (unsignedInteger && number.unsignedLongLongValue <= INT64_MAX))
            return;
    }
    if (type == "u64")
    {
        if (unsignedInteger || (signedInteger && number.longLongValue >= 0))
            return;
    }
    if (!validNativeNumericValue(number.doubleValue, type))
    {
        throw std::runtime_error("Native scalar argument is out of range");
    }
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
                                  std::vector<std::vector<uint8_t>> &storage)
{
    const char *type       = [signature getArgumentTypeAtIndex:index];
    char        code       = normalizedType(type);
    std::string scalarType = nativeFFITypeName(type);
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

static NSInvocation *prepareInvocation(id target, SEL selector, NSArray *arguments)
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
        setInvocationArgument(invocation, signature, arguments[index], index + 2, retained,
                              storage);
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

static Value invokeObject(Runtime &runtime, id target, SEL selector, NSArray *arguments)
{
    NSInvocation *invocation = prepareInvocation(target, selector, arguments);
    [invocation invoke];
    return returnValue(runtime, invocation, invocation.methodSignature);
}

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

static Value invokeSuperObject(Runtime &runtime, id target, Class currentClass, SEL selector,
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
    frame->invoke((void *) objc_msgSendSuper);
    return loader::ffi::readValue(runtime, frame->interface().result, frame->result());
}

static Value invokeWithThreadPolicy(Runtime &runtime, id target, SEL selector, NSArray *arguments,
                                    const Value *options)
{
    std::string policy = "current";
    if (options && options->isObject())
    {
        Value thread = options->asObject(runtime).getProperty(runtime, "thread");
        if (thread.isString())
        {
            policy = jsiString(runtime, thread).UTF8String;
        }
    }
    if (policy == "current" || ([NSThread isMainThread] && policy == "main"))
    {
        return invokeObject(runtime, target, selector, arguments);
    }
    if (policy != "main")
    {
        throw JSError(runtime, "Unsupported native thread policy");
    }
    if (loader::native::mainThreadIsWaitingForRuntime())
    {
        throwWrongThread(
            runtime, "Objective-C invocation cannot synchronously cross to a waiting main thread");
    }

    NSInvocation *invocation     = prepareInvocation(target, selector, arguments);
    __strong id   retainedResult = nil;
    NSException  *failure        = nil;
    executeMainSynchronously([&]() {
        @try
        {
            [invocation invoke];
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
    Value result = returnValue(runtime, invocation, invocation.methodSignature);
    (void) retainedResult;
    return result;
}

static Value executeMainAsynchronously(Runtime &runtime, std::function<void(void)> operation,
                                       std::function<Value(Runtime &)> result)
{
    return loader::native::executeMainAsynchronously(runtime, objcGuarded(std::move(operation)),
                                                     std::move(result));
}

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

static NSInteger batchResultIndex(Runtime &runtime, const Value &value, size_t stepIndex)
{
    if (!value.isObject())
    {
        return -1;
    }
    Object object    = value.asObject(runtime);
    Value  reference = object.getProperty(runtime, "$nativeBatchResult");
    if (reference.isUndefined())
    {
        return -1;
    }
    if (!reference.isNumber())
    {
        throw JSError(runtime, "Native batch result index must be an integer");
    }
    double index = reference.getNumber();
    if (!(index >= 0 && index < stepIndex) ||
        static_cast<double>(static_cast<size_t>(index)) != index)
    {
        throw JSError(runtime, "Native batch can only reference earlier results");
    }
    return static_cast<NSInteger>(index);
}

static void validateBatchArgument(id value, const char *encoding)
{
    std::string type = nativeFFITypeName(encoding);
    if (type.empty() || type == "void")
    {
        throw std::runtime_error("Native batch method argument type is unsupported");
    }
    if (type == "object")
    {
        if ([value isKindOfClass:[NSValue class]] &&
            strncmp([(NSValue *) value objCType], "^", 1) == 0)
        {
            throw std::runtime_error("Native batch object argument cannot be a pointer");
        }
        return;
    }
    if (type == "class")
    {
        if (value == [NSNull null] || object_isClass(value))
            return;
        throw std::runtime_error("Native batch class argument is invalid");
    }
    if (type == "selector")
    {
        if (value == [NSNull null] || [value isKindOfClass:[NSString class]])
            return;
        throw std::runtime_error("Native batch selector argument is invalid");
    }
    if (type == "pointer")
    {
        if (value == [NSNull null] ||
            ([value isKindOfClass:[NSValue class]] &&
             strncmp([(NSValue *) value objCType], "^", 1) == 0) ||
            (normalizedType(encoding) == '*' && [value isKindOfClass:[NSString class]]))
            return;
        throw std::runtime_error("Native batch pointer argument is invalid");
    }
    if (type.starts_with("struct:"))
    {
        if ([value isKindOfClass:[NSValue class]] &&
            nativeFFITypeName([(NSValue *) value objCType]) == type)
            return;
        throw std::runtime_error("Native batch struct argument has the wrong layout");
    }
    validateNativeScalarArgument(value, type);
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

static Value invokeBatch(Runtime &runtime, const Value *args, size_t count)
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
                [invocation invoke];
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

static Value snapshotUI(Runtime &runtime, const Value *args, size_t count)
{
    id root = count ? objcValue(runtime, args[0]) : nil;
    if (![root isKindOfClass:[UIView class]])
    {
        throw JSError(runtime, "objc.snapshot expects a UIView handle");
    }

    Value                            noOptions = Value::undefined();
    loader::native::TraversalOptions options   = loader::native::parseTraversalOptions(
        runtime, count > 1 ? args[1] : noOptions, loader::native::TraversalProfile::Snapshot);
    NSUInteger maxDepth = options.maxDepth;
    NSUInteger maxNodes = options.maxNodes;

    NSMutableArray<NSDictionary *> *captured = [NSMutableArray arrayWithCapacity:maxNodes];
    return executeMainAsynchronously(
        runtime,
        [root, captured, maxDepth, maxNodes]() {
            NSMutableArray<NSDictionary *> *queue = [NSMutableArray arrayWithCapacity:maxNodes];
            [queue addObject:@{@"view" : root, @"parent" : @(-1), @"depth" : @(0)}];
            for (NSUInteger index = 0; index < queue.count && captured.count < maxNodes; index++)
            {
                NSDictionary *queued       = queue[index];
                UIView       *view         = queued[@"view"];
                NSUInteger    depth        = [queued[@"depth"] unsignedIntegerValue];
                NSString     *text         = nil;
                SEL           textSelector = @selector(text);
                if ([view respondsToSelector:textSelector])
                {
                    NSMethodSignature *signature = [view methodSignatureForSelector:textSelector];
                    if (signature && normalizedType(signature.methodReturnType) == '@')
                    {
                        id value = ((id (*)(id, SEL)) objc_msgSend)(view, textSelector);
                        if ([value isKindOfClass:[NSString class]])
                            text = value;
                    }
                }
                [captured addObject:@{
                    @"view" : view,
                    @"parent" : queued[@"parent"],
                    @"depth" : queued[@"depth"],
                    @"className" : NSStringFromClass([view class]),
                    @"frame" : [NSValue valueWithCGRect:view.frame],
                    @"text" : text ?: [NSNull null],
                    @"visible" : @(!view.hidden && view.alpha > 0 && view.window != nil),
                }];
                if (depth >= maxDepth)
                    continue;
                NSNumber *parent = @(captured.count - 1);
                for (UIView *child in view.subviews)
                {
                    if (queue.count >= maxNodes)
                        break;
                    [queue addObject:@{
                        @"view" : child,
                        @"parent" : parent,
                        @"depth" : @(depth + 1)
                    }];
                }
            }
        },
        [captured](Runtime &completionRuntime) -> Value {
            Array result(completionRuntime, captured.count);
            for (NSUInteger index = 0; index < captured.count; index++)
            {
                NSDictionary *node  = captured[index];
                CGRect        frame = [node[@"frame"] CGRectValue];
                Object        item(completionRuntime);
                Object        bounds(completionRuntime);
                bounds.setProperty(completionRuntime, "x", Value((double) frame.origin.x));
                bounds.setProperty(completionRuntime, "y", Value((double) frame.origin.y));
                bounds.setProperty(completionRuntime, "width", Value((double) frame.size.width));
                bounds.setProperty(completionRuntime, "height", Value((double) frame.size.height));
                item.setProperty(completionRuntime, "view",
                                 objcHandleResult(completionRuntime, node[@"view"]));
                item.setProperty(completionRuntime, "parent", Value([node[@"parent"] doubleValue]));
                item.setProperty(completionRuntime, "depth", Value([node[@"depth"] doubleValue]));
                item.setProperty(completionRuntime, "className",
                                 objcJSIValue(completionRuntime, node[@"className"]));
                item.setProperty(completionRuntime, "frame", std::move(bounds));
                item.setProperty(completionRuntime, "text",
                                 node[@"text"] == [NSNull null]
                                     ? Value::null()
                                     : objcJSIValue(completionRuntime, node[@"text"]));
                item.setProperty(completionRuntime, "visible", Value([node[@"visible"] boolValue]));
                result.setValueAtIndex(completionRuntime, index, std::move(item));
            }
            return result;
        });
}

static Value findUIViews(Runtime &runtime, const Value *args, size_t count)
{
    id root = count ? objcValue(runtime, args[0]) : nil;
    if (![root isKindOfClass:[UIView class]] || count < 2 || !args[1].isString())
    {
        throw JSError(runtime, "objc.findViews expects a UIView handle and class name");
    }
    NSString *className = jsiString(runtime, args[1]);
    if (className.length == 0 || className.length > 128)
    {
        throw JSError(runtime, "Native view class name must contain 1 to 128 characters");
    }

    Value                            noOptions = Value::undefined();
    loader::native::TraversalOptions options   = loader::native::parseTraversalOptions(
        runtime, count > 2 ? args[2] : noOptions, loader::native::TraversalProfile::Search);
    NSUInteger maxDepth        = options.maxDepth;
    NSUInteger maxVisited      = options.maxNodes;
    NSUInteger maxResults      = options.maxResults;
    bool       attachedOnly    = options.attachedOnly;
    bool       stopAtMatch     = options.stopAtMatch;
    bool       searchAncestors = options.direction == loader::native::TraversalDirection::Ancestors;

    NSMutableArray<UIView *> *found = [NSMutableArray arrayWithCapacity:maxResults];
    return executeMainAsynchronously(
        runtime,
        [root, className, found, maxDepth, maxVisited, maxResults, attachedOnly, stopAtMatch,
         searchAncestors]() {
            Class expectedClass = NSClassFromString(className);
            if (searchAncestors)
            {
                UIView *view = root;
                for (NSUInteger depth = 0; view && depth <= maxDepth && depth < maxVisited;
                     view             = view.superview, depth++)
                {
                    bool matches = expectedClass
                                       ? [view isKindOfClass:expectedClass]
                                       : [NSStringFromClass([view class]) containsString:className];
                    if (matches && (!attachedOnly || view.window != nil))
                    {
                        [found addObject:view];
                        if (found.count >= maxResults || stopAtMatch)
                            break;
                    }
                }
                return;
            }
            NSMutableArray<NSDictionary *> *queue = [NSMutableArray arrayWithCapacity:maxVisited];
            [queue addObject:@{@"view" : root, @"depth" : @(0)}];
            for (NSUInteger index = 0; index < queue.count && index < maxVisited; index++)
            {
                NSDictionary *queued = queue[index];
                UIView       *view   = queued[@"view"];
                NSUInteger    depth  = [queued[@"depth"] unsignedIntegerValue];
                bool matches = expectedClass
                                   ? [view isKindOfClass:expectedClass]
                                   : [NSStringFromClass([view class]) containsString:className];
                if (matches && (!attachedOnly || view.window != nil))
                {
                    [found addObject:view];
                    if (found.count >= maxResults)
                        break;
                }
                if (depth >= maxDepth || (matches && stopAtMatch))
                    continue;
                for (UIView *child in view.subviews)
                {
                    if (queue.count >= maxVisited)
                        break;
                    [queue addObject:@{@"view" : child, @"depth" : @(depth + 1)}];
                }
            }
        },
        [found](Runtime &completionRuntime) -> Value {
            Array result(completionRuntime, found.count);
            for (NSUInteger index = 0; index < found.count; index++)
            {
                result.setValueAtIndex(completionRuntime, index,
                                       objcHandleResult(completionRuntime, found[index]));
            }
            return result;
        });
}

struct NativeRetainedObject {
    __strong id value = nil;
};

static Value invokeAsync(Runtime &runtime, id target, SEL selector, NSArray *arguments)
{
    NSInvocation *invocation     = prepareInvocation(target, selector, arguments);
    auto          retainedResult = std::make_shared<NativeRetainedObject>();
    return executeMainAsynchronously(
        runtime,
        [invocation, retainedResult]() {
            [invocation invoke];
            char code = normalizedType(invocation.methodSignature.methodReturnType);
            if (code == '@' || code == '#')
            {
                __unsafe_unretained id object = nil;
                [invocation getReturnValue:&object];
                retainedResult->value = object;
            }
        },
        [invocation, retainedResult](Runtime &completionRuntime) {
            return returnValue(completionRuntime, invocation, invocation.methodSignature);
        });
}

struct AsyncSuperCall {
    struct objc_super                       superInfo{};
    std::unique_ptr<loader::ffi::CallFrame> frame;
    std::vector<id>                         retainedArguments;
    __strong id                             retainedTarget = nil;
    __strong id                             retainedResult = nil;
};

static Value invokeSuperAsync(Runtime &runtime, id target, Class currentClass, SEL selector,
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

    return executeMainAsynchronously(
        runtime,
        [call]() {
            call->frame->invoke((void *) objc_msgSendSuper);
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

static Value invokeSuperWithThreadPolicy(Runtime &runtime, id target, Class currentClass,
                                         SEL selector, NSArray *arguments, const Value *options)
{
    std::string policy = "current";
    if (options && options->isObject())
    {
        Value thread = options->asObject(runtime).getProperty(runtime, "thread");
        if (thread.isString())
        {
            policy = jsiString(runtime, thread).UTF8String;
        }
    }
    if (policy == "current" || ([NSThread isMainThread] && policy == "main"))
    {
        return invokeSuperObject(runtime, target, currentClass, selector, arguments);
    }
    if (policy != "main")
    {
        throw JSError(runtime, "Unsupported native thread policy");
    }

    throw JSError(runtime, "Native super invocation cannot synchronously cross to the main thread");
}

static NSArray *argumentArray(Runtime &runtime, const Value *args, size_t count, size_t start)
{
    NSMutableArray *arguments = [NSMutableArray arrayWithCapacity:count - start];
    for (size_t index = start; index < count; index++)
    {
        const Value &value = args[index];
        if (value.isObject() && value.asObject(runtime).isHostObject<ObjCHandleHost>(runtime))
        {
            [arguments addObject:objcValue(runtime, value) ?: [NSNull null]];
        }
        else
        {
            [arguments addObject:valueToObjC(runtime, value) ?: [NSNull null]];
        }
    }
    return arguments;
}

static Class classFromValue(Runtime &runtime, const Value &value)
{
    id object = objcValue(runtime, value);
    if (object && object_isClass(object))
    {
        return object;
    }

    if (value.isString())
    {
        NSString *name = jsiString(runtime, value);
        return NSClassFromString(name);
    }

    return Nil;
}

static void removeHook(const std::shared_ptr<HookState> &state, bool preserveAfter = false,
                       bool restoreImplementation = true)
{
    if (!state)
    {
        return;
    }
    state->afterOncePending.store(preserveAfter && state->hasAfter);
    if (!state->active.exchange(false))
    {
        return;
    }
    loader::native::nativeHookBudget().release();
    clearHookReturnCache(state);

    std::shared_ptr<HookDispatcher> dispatcher = state->dispatcher.lock();
    if (!dispatcher)
    {
        return;
    }

    {
        std::lock_guard<std::mutex> lock(gHookMutex);
        auto iterator = std::find(dispatcher->hooks.begin(), dispatcher->hooks.end(), state);
        if (iterator != dispatcher->hooks.end())
        {
            dispatcher->hooks.erase(iterator);
        }

        if (restoreImplementation && dispatcher->hooks.empty() && !dispatcher->retired.load())
        {
            Method method  = class_getInstanceMethod(dispatcher->cls, dispatcher->selector);
            IMP    current = method ? method_getImplementation(method) : nullptr;
            if (!method || current == (IMP) dispatcher->code || current == dispatcher->original)
            {
                if (method && current == (IMP) dispatcher->code)
                {
                    MSHookMessageEx(dispatcher->cls, dispatcher->selector, dispatcher->original,
                                    nullptr);
                }
                dispatcher->retired.store(true);
            }
        }
    }
}

static void invalidateRuntimeHooks(uint64_t generation)
{
    std::vector<std::shared_ptr<HookState>> stale;
    {
        std::lock_guard<std::mutex> lock(gHookMutex);
        for (const auto &entry : gDispatchers)
        {
            for (const auto &state : entry.second->hooks)
            {
                if (state->runtimeGeneration < generation)
                    stale.push_back(state);
            }
        }
    }
    for (const auto &state : stale)
    {
        removeHook(state, false, false);
    }
}

Value HookTokenHost::get(Runtime &runtime, const PropNameID &name)
{
    std::string property = name.utf8(runtime);
    if (property == "remove")
    {
        std::shared_ptr<HookState> state = state_;
        return Function::createFromHostFunction(
            runtime, PropNameID::forUtf8(runtime, "remove"), 0,
            [state](Runtime &, const Value &, const Value *, size_t) -> Value {
                removeHook(state);
                return Value::undefined();
            });
    }
    if (property == "active")
    {
        return Value(state_ && state_->active.load());
    }
    if (property == "setReturnValue")
    {
        std::shared_ptr<HookState> state = state_;
        return Function::createFromHostFunction(
            runtime, PropNameID::forUtf8(runtime, "setReturnValue"), 3,
            [state](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                setHookReturnCache(rt, state, args, count);
                return Value::undefined();
            });
    }
    if (property == "removeReturnValue")
    {
        std::shared_ptr<HookState> state = state_;
        return Function::createFromHostFunction(
            runtime, PropNameID::forUtf8(runtime, "removeReturnValue"), 2,
            [state](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                removeHookReturnCache(rt, state, args, count);
                return Value::undefined();
            });
    }
    if (property == "clearReturnValues")
    {
        std::shared_ptr<HookState> state = state_;
        return Function::createFromHostFunction(
            runtime, PropNameID::forUtf8(runtime, "clearReturnValues"), 0,
            [state](Runtime &, const Value &, const Value *, size_t) -> Value {
                clearHookReturnCache(state);
                return Value::undefined();
            });
    }
    return Value::undefined();
}

Value StructHost::get(Runtime &runtime, const PropNameID &name)
{
    std::string property = name.utf8(runtime);
    if (property == "name")
    {
        return String::createFromUtf8(runtime, name_.UTF8String ?: "");
    }
    if (property == "value")
    {
        return structFields(runtime, name_, value_);
    }
    return Value::undefined();
}

static Value structFields(Runtime &runtime, NSString *name, NSValue *value)
{
    const loader::native::StructLayout *layout =
        value ? loader::native::structLayoutForTypeName(std::string(name.UTF8String ?: ""))
              : nullptr;
    if (!layout)
    {
        return Value::undefined();
    }
    std::vector<uint8_t> bytes(layout->size);
    [value getValue:bytes.data() size:bytes.size()];
    return loader::native::structToJS(runtime, *layout, bytes.data());
}

struct HookInvocation {
    std::shared_ptr<HookDispatcher>              dispatcher;
    std::vector<std::vector<uint8_t>>            arguments;
    std::vector<std::shared_ptr<ObjCHandleHost>> retainedObjects;
    std::vector<std::string>                     retainedStrings;
    std::vector<uint8_t>                         originalResult;
    void                                       **nativeArguments = nullptr;
    void                                        *returnValue     = nullptr;
    std::thread::id                              hookThread;
    std::mutex                                   lifecycleMutex;
    std::atomic_bool                             active{true};
    std::atomic_bool                             originalCalled{false};
    std::atomic_bool                             deferredOriginalRequested{false};
};

static std::shared_ptr<HookInvocation>
hookInvocation(const std::shared_ptr<HookDispatcher> &dispatcher, void **arguments,
               void *returnValue)
{
    auto invocation             = std::make_shared<HookInvocation>();
    invocation->dispatcher      = dispatcher;
    invocation->nativeArguments = arguments;
    invocation->returnValue     = returnValue;
    invocation->hookThread      = std::this_thread::get_id();
    invocation->arguments.reserve(dispatcher->signature->arguments.size());
    invocation->retainedObjects.reserve(dispatcher->signature->arguments.size());
    invocation->retainedStrings.reserve(dispatcher->signature->arguments.size());
    for (const loader::ffi::Type &spec : dispatcher->signature->arguments)
    {
        size_t size = loader::ffi::valueStorageSize(spec);
        invocation->arguments.emplace_back(size);
        if (loader::ffi::typeSize(spec))
        {
            memcpy(invocation->arguments.back().data(), arguments[invocation->arguments.size() - 1],
                   loader::ffi::typeSize(spec));
        }
        if (spec.name == "object" || spec.name == "class")
        {
            void *rawObject = nullptr;
            memcpy(&rawObject, invocation->arguments.back().data(), sizeof(rawObject));
            id object = (__bridge id) rawObject;
            if (object)
            {
                invocation->retainedObjects.emplace_back(std::make_shared<ObjCHandleHost>(object));
            }
        }
        else if (spec.name == "cstring")
        {
            const char *string = nullptr;
            memcpy(&string, invocation->arguments.back().data(), sizeof(string));
            if (string)
            {
                invocation->retainedStrings.emplace_back(string);
                string = invocation->retainedStrings.back().c_str();
                memcpy(invocation->arguments.back().data(), &string, sizeof(string));
            }
        }
    }
    return invocation;
}

static void copyHookResult(const std::shared_ptr<HookInvocation> &invocation, void *returnValue)
{
    if (invocation->dispatcher->signature->result.name == "void" || !returnValue)
    {
        invocation->originalResult.clear();
        return;
    }

    size_t size = loader::ffi::valueStorageSize(invocation->dispatcher->signature->result);
    invocation->originalResult.resize(size);
    memcpy(invocation->originalResult.data(), returnValue,
           loader::ffi::typeSize(invocation->dispatcher->signature->result));
}

static bool invokeDeferredHookOriginal(const std::shared_ptr<HookInvocation> &invocation)
{
    if (!invocation->deferredOriginalRequested.exchange(false) || invocation->originalCalled.load())
    {
        return false;
    }

    invokeHookOriginal(invocation->dispatcher, invocation->nativeArguments,
                       invocation->returnValue);
    copyHookResult(invocation, invocation->returnValue);
    invocation->originalCalled.store(true);
    return true;
}

static std::shared_ptr<std::vector<uint8_t>>
hookReturnBuffer(const std::shared_ptr<HookInvocation> &invocation)
{
    size_t size = loader::ffi::valueStorageSize(invocation->dispatcher->signature->result);
    return std::make_shared<std::vector<uint8_t>>(size);
}

static void copyHookReturnBuffer(const std::shared_ptr<HookInvocation>       &invocation,
                                 const std::shared_ptr<std::vector<uint8_t>> &buffer,
                                 void                                        *returnValue)
{
    if (invocation->dispatcher->signature->result.name == "void" || !returnValue)
    {
        return;
    }

    memcpy(returnValue, buffer->data(),
           loader::ffi::typeSize(invocation->dispatcher->signature->result));
}

static Value hookValue(Runtime &runtime, const loader::ffi::Type &type,
                       const std::vector<uint8_t> &bytes)
{
    if (type.name != "void" && bytes.size() < loader::ffi::typeSize(type))
    {
        throw JSError(runtime, "Native result buffer is too small");
    }
    return loader::ffi::readValue(runtime, type, bytes.data());
}

static Object hookContext(Runtime &runtime, const std::shared_ptr<HookInvocation> &invocation,
                          id object, SEL selector, bool allowOriginal)
{
    Object context(runtime);
    context.setProperty(
        runtime, "self",
        Object::createFromHostObject(runtime, std::make_shared<ObjCHandleHost>(object)));
    context.setProperty(runtime, "selector",
                        String::createFromUtf8(runtime, sel_getName(selector)));

    size_t explicitCount = invocation->dispatcher->signature->arguments.size() - 2;
    Array  values(runtime, explicitCount);
    for (size_t index = 0; index < explicitCount; index++)
    {
        values.setValueAtIndex(runtime, index,
                               hookValue(runtime,
                                         invocation->dispatcher->signature->arguments[index + 2],
                                         invocation->arguments[index + 2]));
    }
    context.setProperty(runtime, "args", std::move(values));

    auto original = invocation;
    context.setProperty(
        runtime, "replaceObjectArgument",
        Function::createFromHostFunction(
            runtime, PropNameID::forUtf8(runtime, "replaceObjectArgument"), 2,
            [original, allowOriginal](Runtime &rt, const Value &, const Value *args,
                                      size_t count) -> Value {
                std::lock_guard<std::mutex> lock(original->lifecycleMutex);
                if (!original->active.load())
                {
                    throw JSError(rt,
                                  "Native hook arguments are unavailable after the hook returns");
                }
                if (!allowOriginal)
                {
                    throw JSError(rt, "Native hook arguments can only be replaced synchronously");
                }
                if (std::this_thread::get_id() != original->hookThread)
                {
                    throw JSError(rt, "Native hook arguments cannot cross runtime threads");
                }
                if (count < 2 || !args[0].isNumber())
                {
                    throw JSError(rt,
                                  "Native hook replaceObjectArgument expects an index and object");
                }

                double requestedIndex = args[0].getNumber();
                size_t explicitCount  = original->dispatcher->signature->arguments.size() - 2;
                if (!(requestedIndex >= 0 && requestedIndex < explicitCount))
                {
                    throw JSError(rt, "Native hook argument index is out of range");
                }
                size_t explicitIndex = static_cast<size_t>(requestedIndex);
                if (static_cast<double>(explicitIndex) != requestedIndex)
                {
                    throw JSError(rt, "Native hook argument index must be an integer");
                }

                size_t                   argumentIndex = explicitIndex + 2;
                const loader::ffi::Type &spec =
                    original->dispatcher->signature->arguments[argumentIndex];
                if (spec.name != "object" && spec.name != "class")
                {
                    throw JSError(rt, "Native hook argument is not an Objective-C object");
                }

                id    object    = args[1].isNull() ? nil : objcValue(rt, args[1]);
                void *rawObject = (__bridge void *) object;
                if (object)
                {
                    original->retainedObjects.emplace_back(
                        std::make_shared<ObjCHandleHost>(object));
                }
                memcpy(original->arguments[argumentIndex].data(), &rawObject, sizeof(rawObject));
                memcpy(original->nativeArguments[argumentIndex], &rawObject, sizeof(rawObject));
                return Value::undefined();
            }));
    context.setProperty(
        runtime, "original",
        Function::createFromHostFunction(
            runtime, PropNameID::forUtf8(runtime, "original"), 0,
            [original, allowOriginal](Runtime &rt, const Value &, const Value *, size_t) -> Value {
                std::lock_guard<std::mutex> lock(original->lifecycleMutex);
                if (!original->active.load())
                {
                    throw JSError(rt,
                                  "Native hook original() is unavailable after the hook returns");
                }
                if (!allowOriginal)
                {
                    throw JSError(rt, "Native hook original() is only available synchronously");
                }
                if (!original->originalCalled.load())
                {
                    if (std::this_thread::get_id() != original->hookThread)
                    {
                        if (original->dispatcher->signature->result.name != "void")
                        {
                            throw JSError(rt,
                                          "Native hook original() cannot cross runtime threads");
                        }
                        original->deferredOriginalRequested.store(true);
                        return Value::undefined();
                    }

                    invokeHookOriginal(original->dispatcher, original->nativeArguments,
                                       original->returnValue);
                    copyHookResult(original, original->returnValue);
                    original->originalCalled.store(true);
                }
                return hookValue(rt, original->dispatcher->signature->result,
                                 original->originalResult);
            }));
    return context;
}

static bool executeRuntimeSynchronously(std::function<void(Runtime &)> callback)
{
    NativeOperationSignpost signpost("runtime callback");
    return loader::native::executeRuntimeSynchronously(std::move(callback));
}

static void executeRuntimeAsynchronously(std::function<void(Runtime &)> callback)
{
    loader::native::executeRuntimeAsynchronously(std::move(callback));
}

static void invokeHookOriginal(const std::shared_ptr<HookDispatcher> &dispatcher, void **arguments,
                               void *returnValue)
{
    loader::ffi::invoke(*dispatcher->signature->interface, (void *) dispatcher->original,
                        returnValue, arguments);
}

static bool setHookReturn(Runtime &runtime, const loader::ffi::Type &spec, const Value &value,
                          void *returnValue)
{
    if (spec.name == "void")
    {
        return true;
    }
    if (!returnValue)
    {
        return false;
    }

    std::vector<uint8_t>         bytes(loader::ffi::valueStorageSize(spec));
    loader::ffi::ArgumentStorage storage;
    loader::ffi::writeValue(runtime, value, spec, bytes.data(), storage);
    memcpy(returnValue, bytes.data(), loader::ffi::typeSize(spec));
    return true;
}

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

static void setHookReturnCache(Runtime &runtime, const std::shared_ptr<HookState> &state,
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

static void removeHookReturnCache(Runtime &runtime, const std::shared_ptr<HookState> &state,
                                  const Value *args, size_t count)
{
    NSArray                    *key = hookReturnCacheKey(runtime, state, args, count);
    std::lock_guard<std::mutex> lock(state->returnCacheMutex);
    releaseHookCacheEntry(state->returnCache, key);
}

static void clearHookReturnCache(const std::shared_ptr<HookState> &state)
{
    if (!state)
    {
        return;
    }
    std::lock_guard<std::mutex> lock(state->returnCacheMutex);
    loader::native::nativeCachedReturnBudget().release(state->returnCache.count);
    [state->returnCache removeAllObjects];
}

static std::shared_ptr<HookDispatcher> findHookDispatcher(id object, SEL selector,
                                                          void *closureData = nullptr)
{
    std::lock_guard<std::mutex> lock(gHookMutex);
    if (closureData)
    {
        auto closure = gClosureDispatchers.find(static_cast<HookDispatcher *>(closureData));
        if (closure == gClosureDispatchers.end())
        {
            return nullptr;
        }
        closure->second->activeCalls.fetch_add(1);
        return closure->second;
    }
    auto iterator = gDispatchers.find(hookKey(object_getClass(object), selector));
    if (iterator == gDispatchers.end())
    {
        Class cls = object_getClass(object);
        while (cls && iterator == gDispatchers.end())
        {
            iterator = gDispatchers.find(hookKey(cls, selector));
            cls      = class_getSuperclass(cls);
        }
    }
    if (iterator == gDispatchers.end())
    {
        return nullptr;
    }

    iterator->second->activeCalls.fetch_add(1);
    return iterator->second;
}

struct HookCallGuard {
    explicit HookCallGuard(std::shared_ptr<HookDispatcher> dispatcher)
        : dispatcher(std::move(dispatcher)), signpost("hook dispatch")
    {
    }

    ~HookCallGuard()
    {
        dispatcher->activeCalls.fetch_sub(1);
    }

    std::shared_ptr<HookDispatcher> dispatcher;
    NativeOperationSignpost         signpost;
};

static void logHookFailure(const std::exception &exception)
{
    [Logger error:LOG_CATEGORY_PLUGINS format:@"Native plugin hook failed: %s", exception.what()];
}

static void dispatchFFIHookBody(ffi_cif *, void *returnValue, void **arguments, void *userData)
{
    __unsafe_unretained id object = nil;
    memcpy(&object, arguments[0], sizeof(object));
    SEL  selector   = *reinterpret_cast<SEL *>(arguments[1]);
    auto dispatcher = findHookDispatcher(object, selector, userData);
    if (!dispatcher)
    {
        return;
    }

    HookCallGuard                           guard(dispatcher);
    std::vector<std::shared_ptr<HookState>> hooks;
    {
        std::lock_guard<std::mutex> lock(gHookMutex);
        for (const std::shared_ptr<HookState> &state : dispatcher->hooks)
        {
            if (state->active && state->runtimeGeneration == loader::native::runtimeGeneration() &&
                (!state->instanceTarget || state->instanceTarget == object))
            {
                hooks.push_back(state);
            }
        }
    }
    if (hooks.empty())
    {
        invokeHookOriginal(dispatcher, arguments, returnValue);
        return;
    }

    bool cacheOnly = true;
    for (const std::shared_ptr<HookState> &state : hooks)
    {
        if (state->active && !state->cacheOnly)
        {
            cacheOnly = false;
            break;
        }
    }
    if (cacheOnly)
    {
        bool                                    cachedReturn = false;
        std::vector<std::shared_ptr<HookState>> onceHooks;
        for (const std::shared_ptr<HookState> &state : hooks)
        {
            if (!state->active)
            {
                continue;
            }

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
                cachedReturn = true;
            }
            if (state->once)
            {
                onceHooks.push_back(state);
            }
        }

        if (!cachedReturn)
        {
            invokeHookOriginal(dispatcher, arguments, returnValue);
        }
        for (const std::shared_ptr<HookState> &state : onceHooks)
        {
            removeHook(state);
        }
        return;
    }

    auto invocation = hookInvocation(dispatcher, arguments, returnValue);

    bool                                    replacementApplied = false;
    bool                                    originalCalled     = false;
    std::vector<std::shared_ptr<HookState>> onceHooks;

    for (const std::shared_ptr<HookState> &state : hooks)
    {
        if (!state->active)
        {
            continue;
        }

        loader::AddonScope addonScope(state->addon);
        if (state->cacheOnly)
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
                replacementApplied = true;
            }
            if (state->once)
            {
                onceHooks.push_back(state);
            }
            continue;
        }

        if (state->hasBefore)
        {
            try
            {
                executeRuntimeSynchronously(
                    [invocation, object, selector, state](Runtime &runtime) {
                        auto callbacks = state->callbacks.lock();
                        if (!callbacks || !callbacks->before)
                            return;
                        Object context = hookContext(runtime, invocation, object, selector, true);
                        callbacks->before->call(runtime, context);
                    });
            }
            catch (const std::exception &exception)
            {
                logHookFailure(exception);
            }
            if (invokeDeferredHookOriginal(invocation))
                originalCalled = true;
        }

        if (invocation->originalCalled.load() && !originalCalled)
        {
            originalCalled = true;
        }

        if (state->hasReplace)
        {
            try
            {
                std::shared_ptr<std::vector<uint8_t>> replacementResult =
                    hookReturnBuffer(invocation);
                bool completed = executeRuntimeSynchronously(
                    [invocation, object, selector, state, replacementResult](Runtime &runtime) {
                        auto callbacks = state->callbacks.lock();
                        if (!callbacks || !callbacks->replace)
                        {
                            throw std::runtime_error("Native hook callback expired");
                        }
                        Object context = hookContext(runtime, invocation, object, selector, true);
                        Value  result  = callbacks->replace->call(runtime, context);
                        if (!setHookReturn(runtime, invocation->dispatcher->signature->result,
                                           result, replacementResult->data()))
                        {
                            throw JSError(runtime,
                                          "Native hook replacement returned an unsupported value");
                        }
                    });
                if (completed)
                {
                    replacementApplied = true;
                    copyHookReturnBuffer(invocation, replacementResult, returnValue);
                    copyHookResult(invocation, returnValue);
                }
            }
            catch (const std::exception &exception)
            {
                logHookFailure(exception);
            }
            if (invokeDeferredHookOriginal(invocation))
                originalCalled = true;
        }

        if (state->once)
        {
            onceHooks.push_back(state);
        }
    }

    if (!originalCalled && !replacementApplied)
    {
        invokeHookOriginal(dispatcher, arguments, returnValue);
        copyHookResult(invocation, returnValue);
    }

    for (const std::shared_ptr<HookState> &state : hooks)
    {
        if (!state->active || !state->hasAfter)
        {
            continue;
        }

        loader::AddonScope addonScope(state->addon);
        __strong id        retainedObject = object;
        executeRuntimeAsynchronously(
            [invocation, retainedObject, selector, state](Runtime &runtime) {
                bool pending = state->afterOncePending.exchange(false);
                if (!state->active.load() && !pending)
                {
                    return;
                }
                auto callbacks = state->callbacks.lock();
                if (!callbacks || !callbacks->after)
                    return;
                Object context = hookContext(runtime, invocation, retainedObject, selector, false);
                callbacks->after->call(runtime, context);
            });
    }

    {
        std::lock_guard<std::mutex> lock(invocation->lifecycleMutex);
        invocation->active.store(false);
    }

    for (const std::shared_ptr<HookState> &state : onceHooks)
    {
        removeHook(state, true);
    }
}

static void dispatchFFIHook(ffi_cif *cif, void *returnValue, void **arguments, void *userData)
{
    @autoreleasepool
    {
        dispatchFFIHookBody(cif, returnValue, arguments, userData);
    }
}

template <typename Result, typename... Arguments>
static Result dispatchTypedHook(id object, SEL selector, Arguments... values)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector, &values...};
        if constexpr (std::is_void_v<Result>)
        {
            dispatchFFIHookBody(nullptr, nullptr, arguments, nullptr);
        }
        else if constexpr (std::is_same_v<Result, id> || std::is_same_v<Result, Class>)
        {
            void *returnValue = nullptr;
            dispatchFFIHookBody(nullptr, &returnValue, arguments, nullptr);
            return (__bridge Result) returnValue;
        }
        else
        {
            Result returnValue{};
            dispatchFFIHookBody(nullptr, &returnValue, arguments, nullptr);
            return returnValue;
        }
    }
}

struct FallbackHook {
    std::string_view              result;
    std::vector<std::string_view> arguments;
    void                         *code;
};

template <typename Result, typename... Arguments>
static FallbackHook fallbackHook(std::string_view result, std::vector<std::string_view> arguments)
{
    return {result, std::move(arguments),
            reinterpret_cast<void *>(dispatchTypedHook<Result, Arguments...>)};
}

static const std::vector<FallbackHook> &fallbackHooks()
{
    static const std::vector<FallbackHook> hooks = {
        fallbackHook<id>("object", {}),
        fallbackHook<Class>("class", {}),
        fallbackHook<int8_t>("i8", {}),
        fallbackHook<int8_t, id, id>("i8", {"object", "object"}),
        fallbackHook<int8_t, id>("i8", {"object"}),
        fallbackHook<int8_t, Class>("i8", {"class"}),
        fallbackHook<int8_t, SEL>("i8", {"selector"}),
        fallbackHook<id, CGRect>("object", {"struct:CGRect"}),
        fallbackHook<id, id>("object", {"object"}),
        fallbackHook<void, id>("void", {"object"}),
        fallbackHook<void, NSUInteger>("void", {"u64"}),
        fallbackHook<void, int8_t>("void", {"i8"}),
        fallbackHook<void, id, id>("void", {"object", "object"}),
        fallbackHook<void, id, id, id>("void", {"object", "object", "object"}),
        fallbackHook<CGRect, id>("struct:CGRect", {"object"}),
        fallbackHook<double, id, id>("double", {"object", "object"}),
        fallbackHook<CGSize>("struct:CGSize", {}),
        fallbackHook<CGSize, CGSize>("struct:CGSize", {"struct:CGSize"}),
        fallbackHook<CGSize, CGSize, float, float>("struct:CGSize",
                                                   {"struct:CGSize", "float", "float"}),
        fallbackHook<CGSize, CGSize, double, double>("struct:CGSize",
                                                     {"struct:CGSize", "double", "double"}),
    };
    return hooks;
}

static std::string_view fallbackTypeName(const std::string &name)
{
    return name == "bool" ? std::string_view("i8") : std::string_view(name);
}

static bool matchesFallbackHook(const HookSignature &signature, const FallbackHook &hook)
{
    if (fallbackTypeName(signature.result.name) != hook.result ||
        signature.arguments.size() != hook.arguments.size() + 2)
    {
        return false;
    }
    for (size_t index = 0; index < hook.arguments.size(); index++)
    {
        if (fallbackTypeName(signature.arguments[index + 2].name) != hook.arguments[index])
        {
            return false;
        }
    }
    return true;
}

static void *fallbackHookCode(const HookSignature &signature)
{
    for (const FallbackHook &hook : fallbackHooks())
    {
        if (matchesFallbackHook(signature, hook))
        {
            return hook.code;
        }
    }
    return nullptr;
}

static void dispatchVoidHook(id object, SEL selector)
{
    @autoreleasepool
    {
        auto dispatcher = findHookDispatcher(object, selector);
        if (!dispatcher)
        {
            return;
        }

        HookCallGuard guard(dispatcher);
        void         *arguments[] = {&object, &selector};
        auto          invocation  = hookInvocation(dispatcher, arguments, nullptr);

        std::vector<std::shared_ptr<HookState>> hooks;
        {
            std::lock_guard<std::mutex> lock(gHookMutex);
            for (const std::shared_ptr<HookState> &state : dispatcher->hooks)
            {
                if (state->active &&
                    state->runtimeGeneration == loader::native::runtimeGeneration() &&
                    (!state->instanceTarget || state->instanceTarget == object))
                {
                    hooks.push_back(state);
                }
            }
        }
        if (hooks.empty())
        {
            invokeHookOriginal(dispatcher, arguments, nullptr);
            return;
        }

        bool                                    replacementApplied = false;
        bool                                    originalCalled     = false;
        std::vector<std::shared_ptr<HookState>> onceHooks;

        for (const std::shared_ptr<HookState> &state : hooks)
        {
            if (!state->active)
            {
                continue;
            }

            loader::AddonScope addonScope(state->addon);
            if (state->hasBefore)
            {
                try
                {
                    executeRuntimeSynchronously([invocation, object, selector,
                                                 state](Runtime &runtime) {
                        auto callbacks = state->callbacks.lock();
                        if (!callbacks || !callbacks->before)
                            return;
                        Object context = hookContext(runtime, invocation, object, selector, true);
                        callbacks->before->call(runtime, context);
                    });
                }
                catch (const std::exception &exception)
                {
                    logHookFailure(exception);
                }
                if (invokeDeferredHookOriginal(invocation))
                    originalCalled = true;
            }

            if (invocation->originalCalled.load() && !originalCalled)
            {
                originalCalled = true;
            }

            if (state->hasReplace)
            {
                try
                {
                    std::shared_ptr<std::vector<uint8_t>> replacementResult =
                        hookReturnBuffer(invocation);
                    bool completed = executeRuntimeSynchronously([invocation, object, selector,
                                                                  state, replacementResult](
                                                                     Runtime &runtime) {
                        auto callbacks = state->callbacks.lock();
                        if (!callbacks || !callbacks->replace)
                        {
                            throw std::runtime_error("Native hook callback expired");
                        }
                        Object context = hookContext(runtime, invocation, object, selector, true);
                        Value  result  = callbacks->replace->call(runtime, context);
                        if (!setHookReturn(runtime, invocation->dispatcher->signature->result,
                                           result, replacementResult->data()))
                        {
                            throw JSError(runtime,
                                          "Native hook replacement returned an unsupported value");
                        }
                    });
                    if (completed)
                    {
                        replacementApplied = true;
                        copyHookResult(invocation, nullptr);
                    }
                }
                catch (const std::exception &exception)
                {
                    logHookFailure(exception);
                }
                if (invokeDeferredHookOriginal(invocation))
                    originalCalled = true;
            }

            if (state->once)
            {
                onceHooks.push_back(state);
            }
        }

        if (!originalCalled && !replacementApplied)
        {
            invokeHookOriginal(dispatcher, arguments, nullptr);
            copyHookResult(invocation, nullptr);
        }

        for (const std::shared_ptr<HookState> &state : hooks)
        {
            if (!state->active || !state->hasAfter)
            {
                continue;
            }

            loader::AddonScope addonScope(state->addon);
            __strong id        retainedObject = object;
            executeRuntimeAsynchronously([invocation, retainedObject, selector,
                                          state](Runtime &runtime) {
                bool pending = state->afterOncePending.exchange(false);
                if (!state->active.load() && !pending)
                {
                    return;
                }
                auto callbacks = state->callbacks.lock();
                if (!callbacks || !callbacks->after)
                    return;
                Object context = hookContext(runtime, invocation, retainedObject, selector, false);
                callbacks->after->call(runtime, context);
            });
        }

        {
            std::lock_guard<std::mutex> lock(invocation->lifecycleMutex);
            invocation->active.store(false);
        }

        for (const std::shared_ptr<HookState> &state : onceHooks)
        {
            removeHook(state, true);
        }
    }
}

static Value makeHook(Runtime &runtime, const Value *args, size_t count)
{
    if (count < 3 || !args[0].isString() || !args[1].isString() || !args[2].isObject())
    {
        throw JSError(runtime, "objc.hook expects a class, selector, and handlers");
    }
    loader::native::NativeResourceReservation reservation(loader::native::nativeHookBudget(),
                                                          "Too many native hooks are installed");

    NSString *className    = jsiString(runtime, args[0]);
    NSString *selectorName = jsiString(runtime, args[1]);
    Class     cls          = NSClassFromString(className);
    SEL       selector     = NSSelectorFromString(selectorName);
    Method    method       = class_getInstanceMethod(cls, selector);
    if (!cls || !method)
    {
        throw JSError(runtime, "Objective-C hook target is unavailable");
    }

    NSMethodSignature *methodSignature =
        [NSMethodSignature signatureWithObjCTypes:method_getTypeEncoding(method)];
    auto        signature  = std::make_shared<HookSignature>();
    std::string resultName = nativeFFITypeName(methodSignature.methodReturnType);
    if (resultName.empty())
    {
        throw JSError(runtime, "Unsupported native hook return type encoding");
    }
    signature->result = loader::ffi::resolveType(resultName);
    for (NSUInteger index = 0; index < methodSignature.numberOfArguments; index++)
    {
        std::string name = nativeFFITypeName([methodSignature getArgumentTypeAtIndex:index]);
        if (name.empty())
        {
            throw JSError(runtime, "Unsupported native hook argument type encoding");
        }
        signature->arguments.push_back(loader::ffi::resolveType(name));
    }
    signature->interface = loader::ffi::callInterface(signature->result, signature->arguments);

    Object handlers    = args[2].asObject(runtime);
    auto   functionFor = [&](const char *name) -> std::shared_ptr<Function> {
        Value value = handlers.getProperty(runtime, name);
        if (value.isUndefined() || value.isNull())
        {
            return nullptr;
        }
        if (!value.isObject() || !value.asObject(runtime).isFunction(runtime))
        {
            throw JSError(runtime, "Native hook handlers must be functions");
        }
        return std::make_shared<Function>(value.asObject(runtime).getFunction(runtime));
    };

    std::shared_ptr<Function> before         = functionFor("before");
    std::shared_ptr<Function> after          = functionFor("after");
    std::shared_ptr<Function> replace        = functionFor("replace");
    bool                      once           = false;
    bool                      cacheOnly      = false;
    id                        instanceTarget = nil;
    if (count > 3 && args[3].isObject())
    {
        Object options       = args[3].asObject(runtime);
        Value  onceValue     = options.getProperty(runtime, "once");
        once                 = onceValue.isBool() && onceValue.getBool();
        Value cacheOnlyValue = options.getProperty(runtime, "cacheOnly");
        cacheOnly            = cacheOnlyValue.isBool() && cacheOnlyValue.getBool();
        Value instanceValue  = options.getProperty(runtime, "instance");
        if (!instanceValue.isUndefined() && !instanceValue.isNull())
        {
            instanceTarget = objcValue(runtime, instanceValue);
            if (!instanceTarget)
            {
                throw JSError(runtime, "Native hook instance target must be an Objective-C handle");
            }
        }
    }
    if (!before && !after && !replace && !cacheOnly)
    {
        throw JSError(runtime, "objc.hook requires at least one handler");
    }
    if (cacheOnly)
    {
        const std::string &result = signature->result.name;
        bool supportedResult      = result == "bool" || result == "i8" || result == "u8" ||
                                    result == "i16" || result == "u16" || result == "i32" ||
                                    result == "u32" || result == "i64" || result == "u64" ||
                                    result == "float" || result == "double" ||
                                    result.rfind("struct:", 0) == 0;
        if (before || after || replace || !supportedResult)
        {
            throw JSError(runtime,
                          "Native cache-only hooks require a scalar or struct return type");
        }
    }

    std::shared_ptr<HookDispatcher> dispatcher;
    std::string                     key = hookKey(cls, selector);
    {
        std::lock_guard<std::mutex> lock(gHookMutex);
        auto                        iterator = gDispatchers.find(key);
        if (iterator == gDispatchers.end())
        {
            dispatcher            = std::make_shared<HookDispatcher>();
            dispatcher->cls       = cls;
            dispatcher->selector  = selector;
            dispatcher->signature = signature;
            auto prepareClosure   = [&]() -> bool {
                dispatcher->closure =
                    (ffi_closure *) ffi_closure_alloc(sizeof(ffi_closure), &dispatcher->code);
                bool closureReady =
                    dispatcher->closure && isExecutableAddress(dispatcher->code) &&
                    ffi_prep_closure_loc(dispatcher->closure,
                                         &dispatcher->signature->interface->cif, dispatchFFIHook,
                                         dispatcher.get(), dispatcher->code) == FFI_OK;
                if (!closureReady)
                {
                    if (dispatcher->closure)
                        ffi_closure_free(dispatcher->closure);
                    dispatcher->closure = nullptr;
                    dispatcher->code    = nullptr;
                }
                return closureReady;
            };
            if (!prepareClosure())
            {
                dispatcher->code = fallbackHookCode(*dispatcher->signature);
                if (!dispatcher->code && signature->result.name == "void" &&
                    signature->arguments.size() == 2)
                {
                    dispatcher->code = (void *) dispatchVoidHook;
                }
                if (!dispatcher->code)
                {
                    std::string signatureName = dispatcher->signature->result.name + "(";
                    for (size_t index = 0; index < dispatcher->signature->arguments.size(); index++)
                    {
                        if (index > 0)
                            signatureName += ",";
                        signatureName += dispatcher->signature->arguments[index].name;
                    }
                    signatureName += ")";
                    throw JSError(runtime,
                                  "Native hook closure is unavailable on this device for " +
                                      signatureName);
                }
            }
            if (dispatcher->closure)
            {
                gClosureDispatchers[dispatcher.get()] = dispatcher;
            }
            MSHookMessageEx(cls, selector, (IMP) dispatcher->code, &dispatcher->original);
            gDispatchers[key] = dispatcher;
        }
        else
        {
            dispatcher = iterator->second;
            if (dispatcher->signature->result.name != signature->result.name ||
                dispatcher->signature->arguments.size() != signature->arguments.size())
            {
                throw JSError(runtime, "Native hook signature changed while hooks are active");
            }
            if (method_getImplementation(method) == dispatcher->original)
            {
                MSHookMessageEx(cls, selector, (IMP) dispatcher->code, &dispatcher->original);
            }
            dispatcher->retired.store(false);
        }
    }

    auto callbacks           = std::make_shared<HookCallbacks>();
    callbacks->before        = std::move(before);
    callbacks->after         = std::move(after);
    callbacks->replace       = std::move(replace);
    auto state               = std::make_shared<HookState>();
    state->identifier        = gNextHookIdentifier.fetch_add(1);
    state->runtimeGeneration = loader::native::runtimeGeneration();
    state->callbacks         = callbacks;
    state->hasBefore         = callbacks->before != nullptr;
    state->hasAfter          = callbacks->after != nullptr;
    state->hasReplace        = callbacks->replace != nullptr;
    state->cacheOnly         = cacheOnly;
    state->once              = once;
    state->instanceTarget    = instanceTarget;
    state->dispatcher        = dispatcher;
    state->addon             = loader::currentAddon();
    {
        std::lock_guard<std::mutex> lock(gHookMutex);
        dispatcher->hooks.push_back(state);
    }
    reservation.commit();
    return Object::createFromHostObject(runtime, std::make_shared<HookTokenHost>(state, callbacks));
}

static Value objcFunction(Runtime &runtime, const Value &target, const Value &selectorValue,
                          const Value *args, size_t count, size_t start)
{
    id        object       = objcValue(runtime, target);
    NSString *selectorName = jsiString(runtime, selectorValue);
    if (!object || selectorName.length == 0)
    {
        throw JSError(runtime, "objc.call expects an object handle and selector");
    }

    return invokeObject(runtime, object, NSSelectorFromString(selectorName),
                        argumentArray(runtime, args, count, start));
}

static Value getIvar(Runtime &runtime, const Value *args, size_t count)
{
    if (count < 2)
    {
        throw JSError(runtime, "objc.getIvar expects an object and ivar name");
    }

    id        object = objcValue(runtime, args[0]);
    NSString *name   = jsiString(runtime, args[1]);
    Ivar ivar = object ? class_getInstanceVariable(object_getClass(object), name.UTF8String) : NULL;
    if (!ivar)
    {
        return Value::undefined();
    }

    const char *type    = ivar_getTypeEncoding(ivar);
    uint8_t    *address = (uint8_t *) (__bridge void *) object + ivar_getOffset(ivar);
    char        code    = normalizedType(type);
    if (!type || !*type)
    {
        return objcResult(runtime, object_getIvar(object, ivar));
    }
    if (code == '@')
    {
        __unsafe_unretained id value = nil;
        memcpy(&value, address, sizeof(value));
        return objcResult(runtime, value);
    }

    if (code == '#')
    {
        Class value = Nil;
        memcpy(&value, address, sizeof(value));
        return objcResult(runtime, value);
    }

    if (code == ':')
    {
        SEL value = NULL;
        memcpy(&value, address, sizeof(value));
        return value ? String::createFromUtf8(runtime, sel_getName(value)) : Value::null();
    }

    if (code == '^' || code == '*')
    {
        void *value = nullptr;
        memcpy(&value, address, sizeof(value));
        return pointerResult(runtime, value);
    }

    if (code == 'B')
    {
        bool value = false;
        memcpy(&value, address, sizeof(value));
        return Value(value);
    }
    if (code == 'f')
    {
        float value = 0;
        memcpy(&value, address, sizeof(value));
        return Value((double) value);
    }
    if (code == 'd')
    {
        double value = 0;
        memcpy(&value, address, sizeof(value));
        return Value(value);
    }
    if (code == 'c')
    {
        int8_t value = 0;
        memcpy(&value, address, sizeof(value));
        return Value((double) value);
    }
    if (code == 'C')
    {
        uint8_t value = 0;
        memcpy(&value, address, sizeof(value));
        return Value((double) value);
    }
    if (code == 's')
    {
        int16_t value = 0;
        memcpy(&value, address, sizeof(value));
        return Value((double) value);
    }
    if (code == 'S')
    {
        uint16_t value = 0;
        memcpy(&value, address, sizeof(value));
        return Value((double) value);
    }
    if (code == 'i')
    {
        int32_t value = 0;
        memcpy(&value, address, sizeof(value));
        return Value((double) value);
    }
    if (code == 'I')
    {
        uint32_t value = 0;
        memcpy(&value, address, sizeof(value));
        return Value((double) value);
    }
    if (code == 'l' || code == 'q')
    {
        int64_t value = 0;
        memcpy(&value, address, sizeof(value));
        return Value(runtime, BigInt::fromInt64(runtime, value));
    }
    if (code == 'L' || code == 'Q')
    {
        uint64_t value = 0;
        memcpy(&value, address, sizeof(value));
        return Value(runtime, BigInt::fromUint64(runtime, value));
    }
    if (code == '{')
    {
        NSUInteger size      = 0;
        NSUInteger alignment = 0;
        NSGetSizeAndAlignment(ivar_getTypeEncoding(ivar), &size, &alignment);
        return structResult(runtime, [NSString stringWithUTF8String:type] ?: @"",
                            [NSValue value:address withObjCType:type]);
    }
    throw JSError(runtime, "Unsupported ivar type");
}

static Value setIvar(Runtime &runtime, const Value *args, size_t count)
{
    if (count < 3)
    {
        throw JSError(runtime, "objc.setIvar expects an object, ivar name, and value");
    }

    id        object = objcValue(runtime, args[0]);
    NSString *name   = jsiString(runtime, args[1]);
    Ivar ivar = object ? class_getInstanceVariable(object_getClass(object), name.UTF8String) : NULL;
    if (!ivar)
    {
        throw JSError(runtime, "Objective-C ivar is unavailable");
    }

    uint8_t *address     = (uint8_t *) (__bridge void *) object + ivar_getOffset(ivar);
    char     code        = normalizedType(ivar_getTypeEncoding(ivar));
    id       value       = valueToObjC(runtime, args[2]);
    id       scalarValue = value == [NSNull null] ? @0 : value;
    if (code == '@')
    {
        object_setIvar(object, ivar, value == [NSNull null] ? nil : value);
        return Value::undefined();
    }

    if (code == '#')
    {
        Class argument = value != [NSNull null] && object_isClass(value) ? value : Nil;
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }

    if (code == ':')
    {
        SEL argument = NULL;
        if ([value isKindOfClass:[NSString class]])
        {
            argument = NSSelectorFromString((NSString *) value);
        }
        else if ([value isKindOfClass:[NSValue class]])
        {
            argument = (SEL)[(NSValue *) value pointerValue];
        }
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }

    if (code == '^' || code == '*')
    {
        void *argument =
            [value isKindOfClass:[NSValue class]] ? [(NSValue *) value pointerValue] : nullptr;
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }

    if (code == 'B')
    {
        bool argument = [scalarValue boolValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == 'f')
    {
        float argument = [scalarValue floatValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == 'd')
    {
        double argument = [scalarValue doubleValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == 'c')
    {
        int8_t argument = [scalarValue charValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == 'C')
    {
        uint8_t argument = [scalarValue unsignedCharValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == 's')
    {
        int16_t argument = [scalarValue shortValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == 'S')
    {
        uint16_t argument = [scalarValue unsignedShortValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == 'i')
    {
        int32_t argument = [scalarValue intValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == 'I')
    {
        uint32_t argument = [scalarValue unsignedIntValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == 'l' || code == 'q')
    {
        int64_t argument = [scalarValue longLongValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == 'L' || code == 'Q')
    {
        uint64_t argument = [scalarValue unsignedLongLongValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == '{')
    {
        if (![value isKindOfClass:[NSValue class]])
        {
            throw JSError(runtime, "Native struct ivar value expected");
        }
        NSUInteger size      = 0;
        NSUInteger alignment = 0;
        NSGetSizeAndAlignment(ivar_getTypeEncoding(ivar), &size, &alignment);
        [(NSValue *) value getValue:address size:size];
        return Value::undefined();
    }
    throw JSError(runtime, "Unsupported ivar type");
}

static objc_AssociationPolicy objcAssociationPolicy(loader::native::AssociationPolicy policy)
{
    switch (policy)
    {
        case loader::native::AssociationPolicy::Assign:
            return OBJC_ASSOCIATION_ASSIGN;
        case loader::native::AssociationPolicy::Retain:
            return OBJC_ASSOCIATION_RETAIN;
        case loader::native::AssociationPolicy::Copy:
            return OBJC_ASSOCIATION_COPY;
        case loader::native::AssociationPolicy::CopyNonatomic:
            return OBJC_ASSOCIATION_COPY_NONATOMIC;
        case loader::native::AssociationPolicy::RetainNonatomic:
            return OBJC_ASSOCIATION_RETAIN_NONATOMIC;
    }
    return OBJC_ASSOCIATION_RETAIN_NONATOMIC;
}

static objc_AssociationPolicy associationPolicy(Runtime &runtime, const Value *value)
{
    if (!value || !value->isString())
    {
        return objcAssociationPolicy(loader::native::kDefaultAssociationPolicy);
    }

    std::optional<loader::native::AssociationPolicy> policy =
        loader::native::associationPolicyNamed(value->asString(runtime).utf8(runtime));
    if (!policy)
    {
        throw JSError(runtime, "Unsupported native association policy");
    }
    return objcAssociationPolicy(*policy);
}

static void installObjC(Runtime &runtime, Object &objc)
{
    objc.setProperty(
        runtime, "getClass",
        makeFunction("getClass", 1, runtime,
                     [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                         if (count == 0 || !args[0].isString())
                         {
                             return Value::null();
                         }
                         Class cls = NSClassFromString(jsiString(rt, args[0]));
                         return cls ? Object::createFromHostObject(
                                          rt, std::make_shared<ObjCHandleHost>((id) cls))
                                    : Value::null();
                     }));

    objc.setProperty(
        runtime, "alloc",
        makeFunction("alloc", 1, runtime,
                     [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                         Class cls = count ? classFromValue(rt, args[0]) : Nil;
                         if (!cls)
                         {
                             throw JSError(rt, "objc.alloc expects a class handle or class name");
                         }
                         return objcHandleResult(rt, [[cls alloc] init]);
                     }));

    objc.setProperty(
        runtime, "className",
        makeFunction("className", 1, runtime,
                     [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                         id object = count ? objcValue(rt, args[0]) : nil;
                         if (!object)
                         {
                             return Value::null();
                         }
                         Class cls = object_isClass(object) ? object : object_getClass(object);
                         return objcJSIValue(rt, NSStringFromClass(cls));
                     }));

    objc.setProperty(
        runtime, "respondsTo",
        makeFunction("respondsTo", 2, runtime,
                     [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                         if (count < 2)
                         {
                             return Value(false);
                         }
                         id        object = objcValue(rt, args[0]);
                         NSString *name   = jsiString(rt, args[1]);
                         return Value(object &&
                                      [object respondsToSelector:NSSelectorFromString(name)]);
                     }));

    objc.setProperty(
        runtime, "call",
        makeFunction("call", 2, runtime,
                     [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                         if (count < 2)
                         {
                             throw JSError(rt, "objc.call expects an object handle and selector");
                         }
                         return objcFunction(rt, args[0], args[1], args, count, 2);
                     }));

    objc.setProperty(
        runtime, "callSuper",
        makeFunction(
            "callSuper", 3, runtime,
            [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                if (count < 3)
                {
                    throw JSError(rt, "objc.callSuper expects an object, class, and selector");
                }
                id        object       = objcValue(rt, args[0]);
                Class     cls          = classFromValue(rt, args[1]);
                NSString *selectorName = jsiString(rt, args[2]);
                return invokeSuperObject(rt, object, cls, NSSelectorFromString(selectorName),
                                         argumentArray(rt, args, count, 3));
            }));

    objc.setProperty(
        runtime, "invoke",
        makeFunction(
            "invoke", 3, runtime,
            [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                if (count < 3 || !args[2].isObject() || !args[2].asObject(rt).isArray(rt))
                {
                    throw JSError(rt,
                                  "objc.invoke expects an object, selector, and argument array");
                }
                Array           array     = args[2].asObject(rt).asArray(rt);
                NSMutableArray *arguments = [NSMutableArray arrayWithCapacity:array.size(rt)];
                for (size_t index = 0; index < array.size(rt); index++)
                {
                    [arguments addObject:valueToObjC(rt, array.getValueAtIndex(rt, index))
                                             ?: [NSNull null]];
                }
                id        object       = objcValue(rt, args[0]);
                NSString *selectorName = jsiString(rt, args[1]);
                return invokeWithThreadPolicy(rt, object, NSSelectorFromString(selectorName),
                                              arguments, count > 3 ? &args[3] : nullptr);
            }));

    objc.setProperty(
        runtime, "invokeAsync",
        makeFunction(
            "invokeAsync", 3, runtime,
            [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                if (count < 3 || !args[2].isObject() || !args[2].asObject(rt).isArray(rt))
                {
                    throw JSError(
                        rt, "objc.invokeAsync expects an object, selector, and argument array");
                }
                Array           array     = args[2].asObject(rt).asArray(rt);
                NSMutableArray *arguments = [NSMutableArray arrayWithCapacity:array.size(rt)];
                for (size_t index = 0; index < array.size(rt); index++)
                {
                    [arguments addObject:valueToObjC(rt, array.getValueAtIndex(rt, index))
                                             ?: [NSNull null]];
                }
                id        object       = objcValue(rt, args[0]);
                NSString *selectorName = jsiString(rt, args[1]);
                return invokeAsync(rt, object, NSSelectorFromString(selectorName), arguments);
            }));

    objc.setProperty(runtime, "batch", makeFunction("batch", 1, runtime, invokeBatch));
    objc.setProperty(runtime, "snapshot", makeFunction("snapshot", 2, runtime, snapshotUI));
    objc.setProperty(runtime, "findViews", makeFunction("findViews", 3, runtime, findUIViews));

    objc.setProperty(
        runtime, "invokeSuper",
        makeFunction(
            "invokeSuper", 4, runtime,
            [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                if (count < 4 || !args[3].isObject() || !args[3].asObject(rt).isArray(rt))
                {
                    throw JSError(
                        rt,
                        "objc.invokeSuper expects an object, class, selector, and argument array");
                }
                id              object       = objcValue(rt, args[0]);
                Class           cls          = classFromValue(rt, args[1]);
                NSString       *selectorName = jsiString(rt, args[2]);
                Array           array        = args[3].asObject(rt).asArray(rt);
                NSMutableArray *arguments    = [NSMutableArray arrayWithCapacity:array.size(rt)];
                for (size_t index = 0; index < array.size(rt); index++)
                {
                    [arguments addObject:valueToObjC(rt, array.getValueAtIndex(rt, index))
                                             ?: [NSNull null]];
                }
                return invokeSuperWithThreadPolicy(rt, object, cls,
                                                   NSSelectorFromString(selectorName), arguments,
                                                   count > 4 ? &args[4] : nullptr);
            }));

    objc.setProperty(
        runtime, "invokeSuperAsync",
        makeFunction(
            "invokeSuperAsync", 4, runtime,
            [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                if (count < 4 || !args[3].isObject() || !args[3].asObject(rt).isArray(rt))
                {
                    throw JSError(
                        rt,
                        "objc.invokeSuperAsync expects an object, class, selector, and argument array");
                }
                id              object       = objcValue(rt, args[0]);
                Class           cls          = classFromValue(rt, args[1]);
                NSString       *selectorName = jsiString(rt, args[2]);
                Array           array        = args[3].asObject(rt).asArray(rt);
                NSMutableArray *arguments    = [NSMutableArray arrayWithCapacity:array.size(rt)];
                for (size_t index = 0; index < array.size(rt); index++)
                {
                    [arguments addObject:valueToObjC(rt, array.getValueAtIndex(rt, index))
                                             ?: [NSNull null]];
                }
                return invokeSuperAsync(rt, object, cls, NSSelectorFromString(selectorName),
                                        arguments);
            }));

    objc.setProperty(runtime, "getIvar", makeFunction("getIvar", 2, runtime, getIvar));
    objc.setProperty(runtime, "setIvar", makeFunction("setIvar", 3, runtime, setIvar));

    objc.setProperty(runtime, "createAssociationKey",
                     makeFunction("createAssociationKey", 0, runtime,
                                  [](Runtime &rt, const Value &, const Value *, size_t) -> Value {
                                      return Object::createFromHostObject(
                                          rt, std::make_shared<AssociationKeyHost>([NSObject new]));
                                  }));

    objc.setProperty(
        runtime, "getAssociatedObject",
        makeFunction("getAssociatedObject", 2, runtime,
                     [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                         if (count < 2)
                         {
                             return Value::null();
                         }
                         id object = objcValue(rt, args[0]);
                         if (!args[1].isObject() ||
                             !args[1].asObject(rt).isHostObject<AssociationKeyHost>(rt))
                         {
                             return Value::null();
                         }
                         const void *key =
                             args[1].asObject(rt).getHostObject<AssociationKeyHost>(rt)->key();
                         return objcResult(rt, objc_getAssociatedObject(object, key));
                     }));

    objc.setProperty(
        runtime, "setAssociatedObject",
        makeFunction(
            "setAssociatedObject", 4, runtime,
            [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                if (count < 3 || !args[1].isObject() ||
                    !args[1].asObject(rt).isHostObject<AssociationKeyHost>(rt))
                {
                    throw JSError(rt,
                                  "objc.setAssociatedObject expects an object and association key");
                }
                id          object = objcValue(rt, args[0]);
                const void *key = args[1].asObject(rt).getHostObject<AssociationKeyHost>(rt)->key();
                id          value = valueToObjC(rt, args[2]);
                objc_setAssociatedObject(object, key, value == [NSNull null] ? nil : value,
                                         associationPolicy(rt, count > 3 ? &args[3] : nullptr));
                return Value::undefined();
            }));

    objc.setProperty(
        runtime, "struct",
        makeFunction("struct", 2, runtime,
                     [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                         if (count < 2 || !args[0].isString())
                         {
                             throw JSError(rt, "objc.struct expects a name and fields");
                         }
                         return structValue(rt, jsiString(rt, args[0]), args[1]);
                     }));

    objc.setProperty(
        runtime, "array",
        makeFunction("array", 1, runtime,
                     [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                         id object = count ? objcValue(rt, args[0]) : nil;
                         if (![object isKindOfClass:[NSArray class]])
                         {
                             return Array(rt, 0);
                         }
                         return objcResult(rt, object);
                     }));

    objc.setProperty(
        runtime, "data",
        makeFunction("data", 1, runtime,
                     [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                         NSData *data = count ? valueToData(rt, args[0]) : nil;
                         if (!data)
                         {
                             throw JSError(rt, "objc.data expects an ArrayBuffer or TypedArray");
                         }
                         return objcHandleResult(rt, data);
                     }));

    objc.setProperty(runtime, "hook", makeFunction("hook", 3, runtime, makeHook));
}

class ObjectFFICodec final : public loader::ffi::TypeCodec
{
public:
    void write(Runtime &runtime, const Value &value, uint8_t *target,
               loader::ffi::ArgumentStorage &storage) const override
    {
        if (value.isNull() || value.isUndefined())
        {
            storeNativeValue<void *>(target, nullptr);
            return;
        }
        if (std::shared_ptr<PointerHost> host = loader::ffi::pointerHost(runtime, value))
        {
            storeNativeValue<void *>(target, host->value());
            return;
        }
        id object = valueToObjC(runtime, value);
        storage.retain(std::make_shared<ObjCHandleHost>(object));
        storeNativeValue<void *>(target, (__bridge void *) object);
    }

    Value read(Runtime &runtime, const uint8_t *source) const override
    {
        return objcResult(runtime, (__bridge id) loadNativeValue<void *>(source));
    }
};

class ClassFFICodec final : public loader::ffi::TypeCodec
{
public:
    void write(Runtime &runtime, const Value &value, uint8_t *target,
               loader::ffi::ArgumentStorage &) const override
    {
        if (value.isNull() || value.isUndefined())
        {
            storeNativeValue<void *>(target, nullptr);
            return;
        }
        if (std::shared_ptr<ObjCHandleHost> host = objcHost(runtime, value))
        {
            storeNativeValue<void *>(target, (__bridge void *) host->value());
            return;
        }
        if (std::shared_ptr<PointerHost> host = loader::ffi::pointerHost(runtime, value))
        {
            storeNativeValue<void *>(target, host->value());
            return;
        }
        throw std::invalid_argument("Native FFI class argument expected");
    }

    Value read(Runtime &runtime, const uint8_t *source) const override
    {
        return objcResult(runtime, (__bridge id) loadNativeValue<void *>(source));
    }
};

class SelectorFFICodec final : public loader::ffi::TypeCodec
{
public:
    void write(Runtime &runtime, const Value &value, uint8_t *target,
               loader::ffi::ArgumentStorage &) const override
    {
        if (value.isNull() || value.isUndefined())
        {
            storeNativeValue<SEL>(target, NULL);
            return;
        }
        if (value.isString())
        {
            storeNativeValue<SEL>(target, NSSelectorFromString(jsiString(runtime, value)));
            return;
        }
        if (std::shared_ptr<PointerHost> host = loader::ffi::pointerHost(runtime, value))
        {
            storeNativeValue<void *>(target, host->value());
            return;
        }
        throw std::invalid_argument("Native FFI selector argument expected");
    }

    Value read(Runtime &runtime, const uint8_t *source) const override
    {
        SEL selector = loadNativeValue<SEL>(source);
        return selector ? Value(String::createFromUtf8(runtime, sel_getName(selector)))
                        : Value::null();
    }
};

static std::optional<void *> objcFFIPointer(Runtime &runtime, const Object &object)
{
    if (!object.isHostObject<ObjCHandleHost>(runtime))
    {
        return std::nullopt;
    }
    return (__bridge void *) object.getHostObject<ObjCHandleHost>(runtime)->value();
}

static std::optional<Value> objcFFIStructResult(Runtime                         &runtime,
                                                const loader::ffi::StructLayout &layout,
                                                const uint8_t                   *source)
{
    const char *encoding = nativeStructEncoding(layout.name);
    if (!encoding)
    {
        return std::nullopt;
    }
    return structResult(runtime, [NSString stringWithUTF8String:layout.name.c_str()] ?: @"",
                        [NSValue value:source withObjCType:encoding]);
}

static void installFFIPlatform(void)
{
    static std::once_flag installed;
    std::call_once(installed, [] {
        loader::ffi::registerExtensionType("object", std::make_shared<ObjectFFICodec>());
        loader::ffi::registerExtensionType("class", std::make_shared<ClassFFICodec>());
        loader::ffi::registerExtensionType("selector", std::make_shared<SelectorFFICodec>());
        loader::ffi::setPointerResolver(objcFFIPointer);
        loader::ffi::setStructResultFactory(objcFFIStructResult);
    });
}

static void installFFI(Runtime &runtime, Object &ffi)
{
    ffi.setProperty(runtime, "symbol",
                    makeFunction("symbol", 2, runtime, loader::ffi::lookupSymbol));
    ffi.setProperty(runtime, "call", makeFunction("call", 3, runtime, loader::ffi::callFunction));
}

static Value environment(Runtime &runtime, const Value *, size_t)
{
    return loader::toJSIValue(runtime, loader::currentDebugEnvironment());
}

static void installDebug(Runtime &runtime, Object &debug)
{
    debug.setProperty(runtime, "recordEvaluation",
                      loader::native::makeRecordEvaluationFunction(runtime));
    debug.setProperty(runtime, "environment", makeFunction("environment", 0, runtime, environment));
}

}

namespace loader {

void setNativePluginRuntimeExecutor(id instance)
{
    gRuntimeExecutorInstance = instance;
    loader::native::setExecutor(std::make_shared<IOSNativePluginExecutor>());
}

void setNativePluginFabricHost(id instance)
{
    gFabricHostInstance = instance;
}

static void invalidateRuntimeResources(uint64_t generation)
{
    invalidateRuntimeHooks(generation);
}

void registerNativePluginBridge(Runtime &runtime)
{
    installFFIPlatform();
    static std::once_flag invalidation;
    std::call_once(invalidation, [] {
        loader::native::onRuntimeGenerationChanged(invalidateRuntimeResources);
    });
    loader::native::registerRuntime(runtime);
    loader::native::setPlatformHandleCounter([] {
        return gLiveObjCHandles.load();
    });
    loader::native::NativePluginRootBuilder bridge(runtime,
                                                   loader::native::NativePluginPlatform::IOS);

    Object objc(runtime);
    installObjC(runtime, objc);
    bridge.addNamespace("objc", std::move(objc));

    Object ffi(runtime);
    installFFI(runtime, ffi);
    bridge.addNamespace("ffi", std::move(ffi));

    bridge.addNamespace(
        "fabric", loader::native::makeFabricNamespace(runtime, std::make_shared<IOSFabricAdapter>(),
                                                      loader::native::FabricCalls::SyncAndAsync));

    Object debug(runtime);
    installDebug(runtime, debug);
    bridge.addNamespace("debug", std::move(debug));

    bridge.install();
}

}
