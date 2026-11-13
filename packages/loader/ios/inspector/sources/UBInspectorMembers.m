#import <dlfcn.h>

#import "FLEXPropertyAttributes.h"
#import "FLEXRuntimeUtility.h"
#import "FLEXTypeEncodingParser.h"
#import "UBInspectorInternal.h"

// Every member is built from runtime C functions only: no message reaches the inspected class, so
// listing a class never runs its +initialize or a +resolveInstanceMethod:.

BOOL UBIsMemberKind(NSString *kind)
{
    return [@[ @"properties", @"ivars", @"methods", @"classMethods", @"protocols" ]
        containsObject:kind];
}

static NSString *UBType(const char *encoding)
{
    return [FLEXRuntimeUtility readableTypeForEncoding:@(encoding ?: "")];
}

static void UBSetImage(NSMutableDictionary *member, const void *address)
{
    Dl_info info;
    if (address && dladdr(address, &info) && info.dli_fname)
        member[@"image"] = @(info.dli_fname);
}

static NSDictionary *UBPropertyMember(Class cls, objc_property_t property, BOOL classProperty)
{
    NSString               *name       = @(property_getName(property));
    FLEXPropertyAttributes *attributes = [FLEXPropertyAttributes attributesForProperty:property];
    NSString               *type       = UBType(attributes.typeEncoding.UTF8String);

    NSMutableArray<NSString *> *flags = [NSMutableArray new];
    if (attributes.isNonatomic)
        [flags addObject:@"nonatomic"];
    if (attributes.isRetained)
        [flags addObject:@"strong"];
    if (attributes.isCopy)
        [flags addObject:@"copy"];
    if (attributes.isWeak)
        [flags addObject:@"weak"];
    if (attributes.isReadOnly)
        [flags addObject:@"readonly"];
    if (attributes.isDynamic)
        [flags addObject:@"dynamic"];
    if (classProperty)
        [flags addObject:@"class"];

    NSString                   *getter   = attributes.customGetterString ?: name;
    NSMutableArray<NSString *> *declared = flags.mutableCopy;
    if (attributes.customGetterString)
        [declared addObject:[@"getter=" stringByAppendingString:getter]];
    if (attributes.customSetterString)
        [declared addObject:[@"setter=" stringByAppendingString:attributes.customSetterString]];

    NSMutableDictionary *member = [@{
        @"name" : name,
        @"kind" : @"properties",
        @"type" : type,
        @"signature" : [NSString stringWithFormat:@"@property (%@) %@",
                                                  [declared componentsJoinedByString:@", "],
                                                  [FLEXRuntimeUtility appendName:name toType:type]],
        @"attributes" : flags,
        @"getter" : getter,
        @"read" : UBPropertyRead(cls, property, classProperty),
    } mutableCopy];
    if (attributes.typeEncoding)
        member[@"encoding"] = attributes.typeEncoding;
    if (attributes.backingIvar.length)
        member[@"ivar"] = attributes.backingIvar;
    if (!attributes.isReadOnly && name.length)
    {
        member[@"setter"] =
            attributes.customSetterString
                ?: [NSString
                       stringWithFormat:@"set%@%@:", [name substringToIndex:1].uppercaseString,
                                        [name substringFromIndex:1]];
    }
    return member;
}

static NSDictionary *UBIvarMember(Class cls, Ivar ivar)
{
    const char          *encoding = ivar_getTypeEncoding(ivar) ?: "";
    NSMutableDictionary *member   = [@{
        @"name" : @(ivar_getName(ivar) ?: "?"),
        @"kind" : @"ivars",
        @"type" : UBType(encoding),
        @"encoding" : @(encoding),
        @"offset" : @(ivar_getOffset(ivar)),
        @"read" : UBIvarRead(cls, ivar),
    } mutableCopy];

    ssize_t size =
        encoding[0] ? [FLEXTypeEncodingParser sizeForTypeEncoding:@(encoding) alignment:NULL] : -1;
    if (size >= 0)
        member[@"size"] = @(size);
    if (encoding[0] == '@' && UBIvarIsWeak(cls, ivar))
        member[@"attributes"] = @[ @"weak" ];
    return member;
}

static NSDictionary *UBMethodMember(Method method, BOOL classMethod)
{
    NSString *name           = NSStringFromSelector(method_getName(method));
    char     *returnEncoding = method_copyReturnType(method);
    NSString *returnType     = UBType(returnEncoding);
    free(returnEncoding);

    unsigned int                count       = method_getNumberOfArguments(method);
    NSArray<NSString *>        *parts       = [name componentsSeparatedByString:@":"];
    NSMutableArray<NSString *> *parameters  = [NSMutableArray new];
    NSMutableArray<NSString *> *declaration = [NSMutableArray new];
    for (unsigned int index = 2; index < count; index++)
    {
        char     *argument = method_copyArgumentType(method, index);
        NSString *type     = UBType(argument);
        free(argument);

        [parameters addObject:type];
        NSString *part = index - 2 < parts.count ? parts[index - 2] : @"";
        [declaration addObject:[NSString stringWithFormat:@"%@:(%@)arg%u", part, type, index - 1]];
    }

    NSString *selector = declaration.count ? [declaration componentsJoinedByString:@" "] : name;
    NSMutableDictionary *member = [@{
        @"name" : name,
        @"kind" : classMethod ? @"classMethods" : @"methods",
        @"signature" : [NSString
            stringWithFormat:@"%@ (%@)%@", classMethod ? @"+" : @"-", returnType, selector],
        @"returnType" : returnType,
        @"parameters" : parameters,
        @"encoding" : @(method_getTypeEncoding(method) ?: ""),
        @"read" : UBReadNever,
    } mutableCopy];
    UBSetImage(member, (const void *) method_getImplementation(method));
    return member;
}

static NSDictionary *UBProtocolMember(Protocol *protocol)
{
    NSMutableDictionary *member = [@{
        @"name" : @(protocol_getName(protocol)),
        @"kind" : @"protocols",
        @"read" : UBReadNever,
    } mutableCopy];
    UBSetImage(member, (__bridge const void *) protocol);
    return member;
}

/** One member of a cached list: its name to sort and filter by, and its result, built the first
 * time a page shows it. */
@interface                            UBInspectorMemberEntry : NSObject
@property (nonatomic, copy) NSString *name;
@property (nonatomic, copy) NSString *kind;
@property (nonatomic, copy) NSDictionary * (^build)(void);
@property (nonatomic) NSDictionary *member;
@end

@implementation UBInspectorMemberEntry
@end

/** The entry's result; a member that fails to build becomes a bare `never` row naming the failure.
 */
static NSDictionary *UBEntryMember(UBInspectorMemberEntry *entry)
{
    @synchronized(entry)
    {
        if (entry.member)
            return entry.member;

        @try
        {
            entry.member = entry.build();
        }
        @catch (NSException *exception)
        {
            entry.member = @{
                @"name" : entry.name,
                @"kind" : entry.kind,
                @"type" : UBTruncate(exception.reason),
                @"read" : UBReadNever
            };
        }
        entry.build = nil;
        return entry.member;
    }
}

static void UBAddEntry(NSMutableArray<UBInspectorMemberEntry *> *entries, const char *name,
                       NSString *kind, NSDictionary * (^build)(void) )
{
    UBInspectorMemberEntry *entry = [UBInspectorMemberEntry new];
    entry.name                    = @(name ?: "?");
    entry.kind                    = kind;
    entry.build                   = build;
    [entries addObject:entry];
}

static NSArray<UBInspectorMemberEntry *> *UBBuildEntries(Class cls, NSString *kind)
{
    NSMutableArray<UBInspectorMemberEntry *> *members = [NSMutableArray new];
    unsigned int                              count   = 0;

    if ([kind isEqualToString:@"properties"])
    {
        for (int pass = 0; pass < 2; pass++)
        {
            BOOL             classProperty = pass == 1;
            objc_property_t *properties =
                class_copyPropertyList(classProperty ? object_getClass(cls) : cls, &count);
            for (unsigned int index = 0; index < count; index++)
            {
                objc_property_t property = properties[index];
                UBAddEntry(members, property_getName(property), kind,
                           ^{ return UBPropertyMember(cls, property, classProperty); });
            }
            free(properties);
        }
    }
    else if ([kind isEqualToString:@"ivars"])
    {
        Ivar *ivars = class_copyIvarList(cls, &count);
        for (unsigned int index = 0; index < count; index++)
        {
            Ivar ivar = ivars[index];
            UBAddEntry(members, ivar_getName(ivar), kind, ^{ return UBIvarMember(cls, ivar); });
        }
        free(ivars);
    }
    else if ([kind isEqualToString:@"methods"] || [kind isEqualToString:@"classMethods"])
    {
        BOOL    classMethod = [kind isEqualToString:@"classMethods"];
        Method *methods = class_copyMethodList(classMethod ? object_getClass(cls) : cls, &count);
        for (unsigned int index = 0; index < count; index++)
        {
            Method method = methods[index];
            UBAddEntry(members, sel_getName(method_getName(method)), kind,
                       ^{ return UBMethodMember(method, classMethod); });
        }
        free(methods);
    }
    else if ([kind isEqualToString:@"protocols"])
    {
        Protocol *__unsafe_unretained *protocols = class_copyProtocolList(cls, &count);
        for (unsigned int index = 0; index < count; index++)
        {
            Protocol *protocol = protocols[index];
            UBAddEntry(members, protocol_getName(protocol), kind,
                       ^{ return UBProtocolMember(protocol); });
        }
        free(protocols);
    }

    [members sortUsingComparator:^NSComparisonResult(UBInspectorMemberEntry *left,
                                                     UBInspectorMemberEntry *right) {
        return [left.name caseInsensitiveCompare:right.name];
    }];
    return members;
}

// A class's entries of one kind, rebuilt when the runtime has since added members (a category, KVO,
// a hook).
static NSArray<UBInspectorMemberEntry *> *UBEntries(Class cls, NSString *kind)
{
    static NSCache<NSString *, NSArray<UBInspectorMemberEntry *> *> *cache;
    static dispatch_once_t                                           once;
    dispatch_once(&once, ^{
        cache            = [NSCache new];
        cache.countLimit = 128;
    });

    // Keyed by the class's address: a Class in a collection would be sent -hash, running its
    // +initialize.
    NSString *key = [NSString stringWithFormat:@"%p.%@", (__bridge void *) cls, kind];
    NSArray<UBInspectorMemberEntry *> *entries = [cache objectForKey:key];
    if (!entries || entries.count != UBMemberCount(cls, kind))
    {
        entries = UBBuildEntries(cls, kind);
        [cache setObject:entries forKey:key];
    }
    return entries;
}

NSDictionary *UBListMemberPage(Class cls, NSString *kind, NSUInteger offset, NSUInteger limit,
                               NSString *filter)
{
    NSDictionary *page = UBPage(UBEntries(cls, kind), @"members", offset, limit, filter,
                                ^NSString *(UBInspectorMemberEntry *entry) { return entry.name; });

    NSMutableArray<NSDictionary *> *members = [NSMutableArray new];
    for (UBInspectorMemberEntry *entry in page[@"members"])
        [members addObject:UBEntryMember(entry)];
    return @{@"total" : page[@"total"], @"members" : members};
}

NSUInteger UBMemberCount(Class cls, NSString *kind)
{
    unsigned int count = 0, classCount = 0;
    if ([kind isEqualToString:@"properties"])
    {
        free(class_copyPropertyList(cls, &count));
        free(class_copyPropertyList(object_getClass(cls), &classCount));
    }
    else if ([kind isEqualToString:@"ivars"])
    {
        free(class_copyIvarList(cls, &count));
    }
    else if ([kind isEqualToString:@"methods"])
    {
        free(class_copyMethodList(cls, &count));
    }
    else if ([kind isEqualToString:@"classMethods"])
    {
        free(class_copyMethodList(object_getClass(cls), &count));
    }
    else if ([kind isEqualToString:@"protocols"])
    {
        free(class_copyProtocolList(cls, &count));
    }
    return count + classCount;
}
