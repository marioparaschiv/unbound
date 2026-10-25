#import "Fonts.h"

@implementation Fonts
static NSDictionary<NSString *, NSString *> *overrides   = nil;
static NSMutableSet<NSString *>             *loadedPaths = nil;

+ (void)init
{
    if (!loadedPaths)
    {
        loadedPaths = [NSMutableSet set];
    }

    static dispatch_once_t observeOnce;
    dispatch_once(&observeOnce, ^{
        [[NSNotificationCenter defaultCenter] addObserverForName:SettingsDidChangeNotification
                                                          object:nil
                                                           queue:[NSOperationQueue mainQueue]
                                                      usingBlock:^(NSNotification *notification) {
                                                          [Fonts apply];
                                                      }];
    });

    @try
    {
        [Logger info:LOG_CATEGORY_FONTS format:@"Loading..."];
        [Fonts apply];
        [Logger info:LOG_CATEGORY_FONTS format:@"Successfully loaded."];
    }
    @catch (NSException *e)
    {
        [Logger error:LOG_CATEGORY_FONTS format:@"Failed to load. (%@)", e.reason];
    }
};

+ (void)apply
{
    NSDictionary<NSString *, NSDictionary *> *targets = [CoreBridge fontOverrideTargets];
    NSMutableDictionary<NSString *, NSString *> *resolved = [NSMutableDictionary dictionary];

    for (NSString *family in targets)
    {
        NSDictionary *target = targets[family];
        if (target[@"error"])
        {
            [Logger error:LOG_CATEGORY_FONTS format:@"%@", target[@"error"]];
            continue;
        }

        NSString *path = target[@"path"];
        if (path && ![loadedPaths containsObject:path])
        {
            [Fonts loadFont:path];
            [loadedPaths addObject:path];
        }
        resolved[family] = target[@"name"];
    }

    @synchronized([Fonts class])
    {
        overrides = resolved;
    }
}

+ (void)loadFont:(NSString *)path
{
    NSURL *url = [NSURL fileURLWithPath:path];

    CGDataProviderRef provider = CGDataProviderCreateWithURL((__bridge CFURLRef) url);
    if (!provider)
    {
        [Logger error:LOG_CATEGORY_FONTS format:@"Failed to create data provider for %@", path];
        return;
    }

    CGFontRef ref = CGFontCreateWithDataProvider(provider);
    CGDataProviderRelease(provider);

    if (!ref)
    {
        [Logger error:LOG_CATEGORY_FONTS format:@"Failed to create font from %@", path];
        return;
    }

    CTFontManagerRegisterGraphicsFont(ref, nil);
    [Logger info:LOG_CATEGORY_FONTS format:@"Loaded font: %@.", [Fonts getFontNameByRef:ref]];

    CGFontRelease(ref);
}

+ (NSString *)getFontNameByRef:(CGFontRef)ref
{
    if (!ref)
    {
        return nil;
    }

    return CFBridgingRelease(CGFontCopyFullName(ref));
}

+ (NSDictionary<NSString *, NSString *> *)overrides
{
    @synchronized([Fonts class])
    {
        return overrides ?: @{};
    }
}
@end

%hook UIFont
+ (UIFont *)fontWithName:(NSString *)name size:(CGFloat)size
{
    NSDictionary *overrides = [Fonts overrides];
    NSObject     *all       = overrides[@"*"];

    if (overrides[name] || all)
    {
        return %orig(all ? all : overrides[name], size);
    }

    return %orig;
}
%end
