#import <Foundation/Foundation.h>
#import "../../shared/UBAppIcons.h"
#import <objc/runtime.h>
#import <spawn.h>
#import <sys/stat.h>
#import <sys/wait.h>
#import <unistd.h>

static NSString *const kDiscordBundleId = @"com.hammerandchisel.discord";
static NSString *const kOriginalsKey    = @"UnboundOriginalValues";
static NSString *const kAbsentKeysKey   = @"UnboundAbsentKeys";
static NSString *const kFilePrefix      = @"Unbound";


// Keys earlier builds wrote into Discord.app's Info.plist. This tool only restores them.
static NSArray<NSString *> *managedKeys(void)
{
    return @[
        @"UISupportedDevices", @"UIFileSharingEnabled", @"UISupportsDocumentBrowser", @"CFBundleURLTypes",
        @"CFBundleIcons", @"CFBundleIcons~ipad", UBIconNamesKey
    ];
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


static NSDictionary *restoredInfo(NSDictionary *info)
{
    NSDictionary *saved = info[kOriginalsKey];
    if (![saved isKindOfClass:NSDictionary.class])
    {
        return info;
    }
    NSMutableDictionary *original = [info mutableCopy];
    for (NSString *key in managedKeys())
    {
        [original removeObjectForKey:key];
    }
    [original addEntriesFromDictionary:saved];
    [original removeObjectForKey:kOriginalsKey];
    [original removeObjectForKey:kAbsentKeysKey];
    return original;
}

static BOOL removeUnboundFiles(NSString *bundlePath)
{
    BOOL changed = NO;
    for (NSString *file in [NSFileManager.defaultManager contentsOfDirectoryAtPath:bundlePath error:nil])
    {
        if ([file hasPrefix:kFilePrefix])
        {
            changed = [NSFileManager.defaultManager removeItemAtPath:[bundlePath stringByAppendingPathComponent:file]
                                                               error:nil] || changed;
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

int main(void)
{
    @autoreleasepool
    {
        NSURL *bundle = proxyURL(discordProxy(), @"bundleURL");
        if (!bundle)
        {
            fprintf(stderr, "unbound-bundle: Discord is not installed\n");
            return 0;
        }

        NSString     *infoPath = [bundle.path stringByAppendingPathComponent:@"Info.plist"];
        struct stat   owner;
        NSData       *data = [NSData dataWithContentsOfFile:infoPath];
        NSDictionary *info =
            data ? [NSPropertyListSerialization propertyListWithData:data options:0 format:nil error:nil] : nil;
        if (stat(infoPath.fileSystemRepresentation, &owner) != 0 || ![info isKindOfClass:NSDictionary.class])
        {
            fprintf(stderr, "unbound-bundle: Failed to read %s\n", infoPath.UTF8String);
            return 1;
        }

        NSDictionary *restored = restoredInfo(info);
        BOOL          infoChanged = ![restored isEqualToDictionary:info];
        if (infoChanged && !writeInfo(infoPath, restored, owner))
        {
            fprintf(stderr, "unbound-bundle: Failed to write %s\n", infoPath.UTF8String);
            return 1;
        }
        BOOL filesChanged = removeUnboundFiles(bundle.path);
        if (!filesChanged && !infoChanged)
        {
            return 0;
        }

        refreshRegistration(bundle);
        printf("unbound-bundle: restored Discord in %s\n", bundle.path.UTF8String);
    }
    return 0;
}
