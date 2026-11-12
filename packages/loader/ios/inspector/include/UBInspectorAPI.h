// The contract between Unbound.dylib and UnboundInspector.dylib, which Unbound.dylib dlopens only
// when developer mode or the debugger is on. Results are Foundation objects (NSDictionary, NSArray,
// NSString, NSNumber, NSNull); the loader converts them to JS. Every function catches its own
// exceptions and reports them as `{ "error": "<message>" }` instead of throwing.
#pragma once

#import <Foundation/Foundation.h>

/** Bump when a function's arguments or result shape change; the loader refuses a table of another
 * version. */
#define UB_INSPECTOR_ABI_VERSION 1

/** The symbol the loader dlsyms. */
#define UB_INSPECTOR_ENTRY_SYMBOL "UBInspectorGetAPI"

typedef struct UBInspectorAPI {
    uint32_t version;

    /**
     * The class chain of a class from itself to its root:
     * `[{ name, superclass, image, instanceSize, counts: { properties, ivars, methods,
     * classMethods, protocols } }]`. Metadata only; safe off the main thread.
     */
    NSDictionary *(*describeClass)(Class cls);

    /**
     * One page of one kind of a class's own (not inherited) members, filtered by a case-insensitive
     * substring:
     * `{ total, members: [...] }`. `kind` is `properties`, `ivars`, `methods`, `classMethods` or
     * `protocols`. Metadata only; safe off the main thread. Pages come from a per-class cache.
     */
    NSDictionary *(*listMembers)(Class cls, NSString *kind, NSUInteger offset, NSUInteger limit,
                                 NSString *filter);

    /**
     * Reads named `properties` or `ivars` of `cls` on `object`: `{ values: [{ name, kind, text,
     * object?, className? }] }`. `object` holds the raw value for `kind: "object"`, which the
     * loader wraps in a handle. Runs getters only when `invokeGetters` is YES and the property is
     * not on the unsafe list. Call on the main thread.
     */
    NSDictionary *(*readValues)(id object, Class cls, NSString *kind, NSArray<NSString *> *names,
                                BOOL invokeGetters);

    /** One page of loaded images that define Objective-C classes: `{ total, images: [{ path, name,
     * classCount }] }`. */
    NSDictionary *(*listImages)(NSUInteger offset, NSUInteger limit, NSString *filter);

    /** One page of the class names an image defines, sorted: `{ total, classes: [name] }`. */
    NSDictionary *(*listClasses)(NSString *imagePath, NSUInteger offset, NSUInteger limit,
                                 NSString *filter);
} UBInspectorAPI;

/** Returns the table, or NULL when `abiVersion` is not `UB_INSPECTOR_ABI_VERSION`. */
typedef const UBInspectorAPI *(*UBInspectorGetAPIFunction)(uint32_t abiVersion);
