#import "NativePluginBridge.h"

#import <dlfcn.h>
#import <mach/mach.h>
#import <mach-o/loader.h>
#import <objc/message.h>
#import <objc/runtime.h>
#import <os/signpost.h>
#import <ptrauth.h>
#import <substrate.h>
#import <UIKit/UIKit.h>

#import <algorithm>
#import <atomic>
#import <cmath>
#import <cstdint>
#import <cstring>
#import <functional>
#import <exception>
#import <memory>
#import <mutex>
#import <sstream>
#import <stdexcept>
#import <string>
#import <thread>
#import <unordered_map>
#import <vector>

#import "JSI.h"
#import "Logger.h"
#import "NativeAddressValidation.h"
#import "NativeConversionBudget.h"
#import "NativeFFITypes.h"
#import "NativeEvaluations.h"
#import "NativePluginFFI.h"
#import "NativeNumericValidation.h"
#import "NativeOperationGate.h"
#import "NativePluginRuntime.h"
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

@interface FabricContainer : UIView
@property(nonatomic, weak) UIView *surfaceView;
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
    _fabricSettingFrame = YES;
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
        surfaceView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    }
}

@end

namespace {

class ObjCHandleHost final : public HostObject
{
public:
    explicit ObjCHandleHost(id value) : value_(value) {}

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

class FabricSurfaceHost final : public HostObject
{
public:
    FabricSurfaceHost(void) = default;

    void setSurface(id surface, UIView *containerView, UIView *surfaceView, uint64_t generation)
    {
        std::lock_guard<std::mutex> lock(mutex_);
        surface_ = surface;
        view_ = containerView;
        surfaceView_ = surfaceView;
        generation_ = generation;
        active_ = true;
    }

    id surface(void) const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return surface_;
    }

    UIView *view(void) const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return view_;
    }

    UIView *surfaceView(void) const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return surfaceView_;
    }

    bool active(void) const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return active_;
    }

    uint64_t generation(void) const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return generation_;
    }

    void clear(void)
    {
        std::lock_guard<std::mutex> lock(mutex_);
        surface_ = nil;
        view_ = nil;
        surfaceView_ = nil;
        active_ = false;
    }

private:
    mutable std::mutex mutex_;
    __strong id surface_ = nil;
    __strong UIView *view_ = nil;
    __strong UIView *surfaceView_ = nil;
    bool active_ = false;
    uint64_t generation_ = 0;
};

class PointerHost final : public HostObject
{
public:
    explicit PointerHost(void *value, bool callable = false) : value_(value), callable_(callable) {}

    void *value(void) const
    {
        return value_;
    }

    bool callable(void) const
    {
        return callable_;
    }

private:
    void *value_;
    bool callable_;
};

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
    NSValue *value_;
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

struct FFITypeDefinition {
    ffi_type type{};
    std::vector<ffi_type *> elements;
};

struct FFITypeSpec {
    std::string name;
    ffi_type *type;
};

struct FFISignature {
    FFITypeSpec result;
    std::vector<FFITypeSpec> arguments;
};

struct FFICallArgument {
    std::vector<uint8_t> bytes;
    std::string string;
    id object;
    void *pointer;
};

struct HookSignature {
    FFITypeSpec result;
    std::vector<FFITypeSpec> arguments;
    ffi_cif cif{};
};

struct HookState;
struct HookDispatcher;

struct HookCallbacks {
    std::shared_ptr<Function> before;
    std::shared_ptr<Function> after;
    std::shared_ptr<Function> replace;
};

struct HookDispatcher {
    Class cls;
    SEL selector;
    IMP original;
    std::shared_ptr<HookSignature> signature;
    ffi_closure *closure = nullptr;
    void *code = nullptr;
    std::vector<std::shared_ptr<HookState>> hooks;
    std::atomic_uint activeCalls{0};
    std::atomic_bool retired{false};
};

struct HookState {
    uint64_t identifier;
    uint64_t runtimeGeneration;
    std::weak_ptr<HookCallbacks> callbacks;
    bool hasBefore = false;
    bool hasAfter = false;
    bool hasReplace = false;
    std::weak_ptr<HookDispatcher> dispatcher;
    __strong id instanceTarget = nil;
    std::mutex returnCacheMutex;
    __strong NSMutableDictionary<NSArray *, NSData *> *returnCache = [NSMutableDictionary dictionary];
    __strong NSMutableDictionary<NSArray *, NSNumber *> *sizeHeightFloors = [NSMutableDictionary dictionary];
    bool cacheOnly = false;
    bool once = false;
    std::atomic_bool active{true};
    std::atomic_bool afterOncePending{false};
};

class HookTokenHost final : public HostObject
{
public:
    HookTokenHost(std::shared_ptr<HookState> state, std::shared_ptr<HookCallbacks> callbacks)
        : state_(std::move(state)), callbacks_(std::move(callbacks)) {}

    std::shared_ptr<HookState> state(void) const
    {
        return state_;
    }

    Value get(Runtime &runtime, const PropNameID &name) override;

private:
    std::shared_ptr<HookState> state_;
    std::shared_ptr<HookCallbacks> callbacks_;
};

static std::mutex gHookMutex;
static std::unordered_map<std::string, std::shared_ptr<HookDispatcher>> gDispatchers;
static std::unordered_map<HookDispatcher *, std::shared_ptr<HookDispatcher>> gClosureDispatchers;
static std::atomic_uint64_t gNextHookIdentifier{1};
static __weak id gRuntimeExecutorInstance = nil;
static __weak id gFabricHostInstance = nil;
static std::mutex gFabricSurfaceMutex;
static std::unordered_map<FabricSurfaceHost *, std::shared_ptr<FabricSurfaceHost>> gFabricSurfaces;

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
        if (!enabled_) return;
        identifier_ = os_signpost_id_generate(log_);
        os_signpost_interval_begin(log_, identifier_, "Native Operation",
                                   "operation=%{public}s", operation);
    }

    ~NativeOperationSignpost()
    {
        if (enabled_) os_signpost_interval_end(log_, identifier_, "Native Operation");
    }

private:
    os_log_t log_;
    os_signpost_id_t identifier_ = OS_SIGNPOST_ID_INVALID;
    bool enabled_;
};

static FFITypeSpec ffiType(Runtime &runtime, const std::string &name);
static ffi_cif prepareFFICif(Runtime &runtime, const FFITypeSpec &result,
                             const std::vector<FFITypeSpec> &arguments);
static Value ffiResult(Runtime &runtime, const FFITypeSpec &spec, const std::vector<uint8_t> &bytes);
static void dispatchFFIHook(ffi_cif *cif, void *returnValue, void **arguments, void *userData);
static void dispatchFFIHookBody(ffi_cif *cif, void *returnValue, void **arguments, void *userData);
static void executeRuntimeAsynchronously(std::function<void(Runtime &)> callback);
static Value executeMainAsynchronously(Runtime &runtime, std::function<void(void)> operation,
                                       std::function<Value(Runtime &)> result);
static std::function<void(void)> objcGuarded(std::function<void(void)> operation);
static void dispatchVoidHook(id object, SEL selector);
static CGSize dispatchCGSizeHook(id object, SEL selector, CGSize size);
static CGSize dispatchCGSizeNoArgumentHook(id object, SEL selector);
static CGSize dispatchCGSizePriorityHook(id object, SEL selector, CGSize size, float horizontal,
                                        float vertical);
static CGSize dispatchCGSizeDoublePriorityHook(id object, SEL selector, CGSize size, double horizontal,
                                               double vertical);
static CGRect dispatchCGRectObjectHook(id object, SEL selector, id indexPath);
static double dispatchDoubleObjectObjectHook(id object, SEL selector, id tableView, id indexPath);
static int8_t dispatchBoolObjectObjectHook(id object, SEL selector, id first, id second);
static int8_t dispatchBoolObjectHook(id object, SEL selector, id value);
static int8_t dispatchBoolClassHook(id object, SEL selector, Class value);
static int8_t dispatchBoolSelectorHook(id object, SEL selector, SEL value);
static void dispatchVoidObjectHook(id object, SEL selector, id value);
static void dispatchVoidNSUIntegerHook(id object, SEL selector, NSUInteger value);
static void dispatchVoidObjectObjectHook(id object, SEL selector, id first, id second);
static void dispatchVoidObjectObjectObjectHook(id object, SEL selector, id tableView, id cell,
                                               id indexPath);
static Value makeHook(Runtime &runtime, const Value *args, size_t count);
static void invokeHookOriginal(const std::shared_ptr<HookDispatcher> &dispatcher, void **arguments,
                               void *returnValue);
static const char *structEncoding(const std::string &name);
static void setHookReturnCache(Runtime &runtime, const std::shared_ptr<HookState> &state,
                               const Value *args, size_t count);
static void removeHookReturnCache(Runtime &runtime, const std::shared_ptr<HookState> &state,
                                  const Value *args, size_t count);
static void clearHookReturnCache(const std::shared_ptr<HookState> &state);
static void setHookSizeHeightFloor(Runtime &runtime, const std::shared_ptr<HookState> &state,
                                   const Value *args, size_t count);
static void removeHookSizeHeightFloor(Runtime &runtime, const std::shared_ptr<HookState> &state,
                                      const Value *args, size_t count);

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
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, static_cast<int64_t>(seconds * NSEC_PER_SEC)),
                       dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
                           (*task)();
                       });
    }
};

[[noreturn]] static void throwWrongThread(Runtime &runtime, const char *message)
{
    loader::native::throwCoded(runtime, "NATIVE_WRONG_THREAD", message);
}

static std::mutex gFFIMutex;
static std::unordered_map<std::string, std::shared_ptr<FFITypeDefinition>> gFFITypes;
struct CachedFFICif {
    ffi_cif cif{};
    std::vector<ffi_type *> arguments;
};

static std::mutex gFFICifMutex;
static std::unordered_map<std::string, std::shared_ptr<CachedFFICif>> gFFICifs;

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
            throw loader::native::NativeCodedError(
                "NATIVE_BRIDGE_ERROR",
                std::string("Objective-C exception: ") + (exception.reason.UTF8String ?: "unknown"));
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

static bool isInstructionSectionAddress(void *address)
{
    Dl_info image{};
    if (dladdr(address, &image) == 0 || !image.dli_fbase)
    {
        return false;
    }

    const auto *header = reinterpret_cast<const mach_header_64 *>(image.dli_fbase);
    if (header->magic != MH_MAGIC_64)
    {
        return false;
    }

    const auto *command = reinterpret_cast<const load_command *>(header + 1);
    std::uintptr_t slide = 0;
    bool foundText = false;
    for (uint32_t index = 0; index < header->ncmds; index++)
    {
        if (command->cmdsize < sizeof(load_command))
        {
            return false;
        }
        if (command->cmd == LC_SEGMENT_64)
        {
            const auto *segment = reinterpret_cast<const segment_command_64 *>(command);
            if (command->cmdsize < sizeof(segment_command_64) ||
                segment->nsects > (command->cmdsize - sizeof(segment_command_64)) /
                                      sizeof(section_64))
            {
                return false;
            }
            if (strncmp(segment->segname, SEG_TEXT, sizeof(segment->segname)) == 0)
            {
                slide = reinterpret_cast<std::uintptr_t>(header) - segment->vmaddr;
                foundText = true;
                break;
            }
        }
        command = reinterpret_cast<const load_command *>(reinterpret_cast<const uint8_t *>(command) +
                                                          command->cmdsize);
    }
    if (!foundText)
    {
        return false;
    }

    command = reinterpret_cast<const load_command *>(header + 1);
    for (uint32_t index = 0; index < header->ncmds; index++)
    {
        if (command->cmd == LC_SEGMENT_64)
        {
            const auto *segment = reinterpret_cast<const segment_command_64 *>(command);
            if ((segment->initprot & VM_PROT_EXECUTE) != 0)
            {
                const auto *sections = reinterpret_cast<const section_64 *>(segment + 1);
                for (uint32_t sectionIndex = 0; sectionIndex < segment->nsects; sectionIndex++)
                {
                    const auto &section = sections[sectionIndex];
                    if ((section.flags & (S_ATTR_PURE_INSTRUCTIONS | S_ATTR_SOME_INSTRUCTIONS)) !=
                            0 &&
                        addressWithinRegion(reinterpret_cast<std::uintptr_t>(address),
                                            section.addr + slide, section.size))
                    {
                        return true;
                    }
                }
            }
        }
        command = reinterpret_cast<const load_command *>(reinterpret_cast<const uint8_t *>(command) +
                                                          command->cmdsize);
    }
    return false;
}

static bool isExecutableAddress(void *address)
{
    if (!address)
    {
        return false;
    }

    void *regionAddress = address;
#if __has_feature(ptrauth_calls)
    regionAddress = ptrauth_strip(address, ptrauth_key_function_pointer);
#endif
    vm_address_t target = reinterpret_cast<vm_address_t>(regionAddress);
    natural_t depth = 0;
    for (unsigned int attempt = 0; attempt < 16; attempt++)
    {
        vm_address_t region = target;
        vm_size_t size = 0;
        vm_region_submap_short_info_data_64_t info{};
        mach_msg_type_number_t count = VM_REGION_SUBMAP_SHORT_INFO_COUNT_64;
        kern_return_t result = vm_region_recurse_64(
            mach_task_self(), &region, &size, &depth,
            reinterpret_cast<vm_region_recurse_info_t>(&info), &count);
        if (result != KERN_SUCCESS || !addressWithinRegion(target, region, size))
        {
            return false;
        }
        if (!info.is_submap)
        {
            return (info.protection & VM_PROT_EXECUTE) != 0;
        }
        depth++;
    }
    return false;
}

static bool isCallableSymbolAddress(void *address)
{
    return isExecutableAddress(address) && isInstructionSectionAddress(address);
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

static Value pointerResult(Runtime &runtime, void *pointer, bool callable = false)
{
    if (!pointer)
    {
        return Value::null();
    }

    return Object::createFromHostObject(runtime, std::make_shared<PointerHost>(pointer, callable));
}

struct ConversionState
{
    NativeConversionBudget budget;
    std::vector<const void *> nativePath;
    std::vector<Object> javascriptPath;

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

    void ensureEntries(Runtime &runtime, size_t count)
    {
        if (!budget.reserveEntries(count))
        {
            throw JSError(runtime, "Native value exceeds conversion limits");
        }
    }
};

struct ConversionGuard
{
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

struct NativeConversionVisit
{
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

struct JavaScriptConversionVisit
{
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
        state.addBytes(runtime, [(NSString *) value lengthOfBytesUsingEncoding:NSUTF8StringEncoding]);
        return [JSI fromObjC:value runtime:runtime];
    }

    if ([value isKindOfClass:[NSNumber class]])
    {
        NSNumber *number = (NSNumber *) value;
        const char *type = number.objCType;
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
        return [JSI fromObjC:value runtime:runtime];
    }

    if ([value isKindOfClass:[NSData class]])
    {
        state.addBytes(runtime, [(NSData *) value length]);
        auto data = std::make_shared<NativeDataBuffer>((NSData *) value);
        ArrayBuffer buffer(runtime, data);
        return Uint8Array(runtime, buffer, 0, buffer.size(runtime));
    }

    if ([value isKindOfClass:[NSArray class]])
    {
        NativeConversionVisit visit(runtime, state, value);
        NSArray *array = (NSArray *) value;
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
        NSDictionary *dictionary = (NSDictionary *) value;
        state.ensureEntries(runtime, dictionary.count);
        Object result(runtime);
        for (id key in dictionary)
        {
            if (![key isKindOfClass:[NSString class]])
            {
                continue;
            }
            state.addBytes(runtime, [(NSString *) key lengthOfBytesUsingEncoding:NSUTF8StringEncoding]);
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
        NSString *string = [JSI toNSString:value runtime:runtime];
        state.addBytes(runtime, [string lengthOfBytesUsingEncoding:NSUTF8StringEncoding]);
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
        Array array = object.asArray(runtime);
        size_t count = array.size(runtime);
        state.ensureEntries(runtime, count);
        NSMutableArray *result = [NSMutableArray arrayWithCapacity:count];
        for (size_t index = 0; index < count; index++)
        {
            [result addObject:valueToObjCValue(runtime, array.getValueAtIndex(runtime, index), state) ?: [NSNull null]];
        }
        return result;
    }

    JavaScriptConversionVisit visit(runtime, state, value);
    NSMutableDictionary *result = [NSMutableDictionary dictionary];
    Array names = object.getPropertyNames(runtime);
    size_t count = names.size(runtime);
    state.ensureEntries(runtime, count);
    for (size_t index = 0; index < count; index++)
    {
        Value name = names.getValueAtIndex(runtime, index);
        if (!name.isString())
        {
            continue;
        }

        NSString *key = [JSI toNSString:name runtime:runtime];
        if (key.length == 0)
        {
            continue;
        }

        state.addBytes(runtime, [key lengthOfBytesUsingEncoding:NSUTF8StringEncoding]);
        id item = valueToObjCValue(runtime, object.getProperty(runtime, key.UTF8String), state);
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

static std::shared_ptr<FabricSurfaceHost> fabricSurfaceHost(Runtime &runtime, const Value &value)
{
    if (!value.isObject())
    {
        throw JSError(runtime, "fabric surface handle is invalid");
    }

    Object object = value.asObject(runtime);
    if (!object.isHostObject<FabricSurfaceHost>(runtime))
    {
        throw JSError(runtime, "fabric surface handle is invalid");
    }

    return object.getHostObject<FabricSurfaceHost>(runtime);
}

static NSDictionary *fabricProperties(Runtime &runtime, const Value *value)
{
    if (!value || value->isNull() || value->isUndefined())
    {
        return @{};
    }

    id object = valueToObjC(runtime, *value);
    if (![object isKindOfClass:[NSDictionary class]])
    {
        throw JSError(runtime, "fabric surface properties must be an object");
    }

    return object;
}

static double fabricNumber(Runtime &runtime, Object &object, const char *name)
{
    Value value = object.getProperty(runtime, name);
    if (!value.isNumber())
    {
        throw JSError(runtime, "fabric dimensions must be numbers");
    }
    return value.asNumber();
}

static CGSize fabricSize(Runtime &runtime, const Value &value)
{
    if (!value.isObject())
    {
        throw JSError(runtime, "fabric size must be an object");
    }

    Object object = value.asObject(runtime);
    return CGSizeMake(fabricNumber(runtime, object, "width"),
                      fabricNumber(runtime, object, "height"));
}

static CGRect fabricFrame(Runtime &runtime, const Value &value)
{
    if (!value.isObject())
    {
        throw JSError(runtime, "fabric frame must be an object");
    }

    Object object = value.asObject(runtime);
    return CGRectMake(fabricNumber(runtime, object, "x"), fabricNumber(runtime, object, "y"),
                      fabricNumber(runtime, object, "width"),
                      fabricNumber(runtime, object, "height"));
}

static void fabricStart(id surface)
{
    using Function = void (*)(id, SEL);
    ((Function)objc_msgSend)(surface, @selector(start));
}

static void fabricStop(id surface)
{
    using Function = void (*)(id, SEL);
    ((Function)objc_msgSend)(surface, @selector(stop));
}

static UIView *fabricView(id surface)
{
    using Function = UIView *(*)(id, SEL);
    return ((Function)objc_msgSend)(surface, @selector(view));
}

static void fabricSetProps(id surface, NSDictionary *properties)
{
    using Function = void (*)(id, SEL, NSDictionary *);
    ((Function)objc_msgSend)(surface, @selector(setProps:), properties);
}

static void fabricSetMinimumSize(id surface, CGSize minimumSize, CGSize maximumSize)
{
    using Function = void (*)(id, SEL, CGSize, CGSize);
    ((Function)objc_msgSend)(surface, @selector(setMinimumSize:maximumSize:), minimumSize,
                             maximumSize);
}

static void fabricMountNative(id host, UIView *containerView, NSString *moduleName,
                              NSDictionary *properties,
                              const std::shared_ptr<FabricSurfaceHost> &surfaceHost,
                              uint64_t generation)
{
    NativeOperationSignpost signpost("fabric mount");
    if (generation != loader::native::runtimeGeneration())
    {
        throw std::runtime_error("Fabric runtime was replaced before mounting");
    }
    if (![host respondsToSelector:@selector(createSurfaceWithModuleName:mode:initialProperties:)])
    {
        throw std::runtime_error("Fabric host does not expose surface creation");
    }
    id surface = [host createSurfaceWithModuleName:moduleName mode:0 initialProperties:properties];
    if (!surface)
    {
        throw std::runtime_error("Fabric host could not create the requested surface");
    }
    if (![surface respondsToSelector:@selector(start)] ||
        ![surface respondsToSelector:@selector(view)])
    {
        throw std::runtime_error("Fabric surface does not expose start and view");
    }

    fabricStart(surface);
    UIView *view = fabricView(surface);
    if (!view)
    {
        fabricStop(surface);
        throw std::runtime_error("Fabric surface did not create a view");
    }

    FabricContainer *surfaceContainer = [[FabricContainer alloc] initWithFrame:containerView.bounds];
    surfaceContainer.clipsToBounds = NO;
    surfaceContainer.autoresizingMask =
        UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    surfaceContainer.surfaceView = view;
    view.frame = surfaceContainer.bounds;
    view.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    [surfaceContainer addSubview:view];
    [containerView addSubview:surfaceContainer];
    [surfaceContainer setNeedsLayout];
    [surfaceContainer layoutIfNeeded];
    surfaceHost->setSurface(surface, surfaceContainer, view, generation);
    bool replaced = false;
    {
        std::lock_guard<std::mutex> lock(gFabricSurfaceMutex);
        replaced = generation != loader::native::runtimeGeneration();
        if (!replaced) gFabricSurfaces[surfaceHost.get()] = surfaceHost;
    }
    if (replaced)
    {
        [surfaceContainer removeFromSuperview];
        fabricStop(surface);
        surfaceHost->clear();
        throw std::runtime_error("Fabric runtime was replaced while mounting");
    }
}

static Value fabricMount(Runtime &runtime, const Value *args, size_t count)
{
    if (count < 2 || !args[1].isString())
    {
        throw JSError(runtime, "fabric.mount expects a container and module name");
    }

    id container = objcValue(runtime, args[0]);
    if (![container isKindOfClass:[UIView class]])
    {
        throw JSError(runtime, "fabric.mount expects a UIView container");
    }

    id host = gFabricHostInstance;
    if (!host)
    {
        throw JSError(runtime, "Fabric host is unavailable");
    }

    NSString *moduleName = [JSI toNSString:args[1] runtime:runtime];
    NSDictionary *properties = fabricProperties(runtime, count > 2 ? &args[2] : nullptr);
    auto surfaceHost = std::make_shared<FabricSurfaceHost>();
    uint64_t generation = loader::native::runtimeGeneration();

    executeMainSynchronously([host, container, moduleName, properties, surfaceHost, generation]() {
        fabricMountNative(host, (UIView *) container, moduleName, properties, surfaceHost,
                          generation);
    });

    return Object::createFromHostObject(runtime, std::move(surfaceHost));
}

static Value fabricMountAsync(Runtime &runtime, const Value *args, size_t count)
{
    if (count < 2 || !args[1].isString())
    {
        throw JSError(runtime, "fabric.mountAsync expects a container and module name");
    }
    id container = objcValue(runtime, args[0]);
    if (![container isKindOfClass:[UIView class]])
    {
        throw JSError(runtime, "fabric.mountAsync expects a UIView container");
    }
    id host = gFabricHostInstance;
    if (!host)
    {
        throw JSError(runtime, "Fabric host is unavailable");
    }

    NSString *moduleName = [JSI toNSString:args[1] runtime:runtime];
    NSDictionary *properties = fabricProperties(runtime, count > 2 ? &args[2] : nullptr);
    auto surfaceHost = std::make_shared<FabricSurfaceHost>();
    uint64_t generation = loader::native::runtimeGeneration();
    return executeMainAsynchronously(
        runtime,
        [host, container, moduleName, properties, surfaceHost, generation]() {
            fabricMountNative(host, (UIView *) container, moduleName, properties, surfaceHost,
                              generation);
        },
        [surfaceHost](Runtime &completionRuntime) {
            return Value(Object::createFromHostObject(completionRuntime, surfaceHost));
        });
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
        surfaceView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
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

static void invalidateRuntimeFabricSurfaces(uint64_t generation)
{
    std::vector<std::shared_ptr<FabricSurfaceHost>> stale;
    {
        std::lock_guard<std::mutex> lock(gFabricSurfaceMutex);
        for (auto iterator = gFabricSurfaces.begin(); iterator != gFabricSurfaces.end();)
        {
            if (iterator->second->generation() >= generation)
            {
                ++iterator;
                continue;
            }
            stale.push_back(iterator->second);
            iterator = gFabricSurfaces.erase(iterator);
        }
    }
    if (stale.empty()) return;
    dispatch_async(dispatch_get_main_queue(), ^{
        @autoreleasepool
        {
            for (const auto &surfaceHost : stale)
            {
                if (!surfaceHost->active()) continue;
                @try
                {
                    fabricUnmountNative(surfaceHost->surface(), surfaceHost->view());
                }
                @catch (NSException *exception)
                {
                    [Logger error:LOG_CATEGORY_PLUGINS
                            format:@"Failed to release a stale Fabric surface: %@", exception.reason];
                }
                surfaceHost->clear();
            }
        }
    });
}

static Value fabricUpdate(Runtime &runtime, const Value *args, size_t count)
{
    if (count < 2)
    {
        throw JSError(runtime, "fabric.update expects a surface and properties");
    }

    std::shared_ptr<FabricSurfaceHost> surfaceHost = fabricSurfaceHost(runtime, args[0]);
    NSDictionary *properties = fabricProperties(runtime, &args[1]);
    id surface = surfaceHost->surface();
    if (!surfaceHost->active() || !surface)
    {
        return Value::undefined();
    }

    executeMainSynchronously([surface, properties]() { fabricUpdateNative(surface, properties); });
    return Value::undefined();
}

static Value fabricSetSize(Runtime &runtime, const Value *args, size_t count)
{
    if (count < 3)
    {
        throw JSError(runtime, "fabric.setSize expects a surface, minimum size, and maximum size");
    }

    std::shared_ptr<FabricSurfaceHost> surfaceHost = fabricSurfaceHost(runtime, args[0]);
    CGSize minimumSize = fabricSize(runtime, args[1]);
    CGSize maximumSize = fabricSize(runtime, args[2]);
    id surface = surfaceHost->surface();
    if (!surfaceHost->active() || !surface)
    {
        return Value::undefined();
    }

    executeMainSynchronously([surface, minimumSize, maximumSize]() {
        fabricSetSizeNative(surface, minimumSize, maximumSize);
    });
    return Value::undefined();
}

static Value fabricSetFrame(Runtime &runtime, const Value *args, size_t count)
{
    if (count < 2)
    {
        throw JSError(runtime, "fabric.setFrame expects a surface and frame");
    }

    std::shared_ptr<FabricSurfaceHost> surfaceHost = fabricSurfaceHost(runtime, args[0]);
    CGRect frame = fabricFrame(runtime, args[1]);
    UIView *view = surfaceHost->view();
    UIView *surfaceView = surfaceHost->surfaceView();
    if (!surfaceHost->active() || !view)
    {
        return Value::undefined();
    }

    executeMainSynchronously([view, surfaceView, frame]() {
        fabricSetFrameNative(view, surfaceView, frame);
    });
    return Value::undefined();
}

static Value fabricMeasure(Runtime &runtime, const Value *args, size_t count)
{
    if (count == 0)
    {
        throw JSError(runtime, "fabric.measure expects a UIView");
    }

    id object = objcValue(runtime, args[0]);
    if (![object isKindOfClass:[UIView class]])
    {
        throw JSError(runtime, "fabric.measure expects a UIView");
    }

    auto frame = std::make_shared<CGRect>(CGRectZero);
    executeMainSynchronously([object, frame]() { *frame = [(UIView *) object frame]; });

    Object result(runtime);
    result.setProperty(runtime, "x", frame->origin.x);
    result.setProperty(runtime, "y", frame->origin.y);
    result.setProperty(runtime, "width", frame->size.width);
    result.setProperty(runtime, "height", frame->size.height);
    return result;
}

static Value fabricUnmount(Runtime &runtime, const Value *args, size_t count)
{
    if (count == 0)
    {
        throw JSError(runtime, "fabric.unmount expects a surface");
    }

    std::shared_ptr<FabricSurfaceHost> surfaceHost = fabricSurfaceHost(runtime, args[0]);
    id surface = surfaceHost->surface();
    UIView *view = surfaceHost->view();
    if (!surfaceHost->active())
    {
        return Value::undefined();
    }

    executeMainSynchronously([surface, view]() { fabricUnmountNative(surface, view); });
    surfaceHost->clear();
    {
        std::lock_guard<std::mutex> lock(gFabricSurfaceMutex);
        gFabricSurfaces.erase(surfaceHost.get());
    }
    return Value::undefined();
}

static Value fabricVoidResult(Runtime &)
{
    return Value::undefined();
}

static Value fabricUpdateAsync(Runtime &runtime, const Value *args, size_t count)
{
    if (count < 2)
    {
        throw JSError(runtime, "fabric.updateAsync expects a surface and properties");
    }
    auto surfaceHost = fabricSurfaceHost(runtime, args[0]);
    NSDictionary *properties = fabricProperties(runtime, &args[1]);
    return executeMainAsynchronously(
        runtime,
        [surfaceHost, properties]() {
            if (surfaceHost->active()) fabricUpdateNative(surfaceHost->surface(), properties);
        },
        fabricVoidResult);
}

static Value fabricSetSizeAsync(Runtime &runtime, const Value *args, size_t count)
{
    if (count < 3)
    {
        throw JSError(runtime, "fabric.setSizeAsync expects a surface, minimum size, and maximum size");
    }
    auto surfaceHost = fabricSurfaceHost(runtime, args[0]);
    CGSize minimumSize = fabricSize(runtime, args[1]);
    CGSize maximumSize = fabricSize(runtime, args[2]);
    return executeMainAsynchronously(
        runtime,
        [surfaceHost, minimumSize, maximumSize]() {
            if (surfaceHost->active())
            {
                fabricSetSizeNative(surfaceHost->surface(), minimumSize, maximumSize);
            }
        },
        fabricVoidResult);
}

static Value fabricSetFrameAsync(Runtime &runtime, const Value *args, size_t count)
{
    if (count < 2)
    {
        throw JSError(runtime, "fabric.setFrameAsync expects a surface and frame");
    }
    auto surfaceHost = fabricSurfaceHost(runtime, args[0]);
    CGRect frame = fabricFrame(runtime, args[1]);
    return executeMainAsynchronously(
        runtime,
        [surfaceHost, frame]() {
            if (surfaceHost->active())
            {
                fabricSetFrameNative(surfaceHost->view(), surfaceHost->surfaceView(), frame);
            }
        },
        fabricVoidResult);
}

static Value fabricMeasureAsync(Runtime &runtime, const Value *args, size_t count)
{
    if (count == 0)
    {
        throw JSError(runtime, "fabric.measureAsync expects a UIView");
    }
    id object = objcValue(runtime, args[0]);
    if (![object isKindOfClass:[UIView class]])
    {
        throw JSError(runtime, "fabric.measureAsync expects a UIView");
    }
    auto frame = std::make_shared<CGRect>(CGRectZero);
    return executeMainAsynchronously(
        runtime,
        [object, frame]() { *frame = [(UIView *) object frame]; },
        [frame](Runtime &completionRuntime) {
            Object result(completionRuntime);
            result.setProperty(completionRuntime, "x", frame->origin.x);
            result.setProperty(completionRuntime, "y", frame->origin.y);
            result.setProperty(completionRuntime, "width", frame->size.width);
            result.setProperty(completionRuntime, "height", frame->size.height);
            return Value(std::move(result));
        });
}

static Value fabricUnmountAsync(Runtime &runtime, const Value *args, size_t count)
{
    if (count == 0)
    {
        throw JSError(runtime, "fabric.unmountAsync expects a surface");
    }
    auto surfaceHost = fabricSurfaceHost(runtime, args[0]);
    return executeMainAsynchronously(
        runtime,
        [surfaceHost]() {
            if (!surfaceHost->active()) return;
            fabricUnmountNative(surfaceHost->surface(), surfaceHost->view());
            surfaceHost->clear();
            std::lock_guard<std::mutex> lock(gFabricSurfaceMutex);
            gFabricSurfaces.erase(surfaceHost.get());
        },
        fabricVoidResult);
}

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
        TypedArray array = object.getTypedArray(runtime);
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
    if (!fields.isObject())
    {
        throw JSError(runtime, "Native struct fields must be an object");
    }

    Object object = fields.asObject(runtime);
    if ([name isEqualToString:@"NSRange"])
    {
        NSRange range = NSMakeRange((NSUInteger) object.getProperty(runtime, "location").asNumber(),
                                    (NSUInteger) object.getProperty(runtime, "length").asNumber());
        return structResult(runtime, name, [NSValue valueWithRange:range]);
    }
    if ([name isEqualToString:@"CGPoint"])
    {
        CGPoint point = CGPointMake(object.getProperty(runtime, "x").asNumber(),
                                    object.getProperty(runtime, "y").asNumber());
        return structResult(runtime, name, [NSValue valueWithCGPoint:point]);
    }
    if ([name isEqualToString:@"CGSize"])
    {
        CGSize size = CGSizeMake(object.getProperty(runtime, "width").asNumber(),
                                 object.getProperty(runtime, "height").asNumber());
        return structResult(runtime, name, [NSValue valueWithCGSize:size]);
    }
    if ([name isEqualToString:@"CGRect"])
    {
        Object origin = object.getPropertyAsObject(runtime, "origin");
        Object size = object.getPropertyAsObject(runtime, "size");
        CGRect rect = CGRectMake(origin.getProperty(runtime, "x").asNumber(),
                                 origin.getProperty(runtime, "y").asNumber(),
                                 size.getProperty(runtime, "width").asNumber(),
                                 size.getProperty(runtime, "height").asNumber());
        return structResult(runtime, name, [NSValue valueWithCGRect:rect]);
    }
    if ([name isEqualToString:@"UIEdgeInsets"])
    {
        UIEdgeInsets insets = UIEdgeInsetsMake(object.getProperty(runtime, "top").asNumber(),
                                               object.getProperty(runtime, "left").asNumber(),
                                               object.getProperty(runtime, "bottom").asNumber(),
                                               object.getProperty(runtime, "right").asNumber());
        return structResult(runtime, name, [NSValue valueWithUIEdgeInsets:insets]);
    }
    if ([name isEqualToString:@"CGAffineTransform"])
    {
        CGAffineTransform transform = CGAffineTransformMake(object.getProperty(runtime, "a").asNumber(),
                                                            object.getProperty(runtime, "b").asNumber(),
                                                            object.getProperty(runtime, "c").asNumber(),
                                                            object.getProperty(runtime, "d").asNumber(),
                                                            object.getProperty(runtime, "tx").asNumber(),
                                                            object.getProperty(runtime, "ty").asNumber());
        return structResult(runtime, name, [NSValue valueWithCGAffineTransform:transform]);
    }

    throw JSError(runtime, "Unsupported native struct");
}

static Value returnValue(Runtime &runtime, NSInvocation *invocation, NSMethodSignature *signature)
{
    std::string name = nativeFFITypeName(signature.methodReturnType);
    if (name.empty()) throw JSError(runtime, "Unsupported native return type");
    if (name == "void") return Value::undefined();

    NSUInteger length = signature.methodReturnLength;
    if (length == 0 || length > 4096)
    {
        throw JSError(runtime, "Native return value has an invalid size");
    }

    std::vector<uint8_t> bytes(length);
    [invocation getReturnValue:bytes.data()];
    return ffiResult(runtime, ffiType(runtime, name), bytes);
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
        if (raw == 0 || raw == 1) return;
        throw std::runtime_error("Native boolean argument is invalid");
    }
    const char *numberType = number.objCType;
    bool signedInteger = strcmp(numberType, @encode(long long)) == 0 ||
                         strcmp(numberType, @encode(long)) == 0;
    bool unsignedInteger = strcmp(numberType, @encode(unsigned long long)) == 0 ||
                           strcmp(numberType, @encode(unsigned long)) == 0;
    if (type == "i64")
    {
        if (signedInteger ||
            (unsignedInteger && number.unsignedLongLongValue <= INT64_MAX)) return;
    }
    if (type == "u64")
    {
        if (unsignedInteger || (signedInteger && number.longLongValue >= 0)) return;
    }
    if (!validNativeNumericValue(number.doubleValue, type))
    {
        throw std::runtime_error("Native scalar argument is out of range");
    }
}

static bool isNativeScalarType(const std::string &type)
{
    return type == "bool" || type == "float" || type == "double" ||
           type == "i8" || type == "u8" || type == "i16" ||
           type == "u16" || type == "i32" || type == "u32" ||
           type == "i64" || type == "u64";
}

static void setInvocationArgument(NSInvocation *invocation, NSMethodSignature *signature,
                                  id object, NSUInteger index, std::vector<id> &retained,
                                  std::vector<std::vector<uint8_t>> &storage)
{
    const char *type = [signature getArgumentTypeAtIndex:index];
    char code = normalizedType(type);
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
            argument = (__bridge id) [(NSValue *) object pointerValue];
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
            argument = (SEL) [(NSValue *) object pointerValue];
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
        float argument = [object respondsToSelector:@selector(floatValue)] ? [object floatValue] : 0;
        [invocation setArgument:&argument atIndex:index];
        return;
    }

    if (code == 'd')
    {
        double argument = [object respondsToSelector:@selector(doubleValue)] ? [object doubleValue] : 0;
        [invocation setArgument:&argument atIndex:index];
        return;
    }

    if (code == 'q')
    {
        long long argument = [object respondsToSelector:@selector(longLongValue)] ? [object longLongValue] : 0;
        [invocation setArgument:&argument atIndex:index];
        return;
    }

    if (code == 'Q')
    {
        unsigned long long argument =
            [object respondsToSelector:@selector(unsignedLongLongValue)] ? [object unsignedLongLongValue] : 0;
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
        uint8_t argument = [object respondsToSelector:@selector(unsignedCharValue)] ? [object unsignedCharValue] : 0;
        storage.emplace_back(sizeof(argument));
        memcpy(storage.back().data(), &argument, sizeof(argument));
        [invocation setArgument:storage.back().data() atIndex:index];
        return;
    }

    if (code == 's')
    {
        int16_t argument = [object respondsToSelector:@selector(shortValue)] ? [object shortValue] : 0;
        storage.emplace_back(sizeof(argument));
        memcpy(storage.back().data(), &argument, sizeof(argument));
        [invocation setArgument:storage.back().data() atIndex:index];
        return;
    }

    if (code == 'S')
    {
        uint16_t argument = [object respondsToSelector:@selector(unsignedShortValue)] ? [object unsignedShortValue] : 0;
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
        uint32_t argument = [object respondsToSelector:@selector(unsignedIntValue)] ? [object unsignedIntValue] : 0;
        storage.emplace_back(sizeof(argument));
        memcpy(storage.back().data(), &argument, sizeof(argument));
        [invocation setArgument:storage.back().data() atIndex:index];
        return;
    }

    if (code == 'l' || code == 'q')
    {
        int64_t argument = [object respondsToSelector:@selector(longLongValue)] ? [object longLongValue] : 0;
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

        NSValue *structValue = (NSValue *) object;
        NSUInteger size = 0;
        NSUInteger alignment = 0;
        NSGetSizeAndAlignment(type, &size, &alignment);
        storage.emplace_back(size);
        [structValue getValue:storage.back().data() size:size];
        [invocation setArgument:storage.back().data() atIndex:index];
        return;
    }

    throw std::runtime_error("Unsupported native argument type");
}

static NSInvocation *prepareInvocation(id target, SEL selector,
                                       NSArray *arguments)
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
    invocation.target = target;
    invocation.selector = selector;

    std::vector<id> retained;
    std::vector<std::vector<uint8_t>> storage;
    retained.reserve(arguments.count);
    storage.reserve(arguments.count);

    for (NSUInteger index = 0; index < arguments.count; index++)
    {
        setInvocationArgument(invocation, signature, arguments[index], index + 2, retained, storage);
    }

    [invocation retainArguments];
    NSMutableArray *backingArguments = [NSMutableArray arrayWithCapacity:retained.size()];
    for (id argument : retained)
    {
        if (argument) [backingArguments addObject:argument];
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

static void setSuperFFIArgument(Runtime &runtime, const char *encoding, id object,
                                 FFICallArgument &argument, std::vector<id> &retained)
{
    std::string scalarType = nativeFFITypeName(encoding);
    if (isNativeScalarType(scalarType))
    {
        validateNativeScalarArgument(object, scalarType);
    }
    char code = normalizedType(encoding);
    id value = object == [NSNull null] ? @0 : object;
    if (code == '@' || code == '#')
    {
        id retainedValue = object == [NSNull null] ? nil : object;
        retained.push_back(retainedValue);
        argument.pointer = (__bridge void *) retainedValue;
        return;
    }
    if (code == ':')
    {
        if ([value isKindOfClass:[NSString class]])
        {
            argument.pointer = (void *) sel_registerName([(NSString *) value UTF8String]);
        }
        else if ([value isKindOfClass:[NSValue class]])
        {
            argument.pointer = [(NSValue *) value pointerValue];
        }
        return;
    }
    if (code == '^' || code == '*')
    {
        if (code == '*' && [value isKindOfClass:[NSString class]])
        {
            argument.string = [(NSString *) value UTF8String] ?: "";
            argument.pointer = (void *) argument.string.c_str();
        }
        else if ([value isKindOfClass:[NSValue class]])
        {
            argument.pointer = [(NSValue *) value pointerValue];
        }
        return;
    }
    if (code == 'B')
    {
        bool scalar = [value boolValue];
        argument.bytes.resize(sizeof(scalar));
        memcpy(argument.bytes.data(), &scalar, sizeof(scalar));
        return;
    }
    if (code == 'c' || code == 'C')
    {
        uint8_t scalar = code == 'c' ? (uint8_t) [value charValue] : [value unsignedCharValue];
        argument.bytes.resize(sizeof(scalar));
        memcpy(argument.bytes.data(), &scalar, sizeof(scalar));
        return;
    }
    if (code == 's' || code == 'S')
    {
        uint16_t scalar = code == 's' ? (uint16_t) [value shortValue] : [value unsignedShortValue];
        argument.bytes.resize(sizeof(scalar));
        memcpy(argument.bytes.data(), &scalar, sizeof(scalar));
        return;
    }
    if (code == 'i' || code == 'I')
    {
        uint32_t scalar = code == 'i' ? (uint32_t) [value intValue] : [value unsignedIntValue];
        argument.bytes.resize(sizeof(scalar));
        memcpy(argument.bytes.data(), &scalar, sizeof(scalar));
        return;
    }
    if (code == 'l' || code == 'L' || code == 'q' || code == 'Q')
    {
        uint64_t scalar = code == 'l' || code == 'q' ? (uint64_t) [value longLongValue]
                                                       : [value unsignedLongLongValue];
        argument.bytes.resize(sizeof(scalar));
        memcpy(argument.bytes.data(), &scalar, sizeof(scalar));
        return;
    }
    if (code == 'f')
    {
        float scalar = [value floatValue];
        argument.bytes.resize(sizeof(scalar));
        memcpy(argument.bytes.data(), &scalar, sizeof(scalar));
        return;
    }
    if (code == 'd')
    {
        double scalar = [value doubleValue];
        argument.bytes.resize(sizeof(scalar));
        memcpy(argument.bytes.data(), &scalar, sizeof(scalar));
        return;
    }
    if (code == '{')
    {
        NSUInteger size = 0;
        NSUInteger alignment = 0;
        NSGetSizeAndAlignment(encoding, &size, &alignment);
        if (![value isKindOfClass:[NSValue class]])
        {
            throw JSError(runtime, "Native super struct argument expected");
        }
        argument.bytes.resize(size);
        [(NSValue *) value getValue:argument.bytes.data() size:size];
        return;
    }
    throw JSError(runtime, "Unsupported native super argument type");
}

static Value invokeSuperObject(Runtime &runtime, id target, Class currentClass, SEL selector,
                               NSArray *arguments)
{
    if (!target || !currentClass || !selector)
    {
        throw JSError(runtime, "Invalid native Objective-C super target");
    }

    Class superclass = class_getSuperclass(currentClass);
    Method method = superclass ? class_getInstanceMethod(superclass, selector) : NULL;
    if (!method)
    {
        throw JSError(runtime, "Objective-C super selector is not available");
    }

    NSMethodSignature *signature = [NSMethodSignature signatureWithObjCTypes:method_getTypeEncoding(method)];
    NSUInteger expected = signature.numberOfArguments >= 2 ? signature.numberOfArguments - 2 : 0;
    if (expected != arguments.count)
    {
        throw JSError(runtime, "Objective-C super argument count does not match the method signature");
    }

    std::vector<FFITypeSpec> types;
    std::vector<FFICallArgument> values(arguments.count + 2);
    std::vector<void *> argumentValues(arguments.count + 2);
    std::vector<id> retained;
    types.reserve(arguments.count);
    retained.reserve(arguments.count);

    struct objc_super superInfo = {target, currentClass};
    values[0].pointer = &superInfo;
    values[1].pointer = selector;
    argumentValues[0] = &values[0].pointer;
    argumentValues[1] = &values[1].pointer;

    for (NSUInteger index = 0; index < arguments.count; index++)
    {
        const char *encoding = [signature getArgumentTypeAtIndex:index + 2];
        std::string name = nativeFFITypeName(encoding);
        if (name.empty())
        {
            throw JSError(runtime, "Unsupported native super argument type encoding");
        }
        types.push_back(ffiType(runtime, name));
        setSuperFFIArgument(runtime, encoding, arguments[index], values[index + 2], retained);
        if (name == "object" || name == "class" || name == "selector" || name == "pointer")
        {
            argumentValues[index + 2] = &values[index + 2].pointer;
        }
        else
        {
            argumentValues[index + 2] = values[index + 2].bytes.data();
        }
    }

    std::string resultName = nativeFFITypeName(signature.methodReturnType);
    if (resultName.empty())
    {
        throw JSError(runtime, "Unsupported native super return type encoding");
    }
    FFITypeSpec result = ffiType(runtime, resultName);
    std::vector<FFITypeSpec> cifArguments;
    cifArguments.reserve(types.size() + 2);
    cifArguments.push_back({"pointer", &ffi_type_pointer});
    cifArguments.push_back({"selector", &ffi_type_pointer});
    cifArguments.insert(cifArguments.end(), types.begin(), types.end());
    ffi_cif cif = prepareFFICif(runtime, result, cifArguments);

    std::vector<uint8_t> output(std::max<size_t>(result.type->size, sizeof(void *)));
    ffi_call(&cif, reinterpret_cast<void (*)(void)>(objc_msgSendSuper),
             resultName == "void" ? nullptr : output.data(), argumentValues.data());
    return ffiResult(runtime, result, output);
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
            policy = [JSI toNSString:thread runtime:runtime].UTF8String;
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
        throwWrongThread(runtime, "Objective-C invocation cannot synchronously cross to a waiting main thread");
    }

    NSInvocation *invocation = prepareInvocation(target, selector, arguments);
    __strong id retainedResult = nil;
    NSException *failure = nil;
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
    __strong id value = nil;
    NSInteger resultIndex = -1;
};

struct NativeBatchStep {
    __strong id target = nil;
    NSInteger targetResultIndex = -1;
    __strong NSString *selector = nil;
    std::vector<NativeBatchArgument> arguments;
};

static NSInteger batchResultIndex(Runtime &runtime, const Value &value, size_t stepIndex)
{
    if (!value.isObject())
    {
        return -1;
    }
    Object object = value.asObject(runtime);
    Value reference = object.getProperty(runtime, "$nativeBatchResult");
    if (reference.isUndefined())
    {
        return -1;
    }
    if (!reference.isNumber())
    {
        throw JSError(runtime, "Native batch result index must be an integer");
    }
    double index = reference.getNumber();
    if (!(index >= 0 && index < stepIndex) || static_cast<double>(static_cast<size_t>(index)) != index)
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
        if (value == [NSNull null] || object_isClass(value)) return;
        throw std::runtime_error("Native batch class argument is invalid");
    }
    if (type == "selector")
    {
        if (value == [NSNull null] || [value isKindOfClass:[NSString class]]) return;
        throw std::runtime_error("Native batch selector argument is invalid");
    }
    if (type == "pointer")
    {
        if (value == [NSNull null] ||
            ([value isKindOfClass:[NSValue class]] &&
             strncmp([(NSValue *) value objCType], "^", 1) == 0) ||
            (normalizedType(encoding) == '*' && [value isKindOfClass:[NSString class]])) return;
        throw std::runtime_error("Native batch pointer argument is invalid");
    }
    if (type.starts_with("struct:"))
    {
        if ([value isKindOfClass:[NSValue class]] &&
            nativeFFITypeName([(NSValue *) value objCType]) == type) return;
        throw std::runtime_error("Native batch struct argument has the wrong layout");
    }
    validateNativeScalarArgument(value, type);
}

static id batchNativeResult(NSInvocation *invocation)
{
    NSMethodSignature *signature = invocation.methodSignature;
    const char *type = signature.methodReturnType;
    char code = normalizedType(type);
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
    if (input.size(runtime) > 64)
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
        Object stepObject = rawStep.asObject(runtime);
        Value rawTarget = stepObject.getProperty(runtime, "target");
        Value rawSelector = stepObject.getProperty(runtime, "selector");
        Value rawArguments = stepObject.getProperty(runtime, "args");
        if (!rawSelector.isString() || !rawArguments.isObject() ||
            !rawArguments.asObject(runtime).isArray(runtime))
        {
            throw JSError(runtime, "Native batch step is malformed");
        }
        Array arguments = rawArguments.asObject(runtime).asArray(runtime);
        NSString *selector = [JSI toNSString:rawSelector runtime:runtime];
        if (selector.length > 256 || arguments.size(runtime) > 16)
        {
            throw JSError(runtime, "Native batch step exceeds its limits");
        }

        NativeBatchStep step;
        step.targetResultIndex = batchResultIndex(runtime, rawTarget, index);
        step.target = step.targetResultIndex >= 0 ? nil : objcValue(runtime, rawTarget);
        if (step.targetResultIndex < 0 && !step.target)
        {
            throw JSError(runtime, "Native batch target is not an object handle");
        }
        step.selector = selector;
        step.arguments.reserve(arguments.size(runtime));
        for (size_t argumentIndex = 0; argumentIndex < arguments.size(runtime); argumentIndex++)
        {
            Value rawArgument = arguments.getValueAtIndex(runtime, argumentIndex);
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
    NSMutableArray *values = [NSMutableArray arrayWithCapacity:steps.size()];
    return executeMainAsynchronously(
        runtime,
        [steps = std::move(steps), invocations, values]() {
            for (const NativeBatchStep &step : steps)
            {
                id target = step.targetResultIndex >= 0 ? values[step.targetResultIndex] : step.target;
                if (target == [NSNull null])
                {
                    throw std::runtime_error("Native batch target is null");
                }
                NSMutableArray *arguments = [NSMutableArray arrayWithCapacity:step.arguments.size()];
                for (const NativeBatchArgument &argument : step.arguments)
                {
                    [arguments addObject:argument.resultIndex >= 0
                                             ? values[argument.resultIndex]
                                             : argument.value ?: [NSNull null]];
                }
                SEL selector = NSSelectorFromString(step.selector);
                NSMethodSignature *signature = [target methodSignatureForSelector:selector];
                if (!signature || nativeFFITypeName(signature.methodReturnType).empty())
                {
                    throw std::runtime_error("Native batch method return type is unsupported");
                }
                if (signature.numberOfArguments < 2 ||
                    signature.numberOfArguments - 2 != arguments.count)
                {
                    throw std::runtime_error("Native batch argument count does not match the method signature");
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
                result.setValueAtIndex(completionRuntime, index,
                                       returnValue(completionRuntime, invocation,
                                                   invocation.methodSignature));
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

    NSUInteger maxDepth = 8;
    NSUInteger maxNodes = 100;
    if (count > 1 && args[1].isObject())
    {
        Object options = args[1].asObject(runtime);
        Value depth = options.getProperty(runtime, "maxDepth");
        Value nodes = options.getProperty(runtime, "maxNodes");
        if (!depth.isUndefined())
        {
            double value = depth.isNumber() ? depth.asNumber() : NAN;
            if (!std::isfinite(value) || value < 0 || value > 12 || std::floor(value) != value)
            {
                throw JSError(runtime, "Native UI snapshot depth must be an integer from 0 to 12");
            }
            maxDepth = static_cast<NSUInteger>(value);
        }
        if (!nodes.isUndefined())
        {
            double value = nodes.isNumber() ? nodes.asNumber() : NAN;
            if (!std::isfinite(value) || value < 1 || value > 256 || std::floor(value) != value)
            {
                throw JSError(runtime, "Native UI snapshot size must be an integer from 1 to 256");
            }
            maxNodes = static_cast<NSUInteger>(value);
        }
    }

    NSMutableArray<NSDictionary *> *captured = [NSMutableArray arrayWithCapacity:maxNodes];
    return executeMainAsynchronously(
        runtime,
        [root, captured, maxDepth, maxNodes]() {
            NSMutableArray<NSDictionary *> *queue = [NSMutableArray arrayWithCapacity:maxNodes];
            [queue addObject:@{ @"view": root, @"parent": @(-1), @"depth": @(0) }];
            for (NSUInteger index = 0; index < queue.count && captured.count < maxNodes; index++)
            {
                NSDictionary *queued = queue[index];
                UIView *view = queued[@"view"];
                NSUInteger depth = [queued[@"depth"] unsignedIntegerValue];
                NSString *text = nil;
                SEL textSelector = @selector(text);
                if ([view respondsToSelector:textSelector])
                {
                    NSMethodSignature *signature = [view methodSignatureForSelector:textSelector];
                    if (signature && normalizedType(signature.methodReturnType) == '@')
                    {
                        id value = ((id (*)(id, SEL)) objc_msgSend)(view, textSelector);
                        if ([value isKindOfClass:[NSString class]]) text = value;
                    }
                }
                [captured addObject:@{
                    @"view": view,
                    @"parent": queued[@"parent"],
                    @"depth": queued[@"depth"],
                    @"className": NSStringFromClass([view class]),
                    @"frame": [NSValue valueWithCGRect:view.frame],
                    @"text": text ?: [NSNull null],
                    @"visible": @(!view.hidden && view.alpha > 0 && view.window != nil),
                }];
                if (depth >= maxDepth) continue;
                NSNumber *parent = @(captured.count - 1);
                for (UIView *child in view.subviews)
                {
                    if (queue.count >= maxNodes) break;
                    [queue addObject:@{ @"view": child, @"parent": parent, @"depth": @(depth + 1) }];
                }
            }
        },
        [captured](Runtime &completionRuntime) -> Value {
            Array result(completionRuntime, captured.count);
            for (NSUInteger index = 0; index < captured.count; index++)
            {
                NSDictionary *node = captured[index];
                CGRect frame = [node[@"frame"] CGRectValue];
                Object item(completionRuntime);
                Object bounds(completionRuntime);
                bounds.setProperty(completionRuntime, "x", Value((double) frame.origin.x));
                bounds.setProperty(completionRuntime, "y", Value((double) frame.origin.y));
                bounds.setProperty(completionRuntime, "width", Value((double) frame.size.width));
                bounds.setProperty(completionRuntime, "height", Value((double) frame.size.height));
                item.setProperty(completionRuntime, "view", objcHandleResult(completionRuntime, node[@"view"]));
                item.setProperty(completionRuntime, "parent", Value([node[@"parent"] doubleValue]));
                item.setProperty(completionRuntime, "depth", Value([node[@"depth"] doubleValue]));
                item.setProperty(completionRuntime, "className", [JSI fromObjC:node[@"className"] runtime:completionRuntime]);
                item.setProperty(completionRuntime, "frame", std::move(bounds));
                item.setProperty(completionRuntime, "text", node[@"text"] == [NSNull null]
                                                           ? Value::null()
                                                           : [JSI fromObjC:node[@"text"] runtime:completionRuntime]);
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
    NSString *className = [JSI toNSString:args[1] runtime:runtime];
    if (className.length == 0 || className.length > 128)
    {
        throw JSError(runtime, "Native view class name must contain 1 to 128 characters");
    }

    NSUInteger maxDepth = 24;
    NSUInteger maxVisited = 512;
    NSUInteger maxResults = 64;
    bool attachedOnly = false;
    bool stopAtMatch = false;
    bool searchAncestors = false;
    if (count > 2 && args[2].isObject())
    {
        Object options = args[2].asObject(runtime);
        Value depth = options.getProperty(runtime, "maxDepth");
        Value visited = options.getProperty(runtime, "maxVisited");
        Value results = options.getProperty(runtime, "maxResults");
        if (!depth.isUndefined())
        {
            double value = depth.isNumber() ? depth.asNumber() : NAN;
            if (!std::isfinite(value) || value < 0 || value > 40 || std::floor(value) != value)
            {
                throw JSError(runtime, "Native view search depth must be an integer from 0 to 40");
            }
            maxDepth = static_cast<NSUInteger>(value);
        }
        if (!visited.isUndefined())
        {
            double value = visited.isNumber() ? visited.asNumber() : NAN;
            if (!std::isfinite(value) || value < 1 || value > 2048 || std::floor(value) != value)
            {
                throw JSError(runtime, "Native view search visit limit must be an integer from 1 to 2048");
            }
            maxVisited = static_cast<NSUInteger>(value);
        }
        if (!results.isUndefined())
        {
            double value = results.isNumber() ? results.asNumber() : NAN;
            if (!std::isfinite(value) || value < 1 || value > 256 || std::floor(value) != value)
            {
                throw JSError(runtime, "Native view search result limit must be an integer from 1 to 256");
            }
            maxResults = static_cast<NSUInteger>(value);
        }
        Value attached = options.getProperty(runtime, "attachedOnly");
        Value stop = options.getProperty(runtime, "stopAtMatch");
        Value direction = options.getProperty(runtime, "direction");
        if (!attached.isUndefined())
        {
            if (!attached.isBool()) throw JSError(runtime, "Native view search attachedOnly must be boolean");
            attachedOnly = attached.getBool();
        }
        if (!stop.isUndefined())
        {
            if (!stop.isBool()) throw JSError(runtime, "Native view search stopAtMatch must be boolean");
            stopAtMatch = stop.getBool();
        }
        if (!direction.isUndefined())
        {
            if (!direction.isString()) throw JSError(runtime, "Native view search direction is invalid");
            NSString *name = [JSI toNSString:direction runtime:runtime];
            if ([name isEqualToString:@"ancestors"])
            {
                searchAncestors = true;
            }
            else if (![name isEqualToString:@"descendants"])
            {
                throw JSError(runtime, "Native view search direction is invalid");
            }
        }
    }

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
                     view = view.superview, depth++)
                {
                    bool matches = expectedClass ? [view isKindOfClass:expectedClass]
                                                 : [NSStringFromClass([view class]) containsString:className];
                    if (matches && (!attachedOnly || view.window != nil))
                    {
                        [found addObject:view];
                        if (found.count >= maxResults || stopAtMatch) break;
                    }
                }
                return;
            }
            NSMutableArray<NSDictionary *> *queue = [NSMutableArray arrayWithCapacity:maxVisited];
            [queue addObject:@{ @"view": root, @"depth": @(0) }];
            for (NSUInteger index = 0; index < queue.count && index < maxVisited; index++)
            {
                NSDictionary *queued = queue[index];
                UIView *view = queued[@"view"];
                NSUInteger depth = [queued[@"depth"] unsignedIntegerValue];
                bool matches = expectedClass ? [view isKindOfClass:expectedClass]
                                             : [NSStringFromClass([view class]) containsString:className];
                if (matches && (!attachedOnly || view.window != nil))
                {
                    [found addObject:view];
                    if (found.count >= maxResults) break;
                }
                if (depth >= maxDepth || (matches && stopAtMatch)) continue;
                for (UIView *child in view.subviews)
                {
                    if (queue.count >= maxVisited) break;
                    [queue addObject:@{ @"view": child, @"depth": @(depth + 1) }];
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
    struct objc_super superInfo{};
    std::vector<FFICallArgument> values;
    std::vector<void *> argumentValues;
    std::vector<id> retainedArguments;
    FFITypeSpec result;
    ffi_cif cif{};
    std::vector<uint8_t> output;
    __strong id retainedTarget = nil;
    __strong id retainedResult = nil;
};

static Value invokeSuperAsync(Runtime &runtime, id target, Class currentClass, SEL selector,
                              NSArray *arguments)
{
    if (!target || !currentClass || !selector)
    {
        throw JSError(runtime, "Invalid native Objective-C super target");
    }

    Class superclass = class_getSuperclass(currentClass);
    Method method = superclass ? class_getInstanceMethod(superclass, selector) : NULL;
    if (!method)
    {
        throw JSError(runtime, "Objective-C super selector is not available");
    }

    NSMethodSignature *signature = [NSMethodSignature signatureWithObjCTypes:method_getTypeEncoding(method)];
    NSUInteger expected = signature.numberOfArguments >= 2 ? signature.numberOfArguments - 2 : 0;
    if (expected != arguments.count)
    {
        throw JSError(runtime, "Objective-C super argument count does not match the method signature");
    }

    auto call = std::make_shared<AsyncSuperCall>();
    call->retainedTarget = target;
    call->superInfo = {target, currentClass};
    call->values.resize(arguments.count + 2);
    call->argumentValues.resize(arguments.count + 2);
    call->retainedArguments.reserve(arguments.count);
    call->values[0].pointer = &call->superInfo;
    call->values[1].pointer = selector;
    call->argumentValues[0] = &call->values[0].pointer;
    call->argumentValues[1] = &call->values[1].pointer;

    std::vector<FFITypeSpec> cifArguments;
    cifArguments.reserve(arguments.count + 2);
    cifArguments.push_back({"pointer", &ffi_type_pointer});
    cifArguments.push_back({"selector", &ffi_type_pointer});
    for (NSUInteger index = 0; index < arguments.count; index++)
    {
        const char *encoding = [signature getArgumentTypeAtIndex:index + 2];
        std::string name = nativeFFITypeName(encoding);
        if (name.empty())
        {
            throw JSError(runtime, "Unsupported native super argument type encoding");
        }
        cifArguments.push_back(ffiType(runtime, name));
        setSuperFFIArgument(runtime, encoding, arguments[index], call->values[index + 2],
                            call->retainedArguments);
        if (name == "object" || name == "class" || name == "selector" || name == "pointer")
        {
            call->argumentValues[index + 2] = &call->values[index + 2].pointer;
        }
        else
        {
            call->argumentValues[index + 2] = call->values[index + 2].bytes.data();
        }
    }

    std::string resultName = nativeFFITypeName(signature.methodReturnType);
    if (resultName.empty())
    {
        throw JSError(runtime, "Unsupported native super return type encoding");
    }
    call->result = ffiType(runtime, resultName);
    call->cif = prepareFFICif(runtime, call->result, cifArguments);
    call->output.resize(std::max<size_t>(call->result.type->size, sizeof(void *)));

    return executeMainAsynchronously(
        runtime,
        [call]() {
            ffi_call(&call->cif, reinterpret_cast<void (*)(void)>(objc_msgSendSuper),
                     call->result.name == "void" ? nullptr : call->output.data(),
                     call->argumentValues.data());
            if (call->result.name == "object" || call->result.name == "class")
            {
                __unsafe_unretained id object = nil;
                memcpy(&object, call->output.data(), sizeof(object));
                call->retainedResult = object;
            }
        },
        [call](Runtime &completionRuntime) {
            return ffiResult(completionRuntime, call->result, call->output);
        });
}

static Value invokeSuperWithThreadPolicy(Runtime &runtime, id target, Class currentClass, SEL selector,
                                         NSArray *arguments, const Value *options)
{
    std::string policy = "current";
    if (options && options->isObject())
    {
        Value thread = options->asObject(runtime).getProperty(runtime, "thread");
        if (thread.isString())
        {
            policy = [JSI toNSString:thread runtime:runtime].UTF8String;
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
        NSString *name = [JSI toNSString:value runtime:runtime];
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
            Method method = class_getInstanceMethod(dispatcher->cls, dispatcher->selector);
            IMP current = method ? method_getImplementation(method) : nullptr;
            if (!method || current == (IMP) dispatcher->code || current == dispatcher->original)
            {
                if (method && current == (IMP) dispatcher->code)
                {
                    MSHookMessageEx(dispatcher->cls, dispatcher->selector,
                                    dispatcher->original, nullptr);
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
                if (state->runtimeGeneration < generation) stale.push_back(state);
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
    if (property == "setSizeHeightFloor")
    {
        std::shared_ptr<HookState> state = state_;
        return Function::createFromHostFunction(
            runtime, PropNameID::forUtf8(runtime, "setSizeHeightFloor"), 3,
            [state](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                setHookSizeHeightFloor(rt, state, args, count);
                return Value::undefined();
            });
    }
    if (property == "removeSizeHeightFloor")
    {
        std::shared_ptr<HookState> state = state_;
        return Function::createFromHostFunction(
            runtime, PropNameID::forUtf8(runtime, "removeSizeHeightFloor"), 2,
            [state](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                removeHookSizeHeightFloor(rt, state, args, count);
                return Value::undefined();
            });
    }
    return Value::undefined();
}

static const char *structEncoding(const std::string &name)
{
    if (name == "NSRange")
    {
        return "{_NSRange=QQ}";
    }
    if (name == "CGPoint")
    {
        return "{CGPoint=dd}";
    }
    if (name == "CGSize")
    {
        return "{CGSize=dd}";
    }
    if (name == "CGRect")
    {
        return "{CGRect={CGPoint=dd}{CGSize=dd}}";
    }
    if (name == "UIEdgeInsets")
    {
        return "{UIEdgeInsets=dddd}";
    }
    if (name == "CGAffineTransform")
    {
        return "{CGAffineTransform=dddddd}";
    }
    return nullptr;
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
    if (!value)
    {
        return Value::undefined();
    }

    NSString *canonicalName = name;
    if ([name containsString:@"_NSRange"])
    {
        canonicalName = @"NSRange";
    }
    else if ([name containsString:@"CGAffineTransform"])
    {
        canonicalName = @"CGAffineTransform";
    }
    else if ([name containsString:@"UIEdgeInsets"])
    {
        canonicalName = @"UIEdgeInsets";
    }
    else if ([name containsString:@"CGRect"])
    {
        canonicalName = @"CGRect";
    }
    else if ([name containsString:@"CGPoint"])
    {
        canonicalName = @"CGPoint";
    }
    else if ([name containsString:@"CGSize"])
    {
        canonicalName = @"CGSize";
    }

    Object result(runtime);
    if ([canonicalName isEqualToString:@"NSRange"])
    {
        NSRange range = NSMakeRange(0, 0);
        [value getValue:&range];
        result.setProperty(runtime, "location", (double) range.location);
        result.setProperty(runtime, "length", (double) range.length);
        return result;
    }
    if ([canonicalName isEqualToString:@"CGPoint"])
    {
        CGPoint point = CGPointZero;
        [value getValue:&point];
        result.setProperty(runtime, "x", point.x);
        result.setProperty(runtime, "y", point.y);
        return result;
    }
    if ([canonicalName isEqualToString:@"CGSize"])
    {
        CGSize size = CGSizeZero;
        [value getValue:&size];
        result.setProperty(runtime, "width", size.width);
        result.setProperty(runtime, "height", size.height);
        return result;
    }
    if ([canonicalName isEqualToString:@"CGRect"])
    {
        CGRect rect = CGRectZero;
        [value getValue:&rect];
        Object origin(runtime);
        origin.setProperty(runtime, "x", rect.origin.x);
        origin.setProperty(runtime, "y", rect.origin.y);
        Object size(runtime);
        size.setProperty(runtime, "width", rect.size.width);
        size.setProperty(runtime, "height", rect.size.height);
        result.setProperty(runtime, "origin", origin);
        result.setProperty(runtime, "size", size);
        return result;
    }
    if ([canonicalName isEqualToString:@"UIEdgeInsets"])
    {
        UIEdgeInsets insets = UIEdgeInsetsZero;
        [value getValue:&insets];
        result.setProperty(runtime, "top", insets.top);
        result.setProperty(runtime, "left", insets.left);
        result.setProperty(runtime, "bottom", insets.bottom);
        result.setProperty(runtime, "right", insets.right);
        return result;
    }
    if ([canonicalName isEqualToString:@"CGAffineTransform"])
    {
        CGAffineTransform transform = CGAffineTransformIdentity;
        [value getValue:&transform];
        result.setProperty(runtime, "a", transform.a);
        result.setProperty(runtime, "b", transform.b);
        result.setProperty(runtime, "c", transform.c);
        result.setProperty(runtime, "d", transform.d);
        result.setProperty(runtime, "tx", transform.tx);
        result.setProperty(runtime, "ty", transform.ty);
        return result;
    }
    return Value::undefined();
}

static ffi_type *libffiScalarType(loader::ffi::Kind kind)
{
    switch (kind)
    {
        case loader::ffi::Kind::Void:
            return &ffi_type_void;
        case loader::ffi::Kind::Bool:
        case loader::ffi::Kind::UInt8:
            return &ffi_type_uint8;
        case loader::ffi::Kind::Int8:
            return &ffi_type_sint8;
        case loader::ffi::Kind::Int16:
            return &ffi_type_sint16;
        case loader::ffi::Kind::UInt16:
            return &ffi_type_uint16;
        case loader::ffi::Kind::Int32:
            return &ffi_type_sint32;
        case loader::ffi::Kind::UInt32:
            return &ffi_type_uint32;
        case loader::ffi::Kind::Int64:
            return &ffi_type_sint64;
        case loader::ffi::Kind::UInt64:
            return &ffi_type_uint64;
        case loader::ffi::Kind::Float:
            return &ffi_type_float;
        case loader::ffi::Kind::Double:
            return &ffi_type_double;
        case loader::ffi::Kind::CString:
        case loader::ffi::Kind::Pointer:
        case loader::ffi::Kind::Struct:
            return &ffi_type_pointer;
    }
    return &ffi_type_pointer;
}

static ffi_type *ffiStructTypeLocked(const loader::ffi::StructLayout *layout)
{
    auto existing = gFFITypes.find(layout->name);
    if (existing != gFFITypes.end())
    {
        return &existing->second->type;
    }

    auto definition = std::make_shared<FFITypeDefinition>();
    for (const loader::ffi::StructField &field : layout->fields)
    {
        definition->elements.push_back(field.type.kind == loader::ffi::Kind::Struct
                                           ? ffiStructTypeLocked(field.type.layout)
                                           : libffiScalarType(field.type.kind));
    }
    definition->elements.push_back(nullptr);
    definition->type.type     = FFI_TYPE_STRUCT;
    definition->type.elements = definition->elements.data();
    gFFITypes[layout->name]   = definition;
    return &definition->type;
}

static FFITypeSpec ffiType(Runtime &runtime, const std::string &name)
{
    if (name == "object" || name == "class" || name == "selector")
    {
        return {name, &ffi_type_pointer};
    }

    std::optional<loader::ffi::Type> type = loader::ffi::parseType(name);
    if (!type)
    {
        throw JSError(runtime, "Unsupported native FFI type");
    }
    if (type->kind != loader::ffi::Kind::Struct)
    {
        return {name, libffiScalarType(type->kind)};
    }
    if (!structEncoding(type->layout->name))
    {
        throw JSError(runtime, "Unsupported native FFI type");
    }

    std::lock_guard<std::mutex> lock(gFFIMutex);
    return {name, ffiStructTypeLocked(type->layout)};
}

static std::string ffiCifKey(const FFITypeSpec &result, const std::vector<FFITypeSpec> &arguments)
{
    std::ostringstream key;
    key << result.name;
    for (const FFITypeSpec &argument : arguments)
    {
        key << '\0' << argument.name;
    }
    return key.str();
}

static ffi_cif prepareFFICif(Runtime &runtime, const FFITypeSpec &result,
                             const std::vector<FFITypeSpec> &arguments)
{
    std::string key = ffiCifKey(result, arguments);
    {
        std::lock_guard<std::mutex> lock(gFFICifMutex);
        auto existing = gFFICifs.find(key);
        if (existing != gFFICifs.end())
        {
            return existing->second->cif;
        }
    }

    auto cached = std::make_shared<CachedFFICif>();
    cached->arguments.reserve(arguments.size());
    for (const FFITypeSpec &argument : arguments)
    {
        cached->arguments.push_back(argument.type);
    }

    if (ffi_prep_cif(&cached->cif, FFI_DEFAULT_ABI, (unsigned) cached->arguments.size(), result.type,
                     cached->arguments.data()) != FFI_OK)
    {
        throw JSError(runtime, "Native FFI signature could not be prepared");
    }

    std::lock_guard<std::mutex> lock(gFFICifMutex);
    auto existing = gFFICifs.find(key);
    if (existing != gFFICifs.end())
    {
        return existing->second->cif;
    }
    gFFICifs.emplace(std::move(key), cached);
    return cached->cif;
}

static std::string ffiTypeName(Runtime &runtime, const Value &value)
{
    if (value.isString())
    {
        return [JSI toNSString:value runtime:runtime].UTF8String;
    }

    if (value.isObject())
    {
        Object object = value.asObject(runtime);
        Value structName = object.getProperty(runtime, "struct");
        if (structName.isString())
        {
            return "struct:" + std::string([JSI toNSString:structName runtime:runtime].UTF8String);
        }
        Value typeName = object.getProperty(runtime, "type");
        if (typeName.isString())
        {
            return [JSI toNSString:typeName runtime:runtime].UTF8String;
        }
    }

    throw JSError(runtime, "Native FFI type must be a string or type object");
}

static FFISignature parseFFISignature(Runtime &runtime, const Value &value)
{
    if (!value.isObject())
    {
        throw JSError(runtime, "ffi.call expects a signature object");
    }

    Object signature = value.asObject(runtime);
    Value resultValue = signature.getProperty(runtime, "returnType");
    if (resultValue.isUndefined())
    {
        resultValue = signature.getProperty(runtime, "returns");
    }
    if (resultValue.isUndefined())
    {
        throw JSError(runtime, "Native FFI signature is missing returnType");
    }

    Value argumentsValue = signature.getProperty(runtime, "args");
    if (!argumentsValue.isObject() || !argumentsValue.asObject(runtime).isArray(runtime))
    {
        throw JSError(runtime, "Native FFI signature is missing args");
    }

    FFISignature result{ffiType(runtime, ffiTypeName(runtime, resultValue)), {}};
    Array arguments = argumentsValue.asObject(runtime).asArray(runtime);
    result.arguments.reserve(arguments.size(runtime));
    for (size_t index = 0; index < arguments.size(runtime); index++)
    {
        result.arguments.push_back(ffiType(runtime, ffiTypeName(runtime, arguments.getValueAtIndex(runtime, index))));
    }
    return result;
}

static void setFFIScalar(Runtime &runtime, const Value &value, const std::string &name,
                         FFICallArgument &argument)
{
    if (name == "bool")
    {
        if (!value.isBool())
        {
            throw JSError(runtime, "Native FFI boolean argument expected");
        }
    }
    else if (name == "i64" || name == "u64")
    {
        if (value.isBigInt())
        {
            BigInt bigint = value.asBigInt(runtime);
            bool inRange = name == "i64" ? runtime.bigintIsInt64(bigint)
                                          : runtime.bigintIsUint64(bigint);
            if (!inRange)
            {
                throw JSError(runtime, "Native FFI integer exceeds its type range");
            }
        }
        else if (!value.isNumber() || !validNativeNumericValue(value.getNumber(), name))
        {
            throw JSError(runtime, "Native FFI integer must be a safe integral value");
        }
    }
    else if (!value.isNumber() || !validNativeNumericValue(value.getNumber(), name))
    {
        throw JSError(runtime, "Native FFI numeric argument exceeds its type range");
    }

    id object = valueToObjC(runtime, value);
    if (name == "bool" || name == "i8" || name == "u8")
    {
        argument.bytes.resize(1);
        argument.bytes[0] = name == "bool" ? [object boolValue] : [object unsignedCharValue];
        return;
    }
    if (name == "i16" || name == "u16")
    {
        argument.bytes.resize(2);
        uint16_t number = name == "i16" ? (uint16_t) [object shortValue] : [object unsignedShortValue];
        memcpy(argument.bytes.data(), &number, sizeof(number));
        return;
    }
    if (name == "i32" || name == "u32")
    {
        argument.bytes.resize(4);
        uint32_t number = name == "i32" ? (uint32_t) [object intValue] : [object unsignedIntValue];
        memcpy(argument.bytes.data(), &number, sizeof(number));
        return;
    }
    if (name == "i64" || name == "u64")
    {
        argument.bytes.resize(8);
        uint64_t number = name == "i64" ? (uint64_t) [object longLongValue]
                                         : [object unsignedLongLongValue];
        memcpy(argument.bytes.data(), &number, sizeof(number));
        return;
    }
    if (name == "float")
    {
        argument.bytes.resize(sizeof(float));
        float number = [object floatValue];
        memcpy(argument.bytes.data(), &number, sizeof(number));
        return;
    }
    if (name == "double")
    {
        argument.bytes.resize(sizeof(double));
        double number = [object doubleValue];
        memcpy(argument.bytes.data(), &number, sizeof(number));
        return;
    }
}

static void setFFIArgument(Runtime &runtime, const Value &value, const FFITypeSpec &spec,
                           FFICallArgument &argument)
{
    if (spec.name == "cstring")
    {
        NSString *string = [JSI toNSString:value runtime:runtime];
        argument.string = string.UTF8String ?: "";
        argument.pointer = (void *) argument.string.c_str();
        return;
    }

    if (spec.name == "selector")
    {
        if (value.isString())
        {
            NSString *name = [JSI toNSString:value runtime:runtime];
            argument.pointer = (void *) NSSelectorFromString(name);
        }
        else if (value.isObject())
        {
            Object object = value.asObject(runtime);
            if (object.isHostObject<PointerHost>(runtime))
            {
                argument.pointer = object.getHostObject<PointerHost>(runtime)->value();
            }
        }
        return;
    }

    if (spec.name == "object" && !value.isNull() && !value.isUndefined() &&
        !(value.isObject() && value.asObject(runtime).isHostObject<PointerHost>(runtime)))
    {
        argument.object = valueToObjC(runtime, value);
        argument.pointer = (__bridge void *) argument.object;
        return;
    }

    if (spec.name == "pointer" || spec.name == "object" || spec.name == "class")
    {
        argument.pointer = (__bridge void *) objcValue(runtime, value);
        if (!argument.pointer && value.isObject())
        {
            Object object = value.asObject(runtime);
            if (object.isHostObject<PointerHost>(runtime))
            {
                argument.pointer = object.getHostObject<PointerHost>(runtime)->value();
            }
        }
        return;
    }

    if (spec.name.rfind("struct:", 0) == 0)
    {
        id object = valueToObjC(runtime, value);
        if (![object isKindOfClass:[NSValue class]])
        {
            throw JSError(runtime, "Native FFI struct argument expected");
        }
        NSUInteger size = spec.type->size;
        argument.bytes.resize(size);
        [(NSValue *) object getValue:argument.bytes.data() size:size];
        return;
    }

    setFFIScalar(runtime, value, spec.name, argument);
}

struct HookInvocation {
    std::shared_ptr<HookDispatcher> dispatcher;
    std::vector<std::vector<uint8_t>> arguments;
    std::vector<std::shared_ptr<ObjCHandleHost>> retainedObjects;
    std::vector<std::string> retainedStrings;
    std::vector<uint8_t> originalResult;
    void **nativeArguments = nullptr;
    void *returnValue = nullptr;
    std::thread::id hookThread;
    std::mutex lifecycleMutex;
    std::atomic_bool active{true};
    std::atomic_bool originalCalled{false};
    std::atomic_bool deferredOriginalRequested{false};
};

static std::shared_ptr<HookInvocation> hookInvocation(const std::shared_ptr<HookDispatcher> &dispatcher,
                                                      void **arguments, void *returnValue)
{
    auto invocation = std::make_shared<HookInvocation>();
    invocation->dispatcher = dispatcher;
    invocation->nativeArguments = arguments;
    invocation->returnValue = returnValue;
    invocation->hookThread = std::this_thread::get_id();
    invocation->arguments.reserve(dispatcher->signature->arguments.size());
    invocation->retainedObjects.reserve(dispatcher->signature->arguments.size());
    invocation->retainedStrings.reserve(dispatcher->signature->arguments.size());
    for (const FFITypeSpec &spec : dispatcher->signature->arguments)
    {
        size_t size = std::max<size_t>(spec.type->size, sizeof(void *));
        invocation->arguments.emplace_back(size);
        if (spec.type->size)
        {
            memcpy(invocation->arguments.back().data(), arguments[invocation->arguments.size() - 1],
                   spec.type->size);
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

    size_t size = std::max<size_t>(invocation->dispatcher->signature->result.type->size, sizeof(void *));
    invocation->originalResult.resize(size);
    memcpy(invocation->originalResult.data(), returnValue,
           invocation->dispatcher->signature->result.type->size);
}

static bool invokeDeferredHookOriginal(const std::shared_ptr<HookInvocation> &invocation)
{
    if (!invocation->deferredOriginalRequested.exchange(false) ||
        invocation->originalCalled.load())
    {
        return false;
    }

    invokeHookOriginal(invocation->dispatcher, invocation->nativeArguments,
                       invocation->returnValue);
    copyHookResult(invocation, invocation->returnValue);
    invocation->originalCalled.store(true);
    return true;
}

static std::shared_ptr<std::vector<uint8_t>> hookReturnBuffer(
    const std::shared_ptr<HookInvocation> &invocation)
{
    size_t size = std::max<size_t>(invocation->dispatcher->signature->result.type->size,
                                   sizeof(void *));
    return std::make_shared<std::vector<uint8_t>>(size);
}

static void copyHookReturnBuffer(const std::shared_ptr<HookInvocation> &invocation,
                                 const std::shared_ptr<std::vector<uint8_t>> &buffer,
                                 void *returnValue)
{
    if (invocation->dispatcher->signature->result.name == "void" || !returnValue)
    {
        return;
    }

    memcpy(returnValue, buffer->data(), invocation->dispatcher->signature->result.type->size);
}

static Object hookContext(Runtime &runtime, const std::shared_ptr<HookInvocation> &invocation,
                          id object, SEL selector, bool allowOriginal)
{
    Object context(runtime);
    context.setProperty(runtime, "self",
                        Object::createFromHostObject(runtime, std::make_shared<ObjCHandleHost>(object)));
    context.setProperty(runtime, "selector",
                        String::createFromUtf8(runtime, sel_getName(selector)));

    size_t explicitCount = invocation->dispatcher->signature->arguments.size() - 2;
    Array values(runtime, explicitCount);
    for (size_t index = 0; index < explicitCount; index++)
    {
        values.setValueAtIndex(
            runtime, index,
            ffiResult(runtime, invocation->dispatcher->signature->arguments[index + 2],
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
                    throw JSError(rt, "Native hook arguments are unavailable after the hook returns");
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
                    throw JSError(rt, "Native hook replaceObjectArgument expects an index and object");
                }

                double requestedIndex = args[0].getNumber();
                size_t explicitCount = original->dispatcher->signature->arguments.size() - 2;
                if (!(requestedIndex >= 0 && requestedIndex < explicitCount))
                {
                    throw JSError(rt, "Native hook argument index is out of range");
                }
                size_t explicitIndex = static_cast<size_t>(requestedIndex);
                if (static_cast<double>(explicitIndex) != requestedIndex)
                {
                    throw JSError(rt, "Native hook argument index must be an integer");
                }

                size_t argumentIndex = explicitIndex + 2;
                const FFITypeSpec &spec = original->dispatcher->signature->arguments[argumentIndex];
                if (spec.name != "object" && spec.name != "class")
                {
                    throw JSError(rt, "Native hook argument is not an Objective-C object");
                }

                id object = args[1].isNull() ? nil : objcValue(rt, args[1]);
                void *rawObject = (__bridge void *) object;
                if (object)
                {
                    original->retainedObjects.emplace_back(std::make_shared<ObjCHandleHost>(object));
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
                    throw JSError(rt, "Native hook original() is unavailable after the hook returns");
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
                            throw JSError(rt, "Native hook original() cannot cross runtime threads");
                        }
                        original->deferredOriginalRequested.store(true);
                        return Value::undefined();
                    }

                    invokeHookOriginal(original->dispatcher, original->nativeArguments,
                                       original->returnValue);
                    copyHookResult(original, original->returnValue);
                    original->originalCalled.store(true);
                }
                return ffiResult(rt, original->dispatcher->signature->result, original->originalResult);
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
    ffi_call(&dispatcher->signature->cif, reinterpret_cast<void (*)(void)>(dispatcher->original),
             dispatcher->signature->result.name == "void" ? nullptr : returnValue, arguments);
}

static bool setHookReturn(Runtime &runtime, const FFITypeSpec &spec, const Value &value,
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

    FFICallArgument argument{};
    setFFIArgument(runtime, value, spec, argument);
    if (spec.name == "cstring" || spec.name == "pointer" || spec.name == "object" ||
        spec.name == "class" || spec.name == "selector")
    {
        memcpy(returnValue, &argument.pointer, sizeof(argument.pointer));
        return true;
    }
    if (argument.bytes.size() < spec.type->size)
    {
        return false;
    }
    memcpy(returnValue, argument.bytes.data(), spec.type->size);
    return true;
}

static id hookCacheComponent(const FFITypeSpec &spec, const FFICallArgument &argument)
{
    if (spec.name == "object" || spec.name == "class")
    {
        id object = (__bridge id) argument.pointer;
        return object ?: [NSNull null];
    }
    if (spec.name == "selector")
    {
        SEL selector = (SEL) argument.pointer;
        return selector ? NSStringFromSelector(selector) : [NSNull null];
    }
    if (spec.name == "pointer")
    {
        return [NSValue valueWithPointer:argument.pointer];
    }
    if (spec.name == "cstring")
    {
        const char *string = (const char *) argument.pointer;
        return string ? ([NSString stringWithUTF8String:string] ?: [NSNull null]) : [NSNull null];
    }
    if (spec.name == "bool")
    {
        return @(*(const bool *) argument.bytes.data());
    }
    if (spec.name == "i8")
    {
        return @(*(const int8_t *) argument.bytes.data());
    }
    if (spec.name == "u8")
    {
        return @(*(const uint8_t *) argument.bytes.data());
    }
    if (spec.name == "i16")
    {
        return @(*(const int16_t *) argument.bytes.data());
    }
    if (spec.name == "u16")
    {
        return @(*(const uint16_t *) argument.bytes.data());
    }
    if (spec.name == "i32")
    {
        return @(*(const int32_t *) argument.bytes.data());
    }
    if (spec.name == "u32")
    {
        return @(*(const uint32_t *) argument.bytes.data());
    }
    if (spec.name == "i64")
    {
        return @(*(const int64_t *) argument.bytes.data());
    }
    if (spec.name == "u64")
    {
        return @(*(const uint64_t *) argument.bytes.data());
    }
    if (spec.name == "float")
    {
        return @(*(const float *) argument.bytes.data());
    }
    if (spec.name == "double")
    {
        return @(*(const double *) argument.bytes.data());
    }
    if (spec.name.rfind("struct:", 0) == 0)
    {
        const char *encoding = structEncoding(spec.name.substr(7));
        if (!encoding || argument.bytes.size() < spec.type->size)
        {
            return nil;
        }
        return [NSValue value:argument.bytes.data() withObjCType:encoding];
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

    id target = objcValue(runtime, args[0]);
    Array values = args[1].asObject(runtime).asArray(runtime);
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
        FFICallArgument argument{};
        setFFIArgument(runtime, values.getValueAtIndex(runtime, index),
                       dispatcher->signature->arguments[index + 2], argument);
        id component = hookCacheComponent(dispatcher->signature->arguments[index + 2], argument);
        if (!component)
        {
            throw JSError(runtime, "Native hook return cache argument type is unsupported");
        }
        [components addObject:component];
    }
    return [components copy];
}

static NSArray *hookReturnCacheKey(const std::shared_ptr<HookDispatcher> &dispatcher,
                                   void **arguments)
{
    if (!dispatcher || !arguments)
    {
        return nil;
    }

    NSMutableArray *components =
        [NSMutableArray arrayWithCapacity:dispatcher->signature->arguments.size()];
    for (size_t index = 0; index < dispatcher->signature->arguments.size(); index++)
    {
        const FFITypeSpec &spec = dispatcher->signature->arguments[index];
        FFICallArgument argument{};
        if (spec.name == "object" || spec.name == "class" || spec.name == "selector" ||
            spec.name == "pointer" || spec.name == "cstring")
        {
            memcpy(&argument.pointer, arguments[index], sizeof(argument.pointer));
        }
        else
        {
            argument.bytes.resize(spec.type->size);
            memcpy(argument.bytes.data(), arguments[index], spec.type->size);
        }
        id component = hookCacheComponent(spec, argument);
        if (!component)
        {
            return nil;
        }
        [components addObject:component];
    }
    return [components copy];
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

    const FFITypeSpec &result = dispatcher->signature->result;
    std::vector<uint8_t> bytes(std::max<size_t>(result.type->size, sizeof(void *)));
    if (!setHookReturn(runtime, result, args[2], bytes.data()))
    {
        throw JSError(runtime, "Native hook return value has an unsupported type");
    }

    NSArray *key = hookReturnCacheKey(runtime, state, args, count);
    NSData *value = [NSData dataWithBytes:bytes.data() length:result.type->size];
    std::lock_guard<std::mutex> lock(state->returnCacheMutex);
    state->returnCache[key] = value;
}

static void removeHookReturnCache(Runtime &runtime, const std::shared_ptr<HookState> &state,
                                  const Value *args, size_t count)
{
    NSArray *key = hookReturnCacheKey(runtime, state, args, count);
    std::lock_guard<std::mutex> lock(state->returnCacheMutex);
    [state->returnCache removeObjectForKey:key];
}

static void clearHookReturnCache(const std::shared_ptr<HookState> &state)
{
    if (!state)
    {
        return;
    }
    std::lock_guard<std::mutex> lock(state->returnCacheMutex);
    [state->returnCache removeAllObjects];
    [state->sizeHeightFloors removeAllObjects];
}

static void setHookSizeHeightFloor(Runtime &runtime, const std::shared_ptr<HookState> &state,
                                   const Value *args, size_t count)
{
    if (!state || !state->cacheOnly || count < 3 || !args[2].isNumber())
    {
        throw JSError(runtime, "Native hook size floor requires a number");
    }

    std::shared_ptr<HookDispatcher> dispatcher = state->dispatcher.lock();
    if (!dispatcher || dispatcher->signature->result.name != "struct:CGSize")
    {
        throw JSError(runtime, "Native hook size floor requires a CGSize return type");
    }

    double floor = args[2].getNumber();
    if (!std::isfinite(floor) || floor < 0 || floor > 4096)
    {
        throw JSError(runtime, "Native hook size floor is outside the supported range");
    }

    NSArray *key = hookReturnCacheKey(runtime, state, args, count);
    std::lock_guard<std::mutex> lock(state->returnCacheMutex);
    if (floor == 0)
    {
        [state->sizeHeightFloors removeObjectForKey:key];
    }
    else
    {
        state->sizeHeightFloors[key] = @(floor);
    }
}

static void removeHookSizeHeightFloor(Runtime &runtime, const std::shared_ptr<HookState> &state,
                                      const Value *args, size_t count)
{
    NSArray *key = hookReturnCacheKey(runtime, state, args, count);
    std::lock_guard<std::mutex> lock(state->returnCacheMutex);
    [state->sizeHeightFloors removeObjectForKey:key];
}

static void applyHookSizeHeightFloors(const std::shared_ptr<HookDispatcher> &dispatcher,
                                      const std::vector<std::shared_ptr<HookState>> &hooks,
                                      void **arguments, void *returnValue)
{
    if (!returnValue || dispatcher->signature->result.name != "struct:CGSize" ||
        dispatcher->signature->result.type->size < sizeof(CGSize))
    {
        return;
    }

    NSArray *key = nil;
    CGSize size{};
    memcpy(&size, returnValue, sizeof(size));
    if (!std::isfinite(size.height) || size.height < 0)
    {
        return;
    }

    for (const std::shared_ptr<HookState> &state : hooks)
    {
        if (!state->active || !state->cacheOnly)
        {
            continue;
        }

        NSNumber *floorValue = nil;
        {
            std::lock_guard<std::mutex> lock(state->returnCacheMutex);
            if (state->sizeHeightFloors.count == 0)
            {
                continue;
            }
            if (!key)
            {
                key = hookReturnCacheKey(dispatcher, arguments);
            }
            if (key)
            {
                floorValue = state->sizeHeightFloors[key];
            }
        }
        if (!floorValue)
        {
            continue;
        }

        size.height = std::max(size.height, floorValue.doubleValue);
    }

    memcpy(returnValue, &size, sizeof(size));
}

template <typename T>
static T readFFIResult(Runtime &runtime, const std::vector<uint8_t> &bytes)
{
    if (bytes.size() < sizeof(T))
    {
        throw JSError(runtime, "Native result buffer is too small");
    }
    T value{};
    memcpy(&value, bytes.data(), sizeof(value));
    return value;
}

static Value ffiResult(Runtime &runtime, const FFITypeSpec &spec, const std::vector<uint8_t> &bytes)
{
    if (spec.name == "void")
    {
        return Value::undefined();
    }
    if (spec.name == "bool")
    {
        return Value(readFFIResult<uint8_t>(runtime, bytes) != 0);
    }
    if (spec.name == "i8")
    {
        return Value((double) readFFIResult<int8_t>(runtime, bytes));
    }
    if (spec.name == "u8")
    {
        return Value((double) readFFIResult<uint8_t>(runtime, bytes));
    }
    if (spec.name == "i16")
    {
        return Value((double) readFFIResult<int16_t>(runtime, bytes));
    }
    if (spec.name == "u16")
    {
        return Value((double) readFFIResult<uint16_t>(runtime, bytes));
    }
    if (spec.name == "i32")
    {
        return Value((double) readFFIResult<int32_t>(runtime, bytes));
    }
    if (spec.name == "u32")
    {
        return Value((double) readFFIResult<uint32_t>(runtime, bytes));
    }
    if (spec.name == "i64")
    {
        return Value(runtime, BigInt::fromInt64(runtime, readFFIResult<int64_t>(runtime, bytes)));
    }
    if (spec.name == "u64")
    {
        return Value(runtime, BigInt::fromUint64(runtime, readFFIResult<uint64_t>(runtime, bytes)));
    }
    if (spec.name == "float")
    {
        return Value((double) readFFIResult<float>(runtime, bytes));
    }
    if (spec.name == "double")
    {
        return Value(readFFIResult<double>(runtime, bytes));
    }
    if (spec.name == "cstring")
    {
        const char *string = readFFIResult<const char *>(runtime, bytes);
        return string ? String::createFromUtf8(runtime, string) : Value::null();
    }
    if (spec.name == "object" || spec.name == "class")
    {
        if (bytes.size() < sizeof(id)) throw JSError(runtime, "Native result buffer is too small");
        __unsafe_unretained id object = nil;
        memcpy(&object, bytes.data(), sizeof(object));
        return objcResult(runtime, object);
    }
    if (spec.name == "selector")
    {
        if (bytes.size() < sizeof(SEL)) throw JSError(runtime, "Native result buffer is too small");
        SEL selector = NULL;
        memcpy(&selector, bytes.data(), sizeof(selector));
        return selector ? String::createFromUtf8(runtime, sel_getName(selector)) : Value::null();
    }
    if (spec.name == "pointer")
    {
        return pointerResult(runtime, readFFIResult<void *>(runtime, bytes));
    }
    if (spec.name.rfind("struct:", 0) == 0)
    {
        std::string name = spec.name.substr(7);
        const char *encoding = structEncoding(name);
        if (!encoding)
        {
            throw JSError(runtime, "Native FFI struct result is not registered");
        }
        NSUInteger size = 0;
        NSGetSizeAndAlignment(encoding, &size, nullptr);
        if (bytes.size() < size) throw JSError(runtime, "Native result buffer is too small");
        NSValue *value = [NSValue value:bytes.data() withObjCType:encoding];
        return structResult(runtime, [NSString stringWithUTF8String:name.c_str()] ?: @"", value);
    }
    throw JSError(runtime, "Unsupported native FFI result type");
}

static Value ffiCall(Runtime &runtime, void *pointer, const FFISignature &signature,
                     const Value *args)
{
    std::vector<FFICallArgument> arguments(signature.arguments.size());
    std::vector<void *> argumentValues(signature.arguments.size());
    for (size_t index = 0; index < signature.arguments.size(); index++)
    {
        setFFIArgument(runtime, args[index], signature.arguments[index], arguments[index]);
        if (signature.arguments[index].name == "pointer" ||
            signature.arguments[index].name == "object" || signature.arguments[index].name == "class" ||
            signature.arguments[index].name == "selector" || signature.arguments[index].name == "cstring")
        {
            argumentValues[index] = &arguments[index].pointer;
        }
        else
        {
            argumentValues[index] = arguments[index].bytes.data();
        }
    }

    ffi_cif cif = prepareFFICif(runtime, signature.result, signature.arguments);

    size_t resultSize = signature.result.type->size;
    std::vector<uint8_t> result(std::max<size_t>(resultSize, sizeof(void *)));
    ffi_call(&cif, reinterpret_cast<void (*)(void)>(pointer),
             signature.result.name == "void" ? nullptr : result.data(), argumentValues.data());
    return ffiResult(runtime, signature.result, result);
}

static Value ffiCallValue(Runtime &runtime, const Value *args, size_t count)
{
    if (count < 2 || !args[0].isObject())
    {
        throw JSError(runtime, "ffi.call expects a pointer, signature, and arguments");
    }

    Object pointer = args[0].asObject(runtime);
    if (!pointer.isHostObject<PointerHost>(runtime))
    {
        throw JSError(runtime, "ffi.call expects a pointer handle");
    }

    std::shared_ptr<PointerHost> host = pointer.getHostObject<PointerHost>(runtime);
    void *address = host->value();
    if (!address || !host->callable() || !isCallableSymbolAddress(address))
    {
        throw JSError(runtime, "ffi.call requires an executable symbol pointer");
    }

    FFISignature signature = parseFFISignature(runtime, args[1]);
    if (signature.arguments.size() != count - 2)
    {
        throw JSError(runtime, "Native FFI argument count does not match the signature");
    }
    return ffiCall(runtime, address, signature, args + 2);
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
            cls = class_getSuperclass(cls);
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
    NativeOperationSignpost signpost;
};

static void logHookFailure(const std::exception &exception)
{
    [Logger error:LOG_CATEGORY_PLUGINS format:@"Native plugin hook failed: %s", exception.what()];
}

static void dispatchFFIHookBody(ffi_cif *, void *returnValue, void **arguments, void *userData)
{
    __unsafe_unretained id object = nil;
    memcpy(&object, arguments[0], sizeof(object));
    SEL selector = *reinterpret_cast<SEL *>(arguments[1]);
    auto dispatcher = findHookDispatcher(object, selector, userData);
    if (!dispatcher)
    {
        return;
    }

    HookCallGuard guard(dispatcher);
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
        bool cachedReturn = false;
        std::vector<std::shared_ptr<HookState>> onceHooks;
        for (const std::shared_ptr<HookState> &state : hooks)
        {
            if (!state->active)
            {
                continue;
            }

            NSArray *key = hookReturnCacheKey(dispatcher, arguments);
            NSData *cached = nil;
            if (key)
            {
                std::lock_guard<std::mutex> lock(state->returnCacheMutex);
                cached = state->returnCache[key];
            }
            if (cached && returnValue &&
                cached.length == dispatcher->signature->result.type->size)
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
        applyHookSizeHeightFloors(dispatcher, hooks, arguments, returnValue);
        for (const std::shared_ptr<HookState> &state : onceHooks)
        {
            removeHook(state);
        }
        return;
    }

    auto invocation = hookInvocation(dispatcher, arguments, returnValue);

    bool replacementApplied = false;
    bool originalCalled = false;
    std::vector<std::shared_ptr<HookState>> onceHooks;

    for (const std::shared_ptr<HookState> &state : hooks)
    {
        if (!state->active)
        {
            continue;
        }

        if (state->cacheOnly)
        {
            NSArray *key = hookReturnCacheKey(dispatcher, arguments);
            NSData *cached = nil;
            if (key)
            {
                std::lock_guard<std::mutex> lock(state->returnCacheMutex);
                cached = state->returnCache[key];
            }
            if (cached && returnValue &&
                cached.length == dispatcher->signature->result.type->size)
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
                executeRuntimeSynchronously([invocation, object, selector, state](Runtime &runtime) {
                    auto callbacks = state->callbacks.lock();
                    if (!callbacks || !callbacks->before) return;
                    Object context = hookContext(runtime, invocation, object, selector, true);
                    callbacks->before->call(runtime, context);
                });
            }
            catch (const std::exception &exception)
            {
                logHookFailure(exception);
            }
            if (invokeDeferredHookOriginal(invocation)) originalCalled = true;
        }

        if (invocation->originalCalled.load() && !originalCalled)
        {
            originalCalled = true;
        }

        if (state->hasReplace)
        {
            try
            {
                std::shared_ptr<std::vector<uint8_t>> replacementResult = hookReturnBuffer(invocation);
                bool completed = executeRuntimeSynchronously(
                    [invocation, object, selector, state, replacementResult](Runtime &runtime) {
                        auto callbacks = state->callbacks.lock();
                        if (!callbacks || !callbacks->replace)
                        {
                            throw std::runtime_error("Native hook callback expired");
                        }
                        Object context = hookContext(runtime, invocation, object, selector, true);
                        Value result = callbacks->replace->call(runtime, context);
                        if (!setHookReturn(runtime, invocation->dispatcher->signature->result, result,
                                           replacementResult->data()))
                        {
                            throw JSError(runtime, "Native hook replacement returned an unsupported value");
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
            if (invokeDeferredHookOriginal(invocation)) originalCalled = true;
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

    applyHookSizeHeightFloors(dispatcher, hooks, arguments, returnValue);

    for (const std::shared_ptr<HookState> &state : hooks)
    {
        if (!state->active || !state->hasAfter)
        {
            continue;
        }

        __strong id retainedObject = object;
        executeRuntimeAsynchronously([invocation, retainedObject, selector, state](Runtime &runtime) {
            bool pending = state->afterOncePending.exchange(false);
            if (!state->active.load() && !pending)
            {
                return;
            }
            auto callbacks = state->callbacks.lock();
            if (!callbacks || !callbacks->after) return;
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

static CGSize dispatchCGSizeHook(id object, SEL selector, CGSize size)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector, &size};
        CGSize result = CGSizeZero;
        dispatchFFIHookBody(nullptr, &result, arguments, nullptr);
        return result;
    }
}

static CGSize dispatchCGSizeNoArgumentHook(id object, SEL selector)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector};
        CGSize result = CGSizeZero;
        dispatchFFIHookBody(nullptr, &result, arguments, nullptr);
        return result;
    }
}

static CGSize dispatchCGSizePriorityHook(id object, SEL selector, CGSize size, float horizontal,
                                        float vertical)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector, &size, &horizontal, &vertical};
        CGSize result = CGSizeZero;
        dispatchFFIHookBody(nullptr, &result, arguments, nullptr);
        return result;
    }
}

static CGSize dispatchCGSizeDoublePriorityHook(id object, SEL selector, CGSize size, double horizontal,
                                               double vertical)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector, &size, &horizontal, &vertical};
        CGSize result = CGSizeZero;
        dispatchFFIHookBody(nullptr, &result, arguments, nullptr);
        return result;
    }
}

static CGRect dispatchCGRectObjectHook(id object, SEL selector, id indexPath)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector, &indexPath};
        CGRect result = CGRectZero;
        dispatchFFIHookBody(nullptr, &result, arguments, nullptr);
        return result;
    }
}

static double dispatchDoubleObjectObjectHook(id object, SEL selector, id tableView, id indexPath)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector, &tableView, &indexPath};
        double result = 0;
        dispatchFFIHookBody(nullptr, &result, arguments, nullptr);
        return result;
    }
}

static void dispatchVoidObjectObjectObjectHook(id object, SEL selector, id tableView, id cell,
                                               id indexPath)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector, &tableView, &cell, &indexPath};
        dispatchFFIHookBody(nullptr, nullptr, arguments, nullptr);
    }
}

static void dispatchVoidObjectHook(id object, SEL selector, id value)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector, &value};
        dispatchFFIHookBody(nullptr, nullptr, arguments, nullptr);
    }
}

static void dispatchVoidNSUIntegerHook(id object, SEL selector, NSUInteger value)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector, &value};
        dispatchFFIHookBody(nullptr, nullptr, arguments, nullptr);
    }
}

static void dispatchVoidBooleanHook(id object, SEL selector, int8_t value)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector, &value};
        dispatchFFIHookBody(nullptr, nullptr, arguments, nullptr);
    }
}

static int8_t dispatchBooleanHook(id object, SEL selector)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector};
        int8_t returnValue = 0;
        dispatchFFIHookBody(nullptr, &returnValue, arguments, nullptr);
        return returnValue;
    }
}

static id dispatchObjectHook(id object, SEL selector)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector};
        void *returnValue = nullptr;
        dispatchFFIHookBody(nullptr, &returnValue, arguments, nullptr);
        return (__bridge id) returnValue;
    }
}

static Class dispatchClassHook(id object, SEL selector)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector};
        void *returnValue = nullptr;
        dispatchFFIHookBody(nullptr, &returnValue, arguments, nullptr);
        return (__bridge Class) returnValue;
    }
}

static id dispatchObjectObjectHook(id object, SEL selector, id value)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector, &value};
        void *returnValue = nullptr;
        dispatchFFIHookBody(nullptr, &returnValue, arguments, nullptr);
        id result = (__bridge id) returnValue;
        return result;
    }
}

static int8_t dispatchBoolObjectObjectHook(id object, SEL selector, id first, id second)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector, &first, &second};
        int8_t returnValue = 0;
        dispatchFFIHookBody(nullptr, &returnValue, arguments, nullptr);
        return returnValue;
    }
}

static int8_t dispatchBoolObjectHook(id object, SEL selector, id value)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector, &value};
        int8_t returnValue = 0;
        dispatchFFIHookBody(nullptr, &returnValue, arguments, nullptr);
        return returnValue;
    }
}

static int8_t dispatchBoolClassHook(id object, SEL selector, Class value)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector, &value};
        int8_t returnValue = 0;
        dispatchFFIHookBody(nullptr, &returnValue, arguments, nullptr);
        return returnValue;
    }
}

static int8_t dispatchBoolSelectorHook(id object, SEL selector, SEL value)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector, &value};
        int8_t returnValue = 0;
        dispatchFFIHookBody(nullptr, &returnValue, arguments, nullptr);
        return returnValue;
    }
}

static id dispatchObjectCGRectHook(id object, SEL selector, CGRect rect)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector, &rect};
        void *returnValue = nullptr;
        dispatchFFIHookBody(nullptr, &returnValue, arguments, nullptr);
        id result = (__bridge id) returnValue;
        return result;
    }
}

static void dispatchVoidObjectObjectHook(id object, SEL selector, id first, id second)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector, &first, &second};
        dispatchFFIHookBody(nullptr, nullptr, arguments, nullptr);
    }
}

static void *fallbackHookCode(const HookSignature &signature)
{
    if (signature.result.name == "object" && signature.arguments.size() == 2)
    {
        return reinterpret_cast<void *>(dispatchObjectHook);
    }

    if (signature.result.name == "class" && signature.arguments.size() == 2)
    {
        return reinterpret_cast<void *>(dispatchClassHook);
    }

    if ((signature.result.name == "bool" || signature.result.name == "i8") &&
        signature.arguments.size() == 2)
    {
        return reinterpret_cast<void *>(dispatchBooleanHook);
    }

    if ((signature.result.name == "bool" || signature.result.name == "i8") &&
        signature.arguments.size() == 4 &&
        signature.arguments[2].name == "object" && signature.arguments[3].name == "object")
    {
        return reinterpret_cast<void *>(dispatchBoolObjectObjectHook);
    }

    if ((signature.result.name == "bool" || signature.result.name == "i8") &&
        signature.arguments.size() == 3 && signature.arguments[2].name == "object")
    {
        return reinterpret_cast<void *>(dispatchBoolObjectHook);
    }

    if ((signature.result.name == "bool" || signature.result.name == "i8") &&
        signature.arguments.size() == 3 && signature.arguments[2].name == "class")
    {
        return reinterpret_cast<void *>(dispatchBoolClassHook);
    }

    if ((signature.result.name == "bool" || signature.result.name == "i8") &&
        signature.arguments.size() == 3 && signature.arguments[2].name == "selector")
    {
        return reinterpret_cast<void *>(dispatchBoolSelectorHook);
    }

    if (signature.result.name == "object" && signature.arguments.size() == 3 &&
        signature.arguments[2].name == "struct:CGRect")
    {
        return reinterpret_cast<void *>(dispatchObjectCGRectHook);
    }

    if (signature.result.name == "object" && signature.arguments.size() == 3 &&
        signature.arguments[2].name == "object")
    {
        return reinterpret_cast<void *>(dispatchObjectObjectHook);
    }

    if (signature.result.name == "void" && signature.arguments.size() == 3 &&
        signature.arguments[2].name == "object")
    {
        return reinterpret_cast<void *>(dispatchVoidObjectHook);
    }

    if (signature.result.name == "void" && signature.arguments.size() == 3 &&
        signature.arguments[2].name == "u64")
    {
        return reinterpret_cast<void *>(dispatchVoidNSUIntegerHook);
    }

    if (signature.result.name == "void" && signature.arguments.size() == 3 &&
        (signature.arguments[2].name == "bool" || signature.arguments[2].name == "i8"))
    {
        return reinterpret_cast<void *>(dispatchVoidBooleanHook);
    }

    if (signature.result.name == "void" && signature.arguments.size() == 4 &&
        signature.arguments[2].name == "object" && signature.arguments[3].name == "object")
    {
        return reinterpret_cast<void *>(dispatchVoidObjectObjectHook);
    }

    if (signature.result.name == "void" && signature.arguments.size() == 5 &&
        signature.arguments[2].name == "object" && signature.arguments[3].name == "object" &&
        signature.arguments[4].name == "object")
    {
        return reinterpret_cast<void *>(dispatchVoidObjectObjectObjectHook);
    }

    if (signature.result.name == "struct:CGRect" && signature.arguments.size() == 3 &&
        signature.arguments[2].name == "object")
    {
        return reinterpret_cast<void *>(dispatchCGRectObjectHook);
    }

    if (signature.result.name == "double" && signature.arguments.size() == 4 &&
        signature.arguments[2].name == "object" && signature.arguments[3].name == "object")
    {
        return reinterpret_cast<void *>(dispatchDoubleObjectObjectHook);
    }

    if (signature.result.name != "struct:CGSize")
    {
        return nullptr;
    }

    if (signature.arguments.size() == 2)
    {
        return reinterpret_cast<void *>(dispatchCGSizeNoArgumentHook);
    }

    if (signature.arguments.size() == 3 && signature.arguments[2].name == "struct:CGSize")
    {
        return reinterpret_cast<void *>(dispatchCGSizeHook);
    }

    if (signature.arguments.size() == 5 && signature.arguments[2].name == "struct:CGSize" &&
        signature.arguments[3].name == "float" && signature.arguments[4].name == "float")
    {
        return reinterpret_cast<void *>(dispatchCGSizePriorityHook);
    }

    if (signature.arguments.size() == 5 && signature.arguments[2].name == "struct:CGSize" &&
        signature.arguments[3].name == "double" && signature.arguments[4].name == "double")
    {
        return reinterpret_cast<void *>(dispatchCGSizeDoublePriorityHook);
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
        void *arguments[] = {&object, &selector};
        auto invocation = hookInvocation(dispatcher, arguments, nullptr);

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
            invokeHookOriginal(dispatcher, arguments, nullptr);
            return;
        }

        bool replacementApplied = false;
        bool originalCalled = false;
        std::vector<std::shared_ptr<HookState>> onceHooks;

        for (const std::shared_ptr<HookState> &state : hooks)
        {
            if (!state->active)
            {
                continue;
            }

            if (state->hasBefore)
            {
                try
                {
                    executeRuntimeSynchronously([invocation, object, selector, state](Runtime &runtime) {
                        auto callbacks = state->callbacks.lock();
                        if (!callbacks || !callbacks->before) return;
                        Object context = hookContext(runtime, invocation, object, selector, true);
                        callbacks->before->call(runtime, context);
                    });
                }
                catch (const std::exception &exception)
                {
                    logHookFailure(exception);
                }
                if (invokeDeferredHookOriginal(invocation)) originalCalled = true;
            }

            if (invocation->originalCalled.load() && !originalCalled)
            {
                originalCalled = true;
            }

            if (state->hasReplace)
            {
                try
                {
                    std::shared_ptr<std::vector<uint8_t>> replacementResult = hookReturnBuffer(invocation);
                    bool completed = executeRuntimeSynchronously(
                        [invocation, object, selector, state, replacementResult](Runtime &runtime) {
                            auto callbacks = state->callbacks.lock();
                            if (!callbacks || !callbacks->replace)
                            {
                                throw std::runtime_error("Native hook callback expired");
                            }
                            Object context = hookContext(runtime, invocation, object, selector, true);
                            Value result = callbacks->replace->call(runtime, context);
                            if (!setHookReturn(runtime, invocation->dispatcher->signature->result, result,
                                               replacementResult->data()))
                            {
                                throw JSError(runtime, "Native hook replacement returned an unsupported value");
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
                if (invokeDeferredHookOriginal(invocation)) originalCalled = true;
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

            __strong id retainedObject = object;
            executeRuntimeAsynchronously([invocation, retainedObject, selector, state](Runtime &runtime) {
                bool pending = state->afterOncePending.exchange(false);
                if (!state->active.load() && !pending)
                {
                    return;
                }
                auto callbacks = state->callbacks.lock();
                if (!callbacks || !callbacks->after) return;
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

    NSString *className = [JSI toNSString:args[0] runtime:runtime];
    NSString *selectorName = [JSI toNSString:args[1] runtime:runtime];
    Class cls = NSClassFromString(className);
    SEL selector = NSSelectorFromString(selectorName);
    Method method = class_getInstanceMethod(cls, selector);
    if (!cls || !method)
    {
        throw JSError(runtime, "Objective-C hook target is unavailable");
    }

    NSMethodSignature *methodSignature =
        [NSMethodSignature signatureWithObjCTypes:method_getTypeEncoding(method)];
    auto signature = std::make_shared<HookSignature>();
    std::string resultName = nativeFFITypeName(methodSignature.methodReturnType);
    if (resultName.empty())
    {
        throw JSError(runtime, "Unsupported native hook return type encoding");
    }
    signature->result = ffiType(runtime, resultName);
    for (NSUInteger index = 0; index < methodSignature.numberOfArguments; index++)
    {
        std::string name = nativeFFITypeName([methodSignature getArgumentTypeAtIndex:index]);
        if (name.empty())
        {
            throw JSError(runtime, "Unsupported native hook argument type encoding");
        }
        signature->arguments.push_back(ffiType(runtime, name));
    }
    signature->cif = prepareFFICif(runtime, signature->result, signature->arguments);

    Object handlers = args[2].asObject(runtime);
    auto functionFor = [&](const char *name) -> std::shared_ptr<Function> {
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

    std::shared_ptr<Function> before = functionFor("before");
    std::shared_ptr<Function> after = functionFor("after");
    std::shared_ptr<Function> replace = functionFor("replace");
    bool once = false;
    bool cacheOnly = false;
    id instanceTarget = nil;
    if (count > 3 && args[3].isObject())
    {
        Object options = args[3].asObject(runtime);
        Value onceValue = options.getProperty(runtime, "once");
        once = onceValue.isBool() && onceValue.getBool();
        Value cacheOnlyValue = options.getProperty(runtime, "cacheOnly");
        cacheOnly = cacheOnlyValue.isBool() && cacheOnlyValue.getBool();
        Value instanceValue = options.getProperty(runtime, "instance");
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
        bool supportedResult = result == "bool" || result == "i8" || result == "u8" ||
                               result == "i16" || result == "u16" || result == "i32" ||
                               result == "u32" || result == "i64" || result == "u64" ||
                               result == "float" || result == "double" ||
                               result.rfind("struct:", 0) == 0;
        if (before || after || replace || !supportedResult)
        {
            throw JSError(runtime, "Native cache-only hooks require a scalar or struct return type");
        }
    }

    std::shared_ptr<HookDispatcher> dispatcher;
    std::string key = hookKey(cls, selector);
    {
        std::lock_guard<std::mutex> lock(gHookMutex);
        auto iterator = gDispatchers.find(key);
        if (iterator == gDispatchers.end())
        {
            dispatcher = std::make_shared<HookDispatcher>();
            dispatcher->cls = cls;
            dispatcher->selector = selector;
            dispatcher->signature = signature;
            auto prepareClosure = [&]() -> bool {
                dispatcher->closure = (ffi_closure *) ffi_closure_alloc(sizeof(ffi_closure),
                                                                          &dispatcher->code);
                bool closureReady =
                    dispatcher->closure && isExecutableAddress(dispatcher->code) &&
                    ffi_prep_closure_loc(dispatcher->closure, &dispatcher->signature->cif,
                                         dispatchFFIHook, dispatcher.get(), dispatcher->code) == FFI_OK;
                if (!closureReady)
                {
                    if (dispatcher->closure) ffi_closure_free(dispatcher->closure);
                    dispatcher->closure = nullptr;
                    dispatcher->code = nullptr;
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
                        if (index > 0) signatureName += ",";
                        signatureName += dispatcher->signature->arguments[index].name;
                    }
                    signatureName += ")";
                    throw JSError(runtime, "Native hook closure is unavailable on this device for " +
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
                MSHookMessageEx(cls, selector, (IMP) dispatcher->code,
                                &dispatcher->original);
            }
            dispatcher->retired.store(false);
        }
    }

    auto callbacks = std::make_shared<HookCallbacks>();
    callbacks->before = std::move(before);
    callbacks->after = std::move(after);
    callbacks->replace = std::move(replace);
    auto state = std::make_shared<HookState>();
    state->identifier = gNextHookIdentifier.fetch_add(1);
    state->runtimeGeneration = loader::native::runtimeGeneration();
    state->callbacks = callbacks;
    state->hasBefore = callbacks->before != nullptr;
    state->hasAfter = callbacks->after != nullptr;
    state->hasReplace = callbacks->replace != nullptr;
    state->cacheOnly = cacheOnly;
    state->once = once;
    state->instanceTarget = instanceTarget;
    state->dispatcher = dispatcher;
    {
        std::lock_guard<std::mutex> lock(gHookMutex);
        dispatcher->hooks.push_back(state);
    }
    return Object::createFromHostObject(runtime, std::make_shared<HookTokenHost>(state, callbacks));
}

static Value ffiSymbol(Runtime &runtime, const Value *args, size_t count)
{
    if (count == 0 || !args[0].isString())
    {
        throw JSError(runtime, "ffi.symbol expects a symbol name");
    }

    NSString *name = [JSI toNSString:args[0] runtime:runtime];
    void *handle = RTLD_DEFAULT;
    bool closesHandle = false;
    if (count > 1 && args[1].isString())
    {
        NSString *image = [JSI toNSString:args[1] runtime:runtime];
        handle = dlopen(image.UTF8String, RTLD_NOLOAD | RTLD_LAZY);
        if (!handle)
        {
            throw JSError(runtime, "ffi.symbol image is not loaded");
        }
        closesHandle = true;
    }

    void *symbol = dlsym(handle, name.UTF8String);
    if (closesHandle)
    {
        dlclose(handle);
    }
    return pointerResult(runtime, symbol, true);
}

static Value objcFunction(Runtime &runtime, const Value &target, const Value &selectorValue,
                          const Value *args, size_t count, size_t start)
{
    id object = objcValue(runtime, target);
    NSString *selectorName = [JSI toNSString:selectorValue runtime:runtime];
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

    id object = objcValue(runtime, args[0]);
    NSString *name = [JSI toNSString:args[1] runtime:runtime];
    Ivar ivar = object ? class_getInstanceVariable(object_getClass(object), name.UTF8String) : NULL;
    if (!ivar)
    {
        return Value::undefined();
    }

    const char *type = ivar_getTypeEncoding(ivar);
    uint8_t *address = (uint8_t *) (__bridge void *) object + ivar_getOffset(ivar);
    char code = normalizedType(type);
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
        NSUInteger size = 0;
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

    id object = objcValue(runtime, args[0]);
    NSString *name = [JSI toNSString:args[1] runtime:runtime];
    Ivar ivar = object ? class_getInstanceVariable(object_getClass(object), name.UTF8String) : NULL;
    if (!ivar)
    {
        throw JSError(runtime, "Objective-C ivar is unavailable");
    }

    uint8_t *address = (uint8_t *) (__bridge void *) object + ivar_getOffset(ivar);
    char code = normalizedType(ivar_getTypeEncoding(ivar));
    id value = valueToObjC(runtime, args[2]);
    id scalarValue = value == [NSNull null] ? @0 : value;
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
            argument = (SEL) [(NSValue *) value pointerValue];
        }
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }

    if (code == '^' || code == '*')
    {
        void *argument = [value isKindOfClass:[NSValue class]] ? [(NSValue *) value pointerValue] : nullptr;
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
        NSUInteger size = 0;
        NSUInteger alignment = 0;
        NSGetSizeAndAlignment(ivar_getTypeEncoding(ivar), &size, &alignment);
        [(NSValue *) value getValue:address size:size];
        return Value::undefined();
    }
    throw JSError(runtime, "Unsupported ivar type");
}

static objc_AssociationPolicy associationPolicy(Runtime &runtime, const Value *value)
{
    if (!value || !value->isString())
    {
        return OBJC_ASSOCIATION_RETAIN_NONATOMIC;
    }

    NSString *name = [JSI toNSString:*value runtime:runtime];
    if ([name isEqualToString:@"assign"])
    {
        return OBJC_ASSOCIATION_ASSIGN;
    }
    if ([name isEqualToString:@"retain"])
    {
        return OBJC_ASSOCIATION_RETAIN;
    }
    if ([name isEqualToString:@"copy"])
    {
        return OBJC_ASSOCIATION_COPY;
    }
    if ([name isEqualToString:@"copyNonatomic"])
    {
        return OBJC_ASSOCIATION_COPY_NONATOMIC;
    }
    if ([name isEqualToString:@"retainNonatomic"])
    {
        return OBJC_ASSOCIATION_RETAIN_NONATOMIC;
    }
    throw JSError(runtime, "Unsupported native association policy");
}

static void installObjC(Runtime &runtime, Object &objc)
{
    objc.setProperty(runtime, "getClass", makeFunction(
        "getClass", 1, runtime, [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
            if (count == 0 || !args[0].isString())
            {
                return Value::null();
            }
            Class cls = NSClassFromString([JSI toNSString:args[0] runtime:rt]);
            return cls ? Object::createFromHostObject(rt, std::make_shared<ObjCHandleHost>((id) cls))
                       : Value::null();
        }));

    objc.setProperty(runtime, "alloc", makeFunction(
        "alloc", 1, runtime, [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
            Class cls = count ? classFromValue(rt, args[0]) : Nil;
            if (!cls)
            {
                throw JSError(rt, "objc.alloc expects a class handle or class name");
            }
            return objcHandleResult(rt, [[cls alloc] init]);
        }));

    objc.setProperty(runtime, "className", makeFunction(
        "className", 1, runtime, [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
            id object = count ? objcValue(rt, args[0]) : nil;
            if (!object)
            {
                return Value::null();
            }
            Class cls = object_isClass(object) ? object : object_getClass(object);
            return [JSI fromObjC:NSStringFromClass(cls) runtime:rt];
        }));

    objc.setProperty(runtime, "respondsTo", makeFunction(
        "respondsTo", 2, runtime, [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
            if (count < 2)
            {
                return Value(false);
            }
            id object = objcValue(rt, args[0]);
            NSString *name = [JSI toNSString:args[1] runtime:rt];
            return Value(object && [object respondsToSelector:NSSelectorFromString(name)]);
        }));

    objc.setProperty(runtime, "call", makeFunction(
        "call", 2, runtime, [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
            if (count < 2)
            {
                throw JSError(rt, "objc.call expects an object handle and selector");
            }
            return objcFunction(rt, args[0], args[1], args, count, 2);
        }));

    objc.setProperty(runtime, "callSuper", makeFunction(
        "callSuper", 3, runtime, [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
            if (count < 3)
            {
                throw JSError(rt, "objc.callSuper expects an object, class, and selector");
            }
            id object = objcValue(rt, args[0]);
            Class cls = classFromValue(rt, args[1]);
            NSString *selectorName = [JSI toNSString:args[2] runtime:rt];
            return invokeSuperObject(rt, object, cls, NSSelectorFromString(selectorName),
                                     argumentArray(rt, args, count, 3));
        }));

    objc.setProperty(runtime, "invoke", makeFunction(
        "invoke", 3, runtime, [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
            if (count < 3 || !args[2].isObject() || !args[2].asObject(rt).isArray(rt))
            {
                throw JSError(rt, "objc.invoke expects an object, selector, and argument array");
            }
            Array array = args[2].asObject(rt).asArray(rt);
            NSMutableArray *arguments = [NSMutableArray arrayWithCapacity:array.size(rt)];
            for (size_t index = 0; index < array.size(rt); index++)
            {
                [arguments addObject:valueToObjC(rt, array.getValueAtIndex(rt, index)) ?: [NSNull null]];
            }
            id object = objcValue(rt, args[0]);
            NSString *selectorName = [JSI toNSString:args[1] runtime:rt];
            return invokeWithThreadPolicy(rt, object, NSSelectorFromString(selectorName), arguments,
                                          count > 3 ? &args[3] : nullptr);
        }));

    objc.setProperty(runtime, "invokeAsync", makeFunction(
        "invokeAsync", 3, runtime, [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
            if (count < 3 || !args[2].isObject() || !args[2].asObject(rt).isArray(rt))
            {
                throw JSError(rt, "objc.invokeAsync expects an object, selector, and argument array");
            }
            Array array = args[2].asObject(rt).asArray(rt);
            NSMutableArray *arguments = [NSMutableArray arrayWithCapacity:array.size(rt)];
            for (size_t index = 0; index < array.size(rt); index++)
            {
                [arguments addObject:valueToObjC(rt, array.getValueAtIndex(rt, index)) ?: [NSNull null]];
            }
            id object = objcValue(rt, args[0]);
            NSString *selectorName = [JSI toNSString:args[1] runtime:rt];
            return invokeAsync(rt, object, NSSelectorFromString(selectorName), arguments);
        }));

    objc.setProperty(runtime, "batch", makeFunction("batch", 1, runtime, invokeBatch));
    objc.setProperty(runtime, "snapshot", makeFunction("snapshot", 2, runtime, snapshotUI));
    objc.setProperty(runtime, "findViews", makeFunction("findViews", 3, runtime, findUIViews));

    objc.setProperty(runtime, "invokeSuper", makeFunction(
        "invokeSuper", 4, runtime, [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
            if (count < 4 || !args[3].isObject() || !args[3].asObject(rt).isArray(rt))
            {
                throw JSError(rt, "objc.invokeSuper expects an object, class, selector, and argument array");
            }
            id object = objcValue(rt, args[0]);
            Class cls = classFromValue(rt, args[1]);
            NSString *selectorName = [JSI toNSString:args[2] runtime:rt];
            Array array = args[3].asObject(rt).asArray(rt);
            NSMutableArray *arguments = [NSMutableArray arrayWithCapacity:array.size(rt)];
            for (size_t index = 0; index < array.size(rt); index++)
            {
                [arguments addObject:valueToObjC(rt, array.getValueAtIndex(rt, index)) ?: [NSNull null]];
            }
            return invokeSuperWithThreadPolicy(rt, object, cls, NSSelectorFromString(selectorName), arguments,
                                               count > 4 ? &args[4] : nullptr);
        }));

    objc.setProperty(runtime, "invokeSuperAsync", makeFunction(
        "invokeSuperAsync", 4, runtime, [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
            if (count < 4 || !args[3].isObject() || !args[3].asObject(rt).isArray(rt))
            {
                throw JSError(rt, "objc.invokeSuperAsync expects an object, class, selector, and argument array");
            }
            id object = objcValue(rt, args[0]);
            Class cls = classFromValue(rt, args[1]);
            NSString *selectorName = [JSI toNSString:args[2] runtime:rt];
            Array array = args[3].asObject(rt).asArray(rt);
            NSMutableArray *arguments = [NSMutableArray arrayWithCapacity:array.size(rt)];
            for (size_t index = 0; index < array.size(rt); index++)
            {
                [arguments addObject:valueToObjC(rt, array.getValueAtIndex(rt, index)) ?: [NSNull null]];
            }
            return invokeSuperAsync(rt, object, cls, NSSelectorFromString(selectorName), arguments);
        }));

    objc.setProperty(runtime, "getIvar", makeFunction("getIvar", 2, runtime, getIvar));
    objc.setProperty(runtime, "setIvar", makeFunction("setIvar", 3, runtime, setIvar));

    objc.setProperty(runtime, "createAssociationKey", makeFunction(
        "createAssociationKey", 0, runtime, [](Runtime &rt, const Value &, const Value *, size_t) -> Value {
            return Object::createFromHostObject(rt,
                                                std::make_shared<AssociationKeyHost>([NSObject new]));
        }));

    objc.setProperty(runtime, "getAssociatedObject", makeFunction(
        "getAssociatedObject", 2, runtime, [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
            if (count < 2)
            {
                return Value::null();
            }
            id object = objcValue(rt, args[0]);
            if (!args[1].isObject() || !args[1].asObject(rt).isHostObject<AssociationKeyHost>(rt))
            {
                return Value::null();
            }
            const void *key = args[1].asObject(rt).getHostObject<AssociationKeyHost>(rt)->key();
            return objcResult(rt, objc_getAssociatedObject(object, key));
        }));

    objc.setProperty(runtime, "setAssociatedObject", makeFunction(
        "setAssociatedObject", 4, runtime, [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
            if (count < 3 || !args[1].isObject() ||
                !args[1].asObject(rt).isHostObject<AssociationKeyHost>(rt))
            {
                throw JSError(rt, "objc.setAssociatedObject expects an object and association key");
            }
            id object = objcValue(rt, args[0]);
            const void *key = args[1].asObject(rt).getHostObject<AssociationKeyHost>(rt)->key();
            id value = valueToObjC(rt, args[2]);
            objc_setAssociatedObject(object, key, value == [NSNull null] ? nil : value,
                                     associationPolicy(rt, count > 3 ? &args[3] : nullptr));
            return Value::undefined();
        }));

    objc.setProperty(runtime, "struct", makeFunction(
        "struct", 2, runtime, [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
            if (count < 2 || !args[0].isString())
            {
                throw JSError(rt, "objc.struct expects a name and fields");
            }
            return structValue(rt, [JSI toNSString:args[0] runtime:rt], args[1]);
        }));

    objc.setProperty(runtime, "array", makeFunction(
        "array", 1, runtime, [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
            id object = count ? objcValue(rt, args[0]) : nil;
            if (![object isKindOfClass:[NSArray class]])
            {
                return Array(rt, 0);
            }
            return objcResult(rt, object);
        }));

    objc.setProperty(runtime, "data", makeFunction(
        "data", 1, runtime, [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
            NSData *data = count ? valueToData(rt, args[0]) : nil;
            if (!data)
            {
                throw JSError(rt, "objc.data expects an ArrayBuffer or TypedArray");
            }
            return objcHandleResult(rt, data);
        }));

    objc.setProperty(runtime, "hook", makeFunction("hook", 3, runtime, makeHook));
}

static void installFFI(Runtime &runtime, Object &ffi)
{
    ffi.setProperty(runtime, "symbol", makeFunction("symbol", 2, runtime, ffiSymbol));
    ffi.setProperty(runtime, "call", makeFunction("call", 3, runtime, ffiCallValue));
}

static void installFabric(Runtime &runtime, Object &fabric)
{
    fabric.setProperty(runtime, "mount", makeFunction("mount", 3, runtime, fabricMount));
    fabric.setProperty(runtime, "mountAsync", makeFunction("mountAsync", 3, runtime, fabricMountAsync));
    fabric.setProperty(runtime, "update", makeFunction("update", 2, runtime, fabricUpdate));
    fabric.setProperty(runtime, "updateAsync", makeFunction("updateAsync", 2, runtime, fabricUpdateAsync));
    fabric.setProperty(runtime, "setSize", makeFunction("setSize", 3, runtime, fabricSetSize));
    fabric.setProperty(runtime, "setSizeAsync", makeFunction("setSizeAsync", 3, runtime, fabricSetSizeAsync));
    fabric.setProperty(runtime, "setFrame", makeFunction("setFrame", 2, runtime, fabricSetFrame));
    fabric.setProperty(runtime, "setFrameAsync", makeFunction("setFrameAsync", 2, runtime, fabricSetFrameAsync));
    fabric.setProperty(runtime, "measure", makeFunction("measure", 1, runtime, fabricMeasure));
    fabric.setProperty(runtime, "measureAsync", makeFunction("measureAsync", 1, runtime, fabricMeasureAsync));
    fabric.setProperty(runtime, "unmount", makeFunction("unmount", 1, runtime, fabricUnmount));
    fabric.setProperty(runtime, "unmountAsync", makeFunction("unmountAsync", 1, runtime, fabricUnmountAsync));
}

static Value environment(Runtime &runtime, const Value *, size_t)
{
    NSString *hostAddress = [Utilities getVirtualDeviceHostAddress];

    Object result(runtime);
    result.setProperty(runtime, "isVirtualDevice", Value(static_cast<bool>([Utilities isVPhone])));
    result.setProperty(runtime, "hostAddress",
                       hostAddress ? Value(String::createFromUtf8(runtime, hostAddress.UTF8String))
                                   : Value::null());
    return result;
}

static void installDebug(Runtime &runtime, Object &debug)
{
    debug.setProperty(runtime, "recordEvaluation", loader::native::makeRecordEvaluationFunction(runtime));
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

void registerNativePluginBridge(Runtime &runtime)
{
    uint64_t previous   = loader::native::runtimeGeneration();
    uint64_t generation = loader::native::registerRuntime(runtime);
    if (generation != previous)
    {
        invalidateRuntimeHooks(generation);
        invalidateRuntimeFabricSurfaces(generation);
    }
    Object bridge(runtime);
    bridge.setProperty(runtime, "apiVersion", String::createFromUtf8(runtime, kNativePluginApiVersion));
    bridge.setProperty(runtime, "abiVersion", String::createFromUtf8(runtime, kNativePluginAbiVersion));

    const char *names[] = {
        "native.objc.classes",
        "native.objc.invoke",
        "native.objc.invokeAsync",
        "native.objc.batch",
        "native.objc.snapshot",
        "native.objc.ivars",
        "native.objc.associations",
        "native.objc.hooks",
        "native.ffi.symbols",
        "native.ffi.call",
        "native.fabric.mount",
        "native.fabric.async",
        "native.runtime.events",
        "native.debug.evaluations",
        "native.debug.environment",
    };
    Array capabilities(runtime, std::size(names));
    for (size_t index = 0; index < std::size(names); index++)
    {
        capabilities.setValueAtIndex(runtime, index, String::createFromUtf8(runtime, names[index]));
    }
    bridge.setProperty(runtime, "capabilities", std::move(capabilities));

    Object objc(runtime);
    installObjC(runtime, objc);
    bridge.setProperty(runtime, "objc", std::move(objc));

    Object ffi(runtime);
    installFFI(runtime, ffi);
    bridge.setProperty(runtime, "ffi", std::move(ffi));

    Object fabric(runtime);
    installFabric(runtime, fabric);
    bridge.setProperty(runtime, "fabric", std::move(fabric));

    Object debug(runtime);
    installDebug(runtime, debug);
    bridge.setProperty(runtime, "debug", std::move(debug));

    runtime.global().setProperty(runtime, "NativePlugin", std::move(bridge));
}

}
