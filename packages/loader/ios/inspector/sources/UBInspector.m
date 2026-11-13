#import <mach-o/dyld.h>
#import <mach-o/getsect.h>
#import <objc/runtime.h>

#import "UBInspectorAPI.h"
#import "UBInspectorInternal.h"

NSString *const UBReadAuto   = @"auto";
NSString *const UBReadManual = @"manual";
NSString *const UBReadNever  = @"never";

NSString *UBTruncate(NSString *text)
{
    if (![text isKindOfClass:NSString.class])
        return @"";
    if (text.length <= UB_TEXT_LIMIT)
        return text;

    NSRange range = [text rangeOfComposedCharacterSequencesForRange:NSMakeRange(0, UB_TEXT_LIMIT)];
    return [[text substringWithRange:NSMakeRange(0, MIN(range.length, UB_TEXT_LIMIT))]
        stringByAppendingString:@"…"];
}

NSDictionary *UBErrorFromException(NSString *operation, NSException *exception)
{
    NSString *reason = [exception isKindOfClass:NSException.class]
                           ? exception.reason ?: exception.name
                           : @"unknown error";
    return @{
        @"error" : UBTruncate([NSString stringWithFormat:@"Failed to %@: %@", operation, reason])
    };
}

NSDictionary *UBPage(NSArray *items, NSString *key, NSUInteger offset, NSUInteger limit,
                     NSString *filter, NSString * (^nameOf)(id item))
{
    NSArray *matches = items;
    if ([filter isKindOfClass:NSString.class] && filter.length)
    {
        NSIndexSet *indexes =
            [items indexesOfObjectsPassingTest:^BOOL(id item, NSUInteger index, BOOL *stop) {
                return
                    [nameOf(item) rangeOfString:filter options:NSCaseInsensitiveSearch].location !=
                    NSNotFound;
            }];
        matches = [items objectsAtIndexes:indexes];
    }

    NSUInteger size   = limit == 0 ? UB_PAGE_DEFAULT : MIN(limit, (NSUInteger) UB_PAGE_LIMIT);
    NSUInteger start  = MIN(offset, matches.count);
    NSUInteger length = MIN(size, matches.count - start);
    return @{
        @"total" : @(matches.count),
        key : [matches subarrayWithRange:NSMakeRange(start, length)]
    };
}

static id UBNullable(const char *string)
{
    return string ? @(string) : (id) NSNull.null;
}

static NSDictionary *UBDescribeClass(Class cls)
{
    @try
    {
        if (!cls)
            return @{@"error" : @"Failed to describe class: no class given"};

        NSMutableArray *chain = [NSMutableArray new];
        for (Class current = cls; current && chain.count < UB_CHAIN_LIMIT;
             current       = class_getSuperclass(current))
        {
            NSMutableDictionary *counts = [NSMutableDictionary new];
            for (NSString *kind in
                 @[ @"properties", @"ivars", @"methods", @"classMethods", @"protocols" ])
            {
                counts[kind] = @(UBMemberCount(current, kind));
            }

            Class superclass = class_getSuperclass(current);
            [chain addObject:@{
                @"name" : @(class_getName(current)),
                @"superclass" : superclass ? @(class_getName(superclass)) : NSNull.null,
                @"image" : UBNullable(class_getImageName(current)),
                @"instanceSize" : @(class_getInstanceSize(current)),
                @"counts" : counts,
            }];
        }

        return @{@"chain" : chain};
    }
    @catch (NSException *exception)
    {
        return UBErrorFromException(
            [NSString stringWithFormat:@"describe class %s", class_getName(cls)], exception);
    }
}

static NSDictionary *UBListMembers(Class cls, NSString *kind, NSUInteger offset, NSUInteger limit,
                                   NSString *filter)
{
    @try
    {
        if (!cls)
            return @{@"error" : @"Failed to list members: no class given"};
        if (!UBIsMemberKind(kind))
        {
            return @{
                @"error" : UBTruncate(
                    [NSString stringWithFormat:@"Failed to list members: unknown kind %@", kind])
            };
        }

        return UBListMemberPage(cls, kind, offset, limit, filter);
    }
    @catch (NSException *exception)
    {
        return UBErrorFromException(
            [NSString stringWithFormat:@"list %@ of %s", kind, class_getName(cls)], exception);
    }
}

static NSDictionary *UBReadValuesGuarded(id object, Class cls, NSString *kind,
                                         NSArray<NSString *> *names, BOOL invokeGetters)
{
    @try
    {
        return UBReadValues(object, cls, kind, names, invokeGetters);
    }
    @catch (NSException *exception)
    {
        UBEndGetters();
        return UBErrorFromException(
            [NSString stringWithFormat:@"read %@ of %s", kind, class_getName(cls)], exception);
    }
}

// How many classes an image defines, from the size of its class list sections. Asking the runtime
// for the names instead reads every class's metadata and takes about 300 ms across Discord's
// images.
static unsigned long UBImageClassCount(const struct mach_header *header)
{
    static const char *const segments[] = {"__DATA", "__DATA_CONST", "__DATA_DIRTY", "__AUTH",
                                           "__AUTH_CONST"};
    unsigned long            total      = 0;
    for (size_t index = 0; index < sizeof(segments) / sizeof(*segments); index++)
    {
        unsigned long size = 0;
        if (getsectiondata((const struct mach_header_64 *) header, segments[index],
                           "__objc_classlist", &size))
        {
            total += size / sizeof(void *);
        }
    }
    return total;
}

// Every image that defines classes, rebuilt only when the number of loaded images changes.
static NSArray<NSDictionary *> *UBImages(void)
{
    static NSArray<NSDictionary *> *images;
    static unsigned int             imageCount;
    static NSLock                  *lock;
    static dispatch_once_t          once;
    dispatch_once(&once, ^{ lock = [NSLock new]; });

    [lock lock];
    @try
    {
        uint32_t count = _dyld_image_count();
        if (images && count == imageCount)
            return images;

        NSMutableArray<NSDictionary *> *built = [NSMutableArray new];
        for (uint32_t index = 0; index < count; index++)
        {
            const struct mach_header *header     = _dyld_get_image_header(index);
            const char               *name       = _dyld_get_image_name(index);
            unsigned long             classCount = header && name ? UBImageClassCount(header) : 0;
            if (!classCount)
                continue;

            NSString *path = @(name);
            [built addObject:@{
                @"path" : path,
                @"name" : path.lastPathComponent,
                @"classCount" : @(classCount)
            }];
        }

        [built sortUsingComparator:^NSComparisonResult(NSDictionary *left, NSDictionary *right) {
            return [left[@"name"] caseInsensitiveCompare:right[@"name"]];
        }];
        images     = built.copy;
        imageCount = count;
        return images;
    }
    @finally
    {
        [lock unlock];
    }
}

static NSDictionary *UBListImages(NSUInteger offset, NSUInteger limit, NSString *filter)
{
    @try
    {
        return UBPage(UBImages(), @"images", offset, limit, filter,
                      ^NSString *(NSDictionary *image) { return image[@"path"]; });
    }
    @catch (NSException *exception)
    {
        return UBErrorFromException(@"list images", exception);
    }
}

static NSDictionary *UBListClasses(NSString *imagePath, NSUInteger offset, NSUInteger limit,
                                   NSString *filter)
{
    static NSCache<NSString *, NSArray<NSString *> *> *cache;
    static dispatch_once_t                             once;
    dispatch_once(&once, ^{
        cache            = [NSCache new];
        cache.countLimit = 32;
    });

    @try
    {
        if (![imagePath isKindOfClass:NSString.class] || !imagePath.length)
        {
            return @{@"error" : @"Failed to list classes: no image path given"};
        }

        NSArray<NSString *> *classes = [cache objectForKey:imagePath];
        if (!classes)
        {
            unsigned int count = 0;
            const char **names =
                objc_copyClassNamesForImage(imagePath.fileSystemRepresentation, &count);
            NSMutableArray<NSString *> *built = [NSMutableArray arrayWithCapacity:count];
            for (unsigned int index = 0; index < count; index++)
                [built addObject:@(names[index])];
            free(names);

            classes = [built sortedArrayUsingSelector:@selector(caseInsensitiveCompare:)];
            [cache setObject:classes forKey:imagePath];
        }

        return UBPage(classes, @"classes", offset, limit, filter,
                      ^NSString *(NSString *name) { return name; });
    }
    @catch (NSException *exception)
    {
        return UBErrorFromException([NSString stringWithFormat:@"list classes of %@", imagePath],
                                    exception);
    }
}

static const UBInspectorAPI UBInspectorTable = {
    .version       = UB_INSPECTOR_ABI_VERSION,
    .describeClass = UBDescribeClass,
    .listMembers   = UBListMembers,
    .readValues    = UBReadValuesGuarded,
    .listImages    = UBListImages,
    .listClasses   = UBListClasses,
};

/** The only symbol the dylib exports; the loader dlsyms it by `UB_INSPECTOR_ENTRY_SYMBOL`. */
__attribute__((visibility("default"))) const UBInspectorAPI *UBInspectorGetAPI(uint32_t abiVersion)
{
    if (abiVersion != UB_INSPECTOR_ABI_VERSION)
        return NULL;

    static dispatch_once_t once;
    dispatch_once(&once, ^{
        @try
        {
            UBRecoverCrashedGetters();
        }
        @catch (NSException *exception)
        {
            NSLog(@"UnboundInspector: Failed to recover crashed getters: %@", exception);
        }
    });
    return &UBInspectorTable;
}
