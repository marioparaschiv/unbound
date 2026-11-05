#import <Foundation/Foundation.h>
#import <objc/runtime.h>
#import <spawn.h>
#import <sys/stat.h>
#import <sys/wait.h>
#import <unistd.h>

static NSString *const kDiscordBundleId = @"com.hammerandchisel.discord";
static NSString *const kIconId          = @"UnboundIcon";
static NSString *const kIconDirectory   = @"/var/jb/Library/Application Support/Unbound/AppIcons";

static NSArray<NSString *> *iconFiles(void)
{
    return [[NSFileManager.defaultManager contentsOfDirectoryAtPath:kIconDirectory error:nil]
        filteredArrayUsingPredicate:[NSPredicate predicateWithFormat:@"SELF BEGINSWITH %@", kIconId]];
}

static NSURL *discordBundleURL(void)
{
    Class proxyClass = objc_getClass("LSApplicationProxy");
    id    proxy      = [proxyClass performSelector:@selector(applicationProxyForIdentifier:)
                                    withObject:kDiscordBundleId];
    NSURL *url       = [proxy respondsToSelector:@selector(bundleURL)] ? [proxy performSelector:@selector(bundleURL)] : nil;
    return [NSFileManager.defaultManager fileExistsAtPath:url.path] ? url : nil;
}

static NSDictionary *alternateIcon(NSArray<NSString *> *files)
{
    return @{@"CFBundleIconFiles" : files};
}

static BOOL setIconEntries(NSMutableDictionary *info, BOOL install)
{
    BOOL changed = NO;
    NSDictionary<NSString *, NSArray<NSString *> *> *families = @{
        @"CFBundleIcons" : @[ @"UnboundIcon60x60" ],
        @"CFBundleIcons~ipad" : @[ @"UnboundIcon60x60", @"UnboundIcon76x76" ],
    };
    for (NSString *key in families)
    {
        NSMutableDictionary *icons = [info[key] mutableCopy];
        if (!icons)
        {
            continue;
        }
        NSMutableDictionary *alternates = [icons[@"CFBundleAlternateIcons"] mutableCopy] ?: [NSMutableDictionary dictionary];
        NSDictionary        *wanted     = install ? alternateIcon(families[key]) : nil;
        if ([alternates[kIconId] isEqual:wanted] || (!wanted && !alternates[kIconId]))
        {
            continue;
        }
        alternates[kIconId]                 = wanted;
        icons[@"CFBundleAlternateIcons"]    = alternates;
        info[key]                           = icons;
        changed                             = YES;
    }
    return changed;
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

static BOOL writeInfo(NSURL *bundle, NSMutableDictionary *info, struct stat owner)
{
    NSString *path = [bundle.path stringByAppendingPathComponent:@"Info.plist"];
    NSData   *data = [NSPropertyListSerialization dataWithPropertyList:info
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

int main(int argc, char *argv[])
{
    @autoreleasepool
    {
        BOOL   install = !(argc > 1 && strcmp(argv[1], "remove") == 0);
        NSURL *bundle  = discordBundleURL();
        if (!bundle)
        {
            fprintf(stderr, "unbound-icons: Discord is not installed\n");
            return 0;
        }

        NSString *infoPath = [bundle.path stringByAppendingPathComponent:@"Info.plist"];
        struct stat owner;
        if (stat(infoPath.fileSystemRepresentation, &owner) != 0)
        {
            fprintf(stderr, "unbound-icons: cannot read %s\n", infoPath.UTF8String);
            return 1;
        }

        NSMutableDictionary *info =
            [[NSPropertyListSerialization propertyListWithData:[NSData dataWithContentsOfFile:infoPath]
                                                       options:NSPropertyListMutableContainersAndLeaves
                                                        format:nil
                                                         error:nil] mutableCopy];
        if (!info)
        {
            fprintf(stderr, "unbound-icons: cannot parse %s\n", infoPath.UTF8String);
            return 1;
        }

        BOOL filesChanged = copyIcons(bundle, install);
        BOOL infoChanged  = setIconEntries(info, install);
        if (infoChanged && !writeInfo(bundle, info, owner))
        {
            fprintf(stderr, "unbound-icons: cannot write %s\n", infoPath.UTF8String);
            return 1;
        }
        for (NSString *file in iconFiles())
        {
            NSString *target = [bundle.path stringByAppendingPathComponent:file];
            chown(target.fileSystemRepresentation, owner.st_uid, owner.st_gid);
        }
        if (!filesChanged && !infoChanged)
        {
            return 0;
        }

        pid_t       pid;
        const char *uicache = "/var/jb/usr/bin/uicache";
        char *const args[]  = {(char *) uicache, (char *) "-p", (char *) bundle.path.fileSystemRepresentation, NULL};
        if (posix_spawn(&pid, uicache, NULL, NULL, args, NULL) == 0)
        {
            int status;
            waitpid(pid, &status, 0);
        }
        printf("unbound-icons: %s Unbound app icons in %s\n", install ? "installed" : "removed", bundle.path.UTF8String);
    }
    return 0;
}
