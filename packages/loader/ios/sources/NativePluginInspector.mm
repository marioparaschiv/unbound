#import "NativePluginInspector.h"

#import <Foundation/Foundation.h>
#include <algorithm>
#include <cmath>
#import <dlfcn.h>
#include <mutex>
#import <objc/runtime.h>
#import <rootless.h>
#include <string>

#include "LoaderPreferences.h"
#import "Logger.h"
#import "NativePluginObjCValues.h"
#import "NativePluginRuntime.h"
#import "NativePluginThreading.h"
#import "SettingsCore.h"

#import "../inspector/include/UBInspectorAPI.h"

using namespace facebook;
using namespace facebook::jsi;
using loader::native::NativeCodedError;

namespace loader::ios {
namespace {
    constexpr NSUInteger kDefaultPageLimit = 100;
    constexpr NSUInteger kMaxPageLimit     = 200;
    constexpr size_t     kMaxValueNames    = 50;

    struct InspectorLoad {
        const UBInspectorAPI *api = nullptr;
        std::string           error;
    };

    struct InspectPage {
        NSUInteger offset = 0;
        NSUInteger limit  = kDefaultPageLimit;
        NSString  *filter = nil;
    };
}

// Reads the settings on every call, so switching developer mode or the debugger takes effect at
// once.
static bool inspectorAllowed()
{
#ifdef DEBUG
    bool debugBuild = true;
#else
    bool debugBuild = false;
#endif
    return loader::preferences::inspectorEnabled(UnboundSettingsStore(), debugBuild);
}

static void addCandidate(NSMutableArray<NSString *> *paths, NSString *path)
{
    if (path.length && ![paths containsObject:path])
    {
        [paths addObject:path];
    }
}

// The IPA ships the library beside Unbound.dylib in Frameworks/; a jailbreak installs it under the
// root.
static NSArray<NSString *> *inspectorCandidates()
{
    NSMutableArray<NSString *> *paths = [NSMutableArray arrayWithCapacity:3];
    Dl_info                     info;
    if (dladdr((const void *) &inspectorCandidates, &info) && info.dli_fname)
    {
        NSString *loader = [NSString stringWithUTF8String:info.dli_fname];
        addCandidate(paths, [loader.stringByDeletingLastPathComponent
                                stringByAppendingPathComponent:@"UnboundInspector.dylib"]);
    }
    addCandidate(paths, [NSBundle.mainBundle.privateFrameworksPath
                            stringByAppendingPathComponent:@"UnboundInspector.dylib"]);
    addCandidate(paths, ROOT_PATH_NS(@"/Library/Application Support/Unbound/UnboundInspector"));
    return paths;
}

static InspectorLoad openInspector()
{
    NSArray<NSString *> *candidates = inspectorCandidates();
    NSString            *path       = nil;
    for (NSString *candidate in candidates)
    {
        if ([NSFileManager.defaultManager fileExistsAtPath:candidate])
        {
            path = candidate;
            break;
        }
    }
    if (!path)
    {
        return {nullptr, std::string("UnboundInspector.dylib was not found in ") +
                             [candidates componentsJoinedByString:@", "].UTF8String};
    }

    void *image = dlopen(path.fileSystemRepresentation, RTLD_NOW | RTLD_LOCAL);
    if (!image)
    {
        const char *reason = dlerror();
        return {nullptr, reason ? reason : "dlopen failed"};
    }
    // The image stays loaded for the process's life; tables it returned may still be in use.
    auto entry =
        reinterpret_cast<UBInspectorGetAPIFunction>(dlsym(image, UB_INSPECTOR_ENTRY_SYMBOL));
    if (!entry)
    {
        return {nullptr,
                std::string(path.UTF8String) + " does not export " + UB_INSPECTOR_ENTRY_SYMBOL};
    }
    const UBInspectorAPI *api = entry(UB_INSPECTOR_ABI_VERSION);
    if (!api || api->version != UB_INSPECTOR_ABI_VERSION)
    {
        return {nullptr, std::string(path.UTF8String) + " does not implement inspector ABI " +
                             std::to_string(UB_INSPECTOR_ABI_VERSION)};
    }
    return {api, ""};
}

// Loads once; a failure is remembered so later calls answer at once with the same reason.
static const InspectorLoad &loadedInspector()
{
    static InspectorLoad  load;
    static std::once_flag once;
    std::call_once(once, [] {
        load = openInspector();
        if (!load.api)
        {
            [Logger error:LOG_CATEGORY_PLUGINS
                   format:@"Failed to load the native inspector: %s", load.error.c_str()];
        }
    });
    return load;
}

static const UBInspectorAPI &requireInspector()
{
    if (!inspectorAllowed())
    {
        throw NativeCodedError("INSPECTOR_DISABLED",
                               "The native inspector needs developer mode or the debugger");
    }
    const InspectorLoad &load = loadedInspector();
    if (!load.api)
    {
        throw NativeCodedError("INSPECTOR_UNAVAILABLE",
                               "The native inspector is unavailable: " + load.error);
    }
    return *load.api;
}

static Class requireClass(NSString *name)
{
    Class cls = name.length ? NSClassFromString(name) : Nil;
    if (!cls)
    {
        throw NativeCodedError("INSPECTOR_UNKNOWN_CLASS",
                               std::string("No Objective-C class is named ") +
                                   (name.UTF8String ?: ""));
    }
    return cls;
}

static NSDictionary *checkedResult(id result, const char *operation)
{
    if (![result isKindOfClass:[NSDictionary class]])
    {
        throw NativeCodedError(loader::native::kNativeBridgeErrorCode,
                               std::string("Failed to ") + operation +
                                   ": the inspector returned no result");
    }
    id error = ((NSDictionary *) result)[@"error"];
    if ([error isKindOfClass:[NSString class]])
    {
        throw NativeCodedError(loader::native::kNativeBridgeErrorCode,
                               std::string("Failed to ") + operation + ": " +
                                   (((NSString *) error).UTF8String ?: "unknown error"));
    }
    return result;
}

static NSUInteger pageNumber(Runtime &runtime, const Object &page, const char *name,
                             NSUInteger fallback, const char *method)
{
    Value value = page.getProperty(runtime, name);
    if (value.isUndefined())
    {
        return fallback;
    }
    double number = value.isNumber() ? value.getNumber() : -1;
    if (!(number >= 0) || std::floor(number) != number || number > 1e9)
    {
        throw JSError(runtime, std::string(method) + " expects page." + name +
                                   " to be a non-negative integer");
    }
    return (NSUInteger) number;
}

static InspectPage parsePage(Runtime &runtime, const Value *args, size_t count, size_t index,
                             const char *method)
{
    InspectPage page;
    if (index >= count || args[index].isUndefined() || args[index].isNull())
    {
        return page;
    }
    if (!args[index].isObject())
    {
        throw JSError(runtime, std::string(method) + " expects a page object");
    }
    Object options = args[index].asObject(runtime);
    page.offset    = pageNumber(runtime, options, "offset", 0, method);
    page.limit     = std::clamp<NSUInteger>(
        pageNumber(runtime, options, "limit", kDefaultPageLimit, method), 1, kMaxPageLimit);
    Value filter = options.getProperty(runtime, "filter");
    page.filter  = filter.isString() && filter.asString(runtime).length(runtime)
                       ? jsiString(runtime, filter)
                       : nil;
    return page;
}

static bool objectIsKindOf(id object, Class cls)
{
    for (Class current = object_getClass(object); current; current = class_getSuperclass(current))
    {
        if (current == cls)
        {
            return true;
        }
    }
    return false;
}

static Value inspectClass(Runtime &runtime, const Value *args, size_t count)
{
    const UBInspectorAPI &api = requireInspector();
    if (count == 0)
    {
        throw JSError(runtime, "objc.inspectClass expects an object, class or class name");
    }
    Class cls = Nil;
    if (args[0].isString())
    {
        cls = requireClass(jsiString(runtime, args[0]));
    }
    else
    {
        id target = objcValue(runtime, args[0]);
        if (!target)
        {
            throw JSError(runtime, "objc.inspectClass expects an object, class or class name");
        }
        cls = object_isClass(target) ? (Class) target : object_getClass(target);
    }
    NSDictionary *result = checkedResult(api.describeClass(cls), "describe a class");
    return objcJSIValue(runtime, result[@"chain"] ?: @[]);
}

static Value inspectMembers(Runtime &runtime, const Value *args, size_t count)
{
    const UBInspectorAPI &api = requireInspector();
    if (count < 2 || !args[0].isString() || !args[1].isString())
    {
        throw JSError(runtime, "objc.inspectMembers expects a class name and a member kind");
    }
    Class     cls  = requireClass(jsiString(runtime, args[0]));
    NSString *kind = jsiString(runtime, args[1]);
    if (![@[ @"properties", @"ivars", @"methods", @"classMethods", @"protocols" ]
            containsObject:kind])
    {
        throw JSError(runtime, "objc.inspectMembers expects properties, ivars, methods, "
                               "classMethods or protocols");
    }
    InspectPage page = parsePage(runtime, args, count, 2, "objc.inspectMembers");
    return objcJSIValue(
        runtime, checkedResult(api.listMembers(cls, kind, page.offset, page.limit, page.filter),
                               "list class members"));
}

static Value inspectedValues(Runtime &runtime, NSDictionary *result)
{
    NSArray *values = result[@"values"];
    if (![values isKindOfClass:[NSArray class]])
    {
        return Array(runtime, 0);
    }
    Array array(runtime, values.count);
    for (NSUInteger index = 0; index < values.count; index++)
    {
        NSDictionary *entry = values[index];
        if (![entry isKindOfClass:[NSDictionary class]])
        {
            array.setValueAtIndex(runtime, index, Value::null());
            continue;
        }
        id                   object = entry[@"object"];
        NSMutableDictionary *plain  = [entry mutableCopy];
        [plain removeObjectForKey:@"object"];
        Object item = objcJSIValue(runtime, plain).asObject(runtime);
        if (object && object != [NSNull null])
        {
            item.setProperty(runtime, "object", objcHandleResult(runtime, object));
        }
        array.setValueAtIndex(runtime, index, std::move(item));
    }
    return array;
}

static Value inspectValues(Runtime &runtime, const Value *args, size_t count)
{
    const UBInspectorAPI &api = requireInspector();
    if (count < 4 || !args[1].isString() || !args[2].isString() || !args[3].isObject() ||
        !args[3].asObject(runtime).isArray(runtime))
    {
        throw JSError(runtime, "objc.inspectValues expects an object, class name, member kind "
                               "and member names");
    }
    id object = objcValue(runtime, args[0]);
    if (!object || object_isClass(object))
    {
        throw JSError(runtime, "objc.inspectValues expects an object handle");
    }
    Class     cls  = requireClass(jsiString(runtime, args[1]));
    NSString *kind = jsiString(runtime, args[2]);
    if (![kind isEqualToString:@"properties"] && ![kind isEqualToString:@"ivars"])
    {
        throw JSError(runtime, "objc.inspectValues reads properties or ivars");
    }
    // Ivar offsets come from `cls`, so reading them on an object of another class would read past
    // it.
    if (!objectIsKindOf(object, cls))
    {
        throw JSError(runtime, std::string("objc.inspectValues: the object is not a ") +
                                   NSStringFromClass(cls).UTF8String);
    }
    Array list = args[3].asObject(runtime).asArray(runtime);
    if (list.size(runtime) > kMaxValueNames)
    {
        throw JSError(runtime, "objc.inspectValues reads at most 50 names at once");
    }
    NSMutableArray<NSString *> *names = [NSMutableArray arrayWithCapacity:list.size(runtime)];
    for (size_t index = 0; index < list.size(runtime); index++)
    {
        Value name = list.getValueAtIndex(runtime, index);
        if (!name.isString())
        {
            throw JSError(runtime, "objc.inspectValues expects member names as strings");
        }
        [names addObject:jsiString(runtime, name)];
    }
    BOOL invokeGetters = NO;
    if (count > 4 && args[4].isObject())
    {
        Value option  = args[4].asObject(runtime).getProperty(runtime, "invokeGetters");
        invokeGetters = option.isBool() && option.getBool();
    }

    const UBInspectorAPI *table = &api;
    NSMutableDictionary  *read  = [NSMutableDictionary dictionaryWithCapacity:1];
    return executeMainAsynchronously(
        runtime,
        [table, read, object, cls, kind, names, invokeGetters]() {
            read[@"result"] = table->readValues(object, cls, kind, names, invokeGetters) ?: @{};
        },
        [read](Runtime &completion) -> Value {
            return inspectedValues(completion, checkedResult(read[@"result"], "read values"));
        });
}

static Value inspectImages(Runtime &runtime, const Value *args, size_t count)
{
    const UBInspectorAPI &api  = requireInspector();
    InspectPage           page = parsePage(runtime, args, count, 0, "objc.inspectImages");
    return objcJSIValue(runtime, checkedResult(api.listImages(page.offset, page.limit, page.filter),
                                               "list images"));
}

static Value inspectClasses(Runtime &runtime, const Value *args, size_t count)
{
    const UBInspectorAPI &api = requireInspector();
    if (count == 0 || !args[0].isString())
    {
        throw JSError(runtime, "objc.inspectClasses expects an image path");
    }
    NSString   *image = jsiString(runtime, args[0]);
    InspectPage page  = parsePage(runtime, args, count, 1, "objc.inspectClasses");
    return objcJSIValue(runtime,
                        checkedResult(api.listClasses(image, page.offset, page.limit, page.filter),
                                      "list an image's classes"));
}

using InspectMethod = Value (*)(Runtime &, const Value *, size_t);

// Mirrors the bridge's own wrapper: an Objective-C exception becomes a coded JavaScript error.
static Value inspectFunction(Runtime &runtime, const char *name, unsigned int argCount,
                             InspectMethod method)
{
    return loader::native::makeFunction(
        runtime, name, argCount,
        [method](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
            @try
            {
                return method(rt, args, count);
            }
            @catch (NSException *exception)
            {
                throw NativeCodedError(loader::native::kNativeBridgeErrorCode,
                                       std::string("Objective-C exception: ") +
                                           (exception.reason.UTF8String ?: "unknown"));
            }
        });
}

void installInspector(Runtime &runtime, Object &objc)
{
    objc.setProperty(runtime, "inspectClass",
                     inspectFunction(runtime, "inspectClass", 1, inspectClass));
    objc.setProperty(runtime, "inspectMembers",
                     inspectFunction(runtime, "inspectMembers", 3, inspectMembers));
    objc.setProperty(runtime, "inspectValues",
                     inspectFunction(runtime, "inspectValues", 5, inspectValues));
    objc.setProperty(runtime, "inspectImages",
                     inspectFunction(runtime, "inspectImages", 1, inspectImages));
    objc.setProperty(runtime, "inspectClasses",
                     inspectFunction(runtime, "inspectClasses", 2, inspectClasses));
}
}
