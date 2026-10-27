#import "Fonts.h"

@implementation Fonts
static NSDictionary<NSString *, NSString *> *overrides   = nil;
static NSString                             *everyFamily = nil;

+ (void)init
{
    everyFamily = [CoreBridge everyFontFamily];

    static dispatch_once_t observeOnce;
    dispatch_once(&observeOnce, ^{
        [[NSNotificationCenter defaultCenter]
            addObserverForName:SettingsDidChangeNotification
                        object:nil
                         queue:[NSOperationQueue mainQueue]
                    usingBlock:^(NSNotification *notification) { [Fonts apply]; }];
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
    NSDictionary *plan = [CoreBridge fontOverridePlan];

    for (NSString *error in plan[@"errors"])
    {
        [Logger error:LOG_CATEGORY_FONTS format:@"%@", error];
    }

    for (NSString *path in plan[@"registrations"])
    {
        [Fonts loadFont:path];
    }

    NSDictionary<NSString *, NSString *> *table = plan[@"table"];
    @synchronized([Fonts class])
    {
        overrides = [table isKindOfClass:[NSDictionary class]] ? table : @{};
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
    NSDictionary *overrides   = [Fonts overrides];
    NSString     *replacement = overrides[name] ?: overrides[everyFamily];

    return replacement ? %orig(replacement, size) : %orig;
}
%end
