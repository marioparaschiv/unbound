#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>
#import <objc/runtime.h>
#import <spawn.h>
#import <sys/stat.h>
#import <sys/wait.h>
#import <dlfcn.h>
#import <unistd.h>

static NSString *const kDiscordBundleId = @"com.hammerandchisel.discord";
static NSString *const kIconId          = @"UnboundIcon";
static NSString *const kIconDirectory   = @"/var/jb/Library/Application Support/Unbound/AppIcons";
static NSString *const kOriginalsKey    = @"UnboundOriginalValues";
static NSString *const kAbsentKeysKey   = @"UnboundAbsentKeys";
static NSString *const kURLScheme       = @"unbound";
static NSString *const kURLName         = @"app.unbound.rip";
static NSString *const kCustomPrefix    = @"UnboundCustom";
static NSString *const kNamesKey        = @"UnboundIconNames";
static NSString *const kCustomManifest  = @"Documents/Unbound/AppIcons/custom.json";

typedef struct
{
    NSString *suffix;
    size_t    pixels;
} IconRendition;

static const IconRendition kRenditions[] = {
    {@"60x60@2x.png", 120},
    {@"60x60@3x.png", 180},
    {@"76x76@2x~ipad.png", 152},
};

typedef void (*EventStreamHandlerSetter)(const char *, dispatch_queue_t, void (^)(void *));

static NSArray<NSString *> *managedKeys(void)
{
    return @[
        @"UISupportedDevices", @"UIFileSharingEnabled", @"UISupportsDocumentBrowser", @"CFBundleURLTypes",
        @"CFBundleIcons", @"CFBundleIcons~ipad", kNamesKey
    ];
}

static NSArray<NSString *> *iconFiles(void)
{
    return [[NSFileManager.defaultManager contentsOfDirectoryAtPath:kIconDirectory error:nil]
        filteredArrayUsingPredicate:[NSPredicate predicateWithFormat:@"SELF BEGINSWITH %@", kIconId]];
}

static id discordProxy(void)
{
    Class proxyClass = objc_getClass("LSApplicationProxy");
    return [proxyClass performSelector:@selector(applicationProxyForIdentifier:) withObject:kDiscordBundleId];
}

static NSURL *proxyURL(id proxy, NSString *key)
{
    NSURL *url = [proxy respondsToSelector:NSSelectorFromString(key)] ? [proxy valueForKey:key] : nil;
    return [NSFileManager.defaultManager fileExistsAtPath:url.path] ? url : nil;
}

static BOOL isCustomIconId(id iconId)
{
    NSRegularExpression *pattern = [NSRegularExpression regularExpressionWithPattern:@"^UnboundCustom[A-Za-z0-9]{1,32}$"
                                                                             options:0
                                                                               error:nil];
    return [iconId isKindOfClass:NSString.class] &&
           [pattern numberOfMatchesInString:iconId options:0 range:NSMakeRange(0, [iconId length])] == 1;
}

static NSArray<NSDictionary *> *customIcons(NSURL *dataContainer)
{
    NSString *manifestPath = [dataContainer.path stringByAppendingPathComponent:kCustomManifest];
    NSData   *data         = [NSData dataWithContentsOfFile:manifestPath];
    NSArray  *entries      = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
    if (![entries isKindOfClass:NSArray.class])
    {
        return @[];
    }
    NSString       *directory = manifestPath.stringByDeletingLastPathComponent;
    NSMutableArray *icons     = [NSMutableArray array];
    for (NSDictionary *entry in entries)
    {
        if (![entry isKindOfClass:NSDictionary.class] || !isCustomIconId(entry[@"id"]) ||
            ![entry[@"name"] isKindOfClass:NSString.class] || ![entry[@"file"] isKindOfClass:NSString.class] ||
            [entry[@"file"] containsString:@"/"])
        {
            continue;
        }
        [icons addObject:@{
            @"id" : entry[@"id"],
            @"name" : entry[@"name"],
            @"image" : [directory stringByAppendingPathComponent:entry[@"file"]],
        }];
    }
    return icons;
}

static NSMutableDictionary *originalInfo(NSDictionary *info)
{
    NSMutableDictionary *original = [info mutableCopy];
    NSDictionary        *saved    = info[kOriginalsKey];
    if (![saved isKindOfClass:NSDictionary.class])
    {
        return original;
    }
    for (NSString *key in managedKeys())
    {
        [original removeObjectForKey:key];
    }
    [original addEntriesFromDictionary:saved];
    [original removeObjectForKey:kOriginalsKey];
    [original removeObjectForKey:kAbsentKeysKey];
    return original;
}

static void recordOriginals(NSMutableDictionary *patched, NSDictionary *original)
{
    NSMutableDictionary *saved  = [NSMutableDictionary dictionary];
    NSMutableArray      *absent = [NSMutableArray array];
    for (NSString *key in managedKeys())
    {
        if (original[key])
        {
            saved[key] = original[key];
        }
        else
        {
            [absent addObject:key];
        }
    }
    patched[kOriginalsKey]  = saved;
    patched[kAbsentKeysKey] = absent;
}

static void addAlternateIcon(NSMutableDictionary *info, NSString *key, NSArray<NSString *> *files)
{
    NSString *iconId = [files.firstObject substringToIndex:[files.firstObject length] - @"60x60".length];
    NSMutableDictionary *icons = [info[key] mutableCopy];
    if (!icons)
    {
        return;
    }
    NSMutableDictionary *alternates = [icons[@"CFBundleAlternateIcons"] mutableCopy] ?: [NSMutableDictionary dictionary];
    alternates[iconId]              = @{@"CFBundleIconFiles" : files};
    icons[@"CFBundleAlternateIcons"] = alternates;
    info[key]                        = icons;
}

static BOOL declaresURLScheme(NSArray *types)
{
    for (NSDictionary *type in types)
    {
        if ([type isKindOfClass:NSDictionary.class] && [type[@"CFBundleURLSchemes"] containsObject:kURLScheme])
        {
            return YES;
        }
    }
    return NO;
}

static void addURLScheme(NSMutableDictionary *info)
{
    NSMutableArray *types = [info[@"CFBundleURLTypes"] mutableCopy] ?: [NSMutableArray array];
    if (declaresURLScheme(types))
    {
        return;
    }
    [types addObject:@{
        @"CFBundleTypeRole" : @"Editor",
        @"CFBundleURLName" : kURLName,
        @"CFBundleURLSchemes" : @[ kURLScheme ],
    }];
    info[@"CFBundleURLTypes"] = types;
}

static NSArray<NSString *> *iconFileNames(NSString *iconId, BOOL ipad)
{
    NSString *phone = [iconId stringByAppendingString:@"60x60"];
    return ipad ? @[ phone, [iconId stringByAppendingString:@"76x76"] ] : @[ phone ];
}

static void addCustomIcons(NSMutableDictionary *info, NSArray<NSDictionary *> *icons)
{
    NSMutableDictionary *names = [NSMutableDictionary dictionary];
    for (NSDictionary *icon in icons)
    {
        addAlternateIcon(info, @"CFBundleIcons", iconFileNames(icon[@"id"], NO));
        addAlternateIcon(info, @"CFBundleIcons~ipad", iconFileNames(icon[@"id"], YES));
        names[icon[@"id"]] = icon[@"name"];
    }
    info[kNamesKey] = names;
}

static NSMutableDictionary *patchedInfo(NSDictionary *original, NSArray<NSDictionary *> *icons)
{
    NSMutableDictionary *patched = [original mutableCopy];
    [patched removeObjectForKey:@"UISupportedDevices"];
    patched[@"UIFileSharingEnabled"]      = @YES;
    patched[@"UISupportsDocumentBrowser"] = @YES;
    addAlternateIcon(patched, @"CFBundleIcons", iconFileNames(kIconId, NO));
    addAlternateIcon(patched, @"CFBundleIcons~ipad", iconFileNames(kIconId, YES));
    addCustomIcons(patched, icons);
    addURLScheme(patched);
    recordOriginals(patched, original);
    return patched;
}

static BOOL copyIcons(NSURL *bundle, BOOL install)
{
    BOOL changed = NO;
    for (NSString *file in iconFiles())
    {
        NSString *source = [kIconDirectory stringByAppendingPathComponent:file];
        NSString *target = [bundle.path stringByAppendingPathComponent:file];
        if (!install)
        {
            changed = [NSFileManager.defaultManager removeItemAtPath:target error:nil] || changed;
            continue;
        }
        if ([[NSData dataWithContentsOfFile:source] isEqualToData:[NSData dataWithContentsOfFile:target]])
        {
            continue;
        }
        [NSFileManager.defaultManager removeItemAtPath:target error:nil];
        if ([NSFileManager.defaultManager copyItemAtPath:source toPath:target error:nil])
        {
            chmod(target.fileSystemRepresentation, 0644);
            changed = YES;
        }
    }
    return changed;
}

static CGImageRef squareImage(NSString *path)
{
    CGImageSourceRef source = CGImageSourceCreateWithURL((__bridge CFURLRef)[NSURL fileURLWithPath:path], NULL);
    if (!source)
    {
        return NULL;
    }
    CGImageRef image = CGImageSourceCreateImageAtIndex(source, 0, NULL);
    CFRelease(source);
    if (!image)
    {
        return NULL;
    }
    size_t     side    = MIN(CGImageGetWidth(image), CGImageGetHeight(image));
    CGRect     crop    = CGRectMake((CGImageGetWidth(image) - side) / 2, (CGImageGetHeight(image) - side) / 2, side, side);
    CGImageRef cropped = CGImageCreateWithImageInRect(image, crop);
    CGImageRelease(image);
    return cropped;
}

static NSData *renderPNG(CGImageRef image, size_t pixels)
{
    CGColorSpaceRef space   = CGColorSpaceCreateDeviceRGB();
    CGContextRef    context = CGBitmapContextCreate(NULL, pixels, pixels, 8, 0, space,
                                                    kCGImageAlphaNoneSkipLast | kCGBitmapByteOrderDefault);
    CGColorSpaceRelease(space);
    if (!context)
    {
        return nil;
    }
    CGContextSetInterpolationQuality(context, kCGInterpolationHigh);
    CGContextDrawImage(context, CGRectMake(0, 0, pixels, pixels), image);
    CGImageRef      scaled = CGBitmapContextCreateImage(context);
    CGContextRelease(context);
    NSMutableData  *data        = [NSMutableData data];
    CGImageDestinationRef sink  = CGImageDestinationCreateWithData((__bridge CFMutableDataRef)data, CFSTR("public.png"), 1, NULL);
    CGImageDestinationAddImage(sink, scaled, NULL);
    BOOL written = CGImageDestinationFinalize(sink);
    CFRelease(sink);
    CGImageRelease(scaled);
    return written ? data : nil;
}

static BOOL writeIfChanged(NSData *data, NSString *target)
{
    if (!data || [data isEqualToData:[NSData dataWithContentsOfFile:target]])
    {
        return NO;
    }
    if (![data writeToFile:target atomically:YES])
    {
        fprintf(stderr, "unbound-bundle: Failed to write %s\n", target.UTF8String);
        return NO;
    }
    chmod(target.fileSystemRepresentation, 0644);
    return YES;
}

static BOOL renderCustomIcon(NSURL *bundle, NSDictionary *icon)
{
    CGImageRef image = squareImage(icon[@"image"]);
    if (!image)
    {
        fprintf(stderr, "unbound-bundle: Failed to read custom icon %s\n", [icon[@"id"] UTF8String]);
        return NO;
    }
    BOOL changed = NO;
    for (size_t index = 0; index < sizeof(kRenditions) / sizeof(kRenditions[0]); index++)
    {
        NSString *name = [icon[@"id"] stringByAppendingString:kRenditions[index].suffix];
        changed = writeIfChanged(renderPNG(image, kRenditions[index].pixels),
                                 [bundle.path stringByAppendingPathComponent:name]) || changed;
    }
    CGImageRelease(image);
    return changed;
}

static BOOL syncCustomIconFiles(NSURL *bundle, NSArray<NSDictionary *> *icons)
{
    BOOL      changed = NO;
    NSArray  *wanted  = [icons valueForKey:@"id"];
    for (NSString *file in [NSFileManager.defaultManager contentsOfDirectoryAtPath:bundle.path error:nil])
    {
        NSString *iconId = [file componentsSeparatedByString:@"60x60"].firstObject;
        iconId           = [iconId componentsSeparatedByString:@"76x76"].firstObject;
        if ([file hasPrefix:kCustomPrefix] && ![wanted containsObject:iconId])
        {
            changed = [NSFileManager.defaultManager removeItemAtPath:[bundle.path stringByAppendingPathComponent:file]
                                                               error:nil] || changed;
        }
    }
    for (NSDictionary *icon in icons)
    {
        changed = renderCustomIcon(bundle, icon) || changed;
    }
    return changed;
}

static NSArray<NSDictionary *> *renderableIcons(NSURL *bundle, NSArray<NSDictionary *> *icons)
{
    NSMutableArray *rendered = [NSMutableArray array];
    for (NSDictionary *icon in icons)
    {
        NSString *file = [icon[@"id"] stringByAppendingString:kRenditions[0].suffix];
        if ([NSFileManager.defaultManager fileExistsAtPath:[bundle.path stringByAppendingPathComponent:file]])
        {
            [rendered addObject:icon];
        }
    }
    return rendered;
}

static BOOL writeInfo(NSString *path, NSDictionary *info, struct stat owner)
{
    NSData *data = [NSPropertyListSerialization dataWithPropertyList:info
                                                              format:NSPropertyListBinaryFormat_v1_0
                                                             options:0
                                                               error:nil];
    if (!data || ![data writeToFile:path atomically:YES])
    {
        return NO;
    }
    chown(path.fileSystemRepresentation, owner.st_uid, owner.st_gid);
    chmod(path.fileSystemRepresentation, 0644);
    return YES;
}

static void chownIcons(NSURL *bundle, struct stat owner)
{
    for (NSString *file in [NSFileManager.defaultManager contentsOfDirectoryAtPath:bundle.path error:nil])
    {
        if ([file hasPrefix:@"Unbound"])
        {
            NSString *target = [bundle.path stringByAppendingPathComponent:file];
            chown(target.fileSystemRepresentation, owner.st_uid, owner.st_gid);
        }
    }
}

static void consumeLaunchEvents(void)
{
    EventStreamHandlerSetter setHandler = (EventStreamHandlerSetter)dlsym(RTLD_DEFAULT, "xpc_set_event_stream_handler");
    if (setHandler)
    {
        setHandler("com.apple.notifyd.matching", dispatch_get_main_queue(), ^(void *event) {});
    }
}

static void refreshRegistration(NSURL *bundle)
{
    pid_t       pid;
    const char *uicache = "/var/jb/usr/bin/uicache";
    char *const args[]  = {(char *) uicache, (char *) "-p", (char *) bundle.path.fileSystemRepresentation, NULL};
    if (posix_spawn(&pid, uicache, NULL, NULL, args, NULL) == 0)
    {
        int status;
        waitpid(pid, &status, 0);
    }
}

int main(int argc, char *argv[])
{
    @autoreleasepool
    {
        consumeLaunchEvents();
        BOOL   install = !(argc > 1 && strcmp(argv[1], "remove") == 0);
        id     proxy   = discordProxy();
        NSURL *bundle  = proxyURL(proxy, @"bundleURL");
        if (!bundle)
        {
            fprintf(stderr, "unbound-bundle: Discord is not installed\n");
            return 0;
        }

        NSString   *infoPath = [bundle.path stringByAppendingPathComponent:@"Info.plist"];
        struct stat owner;
        NSData     *data = [NSData dataWithContentsOfFile:infoPath];
        NSDictionary *info =
            data ? [NSPropertyListSerialization propertyListWithData:data options:0 format:nil error:nil] : nil;
        if (stat(infoPath.fileSystemRepresentation, &owner) != 0 || ![info isKindOfClass:NSDictionary.class])
        {
            fprintf(stderr, "unbound-bundle: Failed to read %s\n", infoPath.UTF8String);
            return 1;
        }

        NSArray<NSDictionary *> *icons =
            install ? customIcons(proxyURL(proxy, @"dataContainerURL")) : @[];
        BOOL                 filesChanged = copyIcons(bundle, install);
        filesChanged                      = syncCustomIconFiles(bundle, icons) || filesChanged;
        NSMutableDictionary *original     = originalInfo(info);
        NSDictionary        *wanted = install ? patchedInfo(original, renderableIcons(bundle, icons)) : original;
        BOOL                 infoChanged  = ![wanted isEqualToDictionary:info];
        if (infoChanged && !writeInfo(infoPath, wanted, owner))
        {
            fprintf(stderr, "unbound-bundle: Failed to write %s\n", infoPath.UTF8String);
            return 1;
        }
        chownIcons(bundle, owner);
        if (!filesChanged && !infoChanged)
        {
            return 0;
        }

        refreshRegistration(bundle);
        printf("unbound-bundle: %s Unbound in %s\n", install ? "patched" : "restored", bundle.path.UTF8String);
    }
    return 0;
}
