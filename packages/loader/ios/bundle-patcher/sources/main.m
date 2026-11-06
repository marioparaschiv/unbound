#import <Foundation/Foundation.h>
#import "../../shared/UBAppIcons.h"
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


typedef void (*EventStreamHandlerSetter)(const char *, dispatch_queue_t, void (^)(void *));

static NSArray<NSString *> *managedKeys(void)
{
    return @[
        @"UISupportedDevices", @"UIFileSharingEnabled", @"UISupportsDocumentBrowser", @"CFBundleURLTypes",
        @"CFBundleIcons", @"CFBundleIcons~ipad", UBIconNamesKey
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



static NSMutableDictionary *patchedInfo(NSDictionary *original, NSArray<NSDictionary *> *icons)
{
    NSMutableDictionary *patched = [original mutableCopy];
    [patched removeObjectForKey:@"UISupportedDevices"];
    patched[@"UIFileSharingEnabled"]      = @YES;
    patched[@"UISupportsDocumentBrowser"] = @YES;
    UBAddAlternateIcon(patched, kIconId);
    UBAddCustomIcons(patched, icons);
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
            install ? UBCustomIcons([proxyURL(proxy, @"dataContainerURL").path stringByAppendingPathComponent:@"Documents"]) : @[];
        BOOL                 filesChanged = copyIcons(bundle, install);
        filesChanged                      = UBSyncCustomIconFiles(bundle.path, icons) || filesChanged;
        NSMutableDictionary *original     = originalInfo(info);
        NSDictionary        *wanted = install ? patchedInfo(original, UBRenderableIcons(bundle.path, icons)) : original;
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
