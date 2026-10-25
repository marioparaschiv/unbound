#import "Fonts.h"

@implementation Fonts
static NSMutableDictionary<NSString *, NSString *>            *overrides = nil;

+ (NSArray *)getAvailableFonts
{
    CFArrayRef available = CTFontManagerCopyAvailableFontFamilyNames();
    NSArray   *fonts     = (__bridge NSArray *) available;

    return fonts ? fonts : @[];
}

+ (void)init
{
    if (!overrides)
    {
        overrides = [[NSMutableDictionary alloc] init];
    }

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
    NSData       *statesJSON = [[CoreBridge preference:@"font-overrides" argument:@""]
        dataUsingEncoding:NSUTF8StringEncoding];
    id            parsed     = statesJSON ? [NSJSONSerialization JSONObjectWithData:statesJSON options:0 error:nil] : nil;
    NSDictionary *states     = [parsed isKindOfClass:[NSDictionary class]] ? parsed : @{};

    for (NSString *state in states)
    {
        NSString *override = states[state];
        if (!override)
            continue;

        NSPredicate *customPredicate = [NSPredicate predicateWithFormat:@"name == %@", override];
        NSArray     *custom          = [[CoreBridge fonts] filteredArrayUsingPredicate:customPredicate];

        NSArray     *loadedSystemFonts = [Fonts getAvailableFonts];
        NSPredicate *systemPredicate   = [NSPredicate predicateWithFormat:@"SELF == %@", override];
        NSArray     *systemFonts = [loadedSystemFonts filteredArrayUsingPredicate:systemPredicate];

        if ([custom count] == 0 && [systemFonts count] == 0)
        {
            [Logger error:LOG_CATEGORY_FONTS
                   format:@"Failed to replace \"%@\" with \"%@\". The requested font isn't loaded.",
                          state, override];
            continue;
        }

        @try
        {
            NSDictionary *font = [custom count] != 0 ? custom[0] : systemFonts[0];
            if (!font)
                continue;

            BOOL isString = [font isKindOfClass:[NSString class]];

            if (!isString && font[@"path"] != nil)
            {
                NSString *path = font[@"path"];
                if (!path)
                    continue;
                [Fonts loadFont:path];
            }

            overrides[state] = isString ? font : font[@"name"];
        }
        @catch (NSException *e)
        {
            [Logger error:LOG_CATEGORY_FONTS
                   format:@"Failed to load font \"%@\". (%@)", override, e.reason];
        }
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

+ (NSMutableDictionary<NSString *, NSString *> *)overrides
{
    return overrides;
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
