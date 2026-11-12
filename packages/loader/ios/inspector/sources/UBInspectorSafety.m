#import <dlfcn.h>

#import "FLEXObjcInternal.h"
#import "FLEXPropertyAttributes.h"
#import "FLEXRuntimeSafety.h"
#import "UBInspectorInternal.h"

/** The getters a value read is running; left behind only when one of them crashed Discord. */
static NSString *const UBInFlightKey = @"UBInspectorInFlight";
/** Members whose getters crashed Discord before, as `Class.kind.name`; they are never read again.
 */
static NSString *const UBDenyListKey = @"UBInspectorDenyList";
/** The deny list keeps the newest entries up to this many. */
static const NSUInteger UBDenyListLimit = 256;

static NSSet<NSString *> *UBDenied;

static NSString *UBMemberKey(Class cls, NSString *kind, NSString *name)
{
    return [NSString stringWithFormat:@"%s.%@.%@", class_getName(cls), kind, name];
}

static NSArray<NSString *> *UBStrings(id value)
{
    if (![value isKindOfClass:NSArray.class])
        return @[];

    NSIndexSet *indexes =
        [value indexesOfObjectsPassingTest:^BOOL(id item, NSUInteger index, BOOL *stop) {
            return [item isKindOfClass:NSString.class];
        }];
    return [value objectsAtIndexes:indexes];
}

void UBRecoverCrashedGetters(void)
{
    NSUserDefaults                  *defaults = NSUserDefaults.standardUserDefaults;
    NSMutableOrderedSet<NSString *> *denied =
        [NSMutableOrderedSet orderedSetWithArray:UBStrings([defaults objectForKey:UBDenyListKey])];
    NSArray<NSString *> *crashed = UBStrings([defaults objectForKey:UBInFlightKey]);

    if (crashed.count)
    {
        [denied addObjectsFromArray:crashed];
        if (denied.count > UBDenyListLimit)
            [denied removeObjectsInRange:NSMakeRange(0, denied.count - UBDenyListLimit)];

        [defaults setObject:denied.array forKey:UBDenyListKey];
        [defaults removeObjectForKey:UBInFlightKey];
        [defaults synchronize];
        NSLog(@"UnboundInspector: Denied getters that crashed the last run: %@", crashed);
    }

    UBDenied = denied.set;
}

BOOL UBMemberDenied(Class cls, NSString *kind, NSString *name)
{
    return [UBDenied containsObject:UBMemberKey(cls, kind, name)];
}

void UBBeginGetters(Class cls, NSString *kind, NSArray<NSString *> *names)
{
    NSMutableArray<NSString *> *keys = [NSMutableArray arrayWithCapacity:names.count];
    for (NSString *name in names)
        [keys addObject:UBMemberKey(cls, kind, name)];

    // synchronize waits for cfprefsd to take the write, so the record survives a crash in the next
    // getter.
    [NSUserDefaults.standardUserDefaults setObject:keys forKey:UBInFlightKey];
    [NSUserDefaults.standardUserDefaults synchronize];
}

void UBEndGetters(void)
{
    NSUserDefaults *defaults = NSUserDefaults.standardUserDefaults;
    if (![defaults objectForKey:UBInFlightKey])
        return;

    [defaults removeObjectForKey:UBInFlightKey];
    [defaults synchronize];
}

BOOL UBClassIsSafe(Class cls)
{
    if (FLEXClassIsSafe(cls))
        return YES;
    if (!cls || CFSetContainsValue(FLEXKnownUnsafeClasses, (__bridge void *) cls))
        return NO;

    // FLEX accepts only NSObject and NSProxy as roots; Swift classes root at SwiftObject, which
    // retains and reflects like NSObject.
    Class root = cls;
    while (class_getSuperclass(root))
        root = class_getSuperclass(root);
    const char *name = class_getName(root);
    return strcmp(name, "_TtCs12_SwiftObject") == 0 || strcmp(name, "SwiftObject") == 0;
}

BOOL UBPointerIsObject(const void *pointer)
{
    if (FLEXPointerIsValidObjcObject(pointer))
        return YES;

    // FLEX also requires a heap allocation, which rejects static objects such as constant strings.
    // Accept a pointer inside a loaded image whose isa chain reads as a class.
    Dl_info info;
    if (!pointer || (uintptr_t) pointer % sizeof(uintptr_t) || !dladdr(pointer, &info))
        return NO;
    if (!FLEXPointerIsReadable(pointer))
        return NO;

    Class cls = object_getClass((__bridge id) pointer);
    if (!cls || !FLEXPointerIsReadable((__bridge void *) cls))
        return NO;

    Class metaclass = object_getClass(cls);
    return metaclass && FLEXPointerIsReadable((__bridge void *) metaclass) && object_isClass(cls);
}

// objc4's isScanned: whether the word at `offset` falls in a scanned run of an ARC ivar layout.
static BOOL UBLayoutScans(const uint8_t *layout, ptrdiff_t offset)
{
    if (!layout || offset < 0)
        return NO;

    ptrdiff_t index = 0, target = offset / (ptrdiff_t) sizeof(void *);
    uint8_t   byte;
    while ((byte = *layout++))
    {
        index += byte >> 4;
        if (index > target)
            return NO;
        index += byte & 0x0F;
        if (index > target)
            return YES;
    }
    return NO;
}

BOOL UBIvarIsWeak(Class cls, Ivar ivar)
{
    // Layouts cover only the class's own ivars, from its aligned instance start: the superclass's
    // size.
    Class     superclass = class_getSuperclass(cls);
    ptrdiff_t local =
        ivar_getOffset(ivar) - (ptrdiff_t) (superclass ? class_getInstanceSize(superclass) : 0);
    if (UBLayoutScans(class_getIvarLayout(cls), local))
        return NO;
    return UBLayoutScans(class_getWeakIvarLayout(cls), local);
}

/** Whether a type encoding can be read from memory: anything but empty, unknown or void. */
static BOOL UBEncodingReadable(const char *encoding)
{
    return encoding && encoding[0] && encoding[0] != '?' && encoding[0] != 'v';
}

NSString *UBIvarRead(Class cls, Ivar ivar)
{
    if (!UBClassIsSafe(cls) || !FLEXIvarIsSafe(ivar))
        return UBReadNever;
    if (UBMemberDenied(cls, @"ivars", @(ivar_getName(ivar) ?: "")))
        return UBReadNever;
    return UBReadAuto;
}

NSString *UBPropertyRead(Class cls, objc_property_t property, BOOL classProperty)
{
    NSString *name = @(property_getName(property));
    if (!UBClassIsSafe(cls) || UBMemberDenied(cls, @"properties", name))
        return UBReadNever;
    if (classProperty)
        return UBReadManual;

    NSString *backing = [FLEXPropertyAttributes attributesForProperty:property].backingIvar;
    Ivar      ivar    = backing.length ? class_getInstanceVariable(cls, backing.UTF8String) : NULL;
    if (!ivar || !FLEXIvarIsSafe(ivar) || !UBEncodingReadable(ivar_getTypeEncoding(ivar)))
        return UBReadManual;
    return UBReadAuto;
}
