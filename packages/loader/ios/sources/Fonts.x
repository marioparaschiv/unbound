#import "Fonts.h"

@implementation Fonts
static NSDictionary<NSString *, NSString *> *overrides   = nil;
static NSString                             *everyFamily = nil;
// PostScript name -> the CGFont registered under it, so a reinstalled face replaces the old one.
static NSMutableDictionary<NSString *, id> *registered = nil;
// Set while a hook builds its replacement, whose own UIFont calls must reach the originals.
static _Thread_local BOOL replacing = NO;

+ (void)init
{
    everyFamily = [CoreBridge everyFontFamily];

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

    NSString *postScriptName = CFBridgingRelease(CGFontCopyPostScriptName(ref));
    @synchronized([Fonts class])
    {
        registered  = registered ?: [NSMutableDictionary dictionary];
        id previous = postScriptName ? registered[postScriptName] : nil;
        if (previous)
        {
            CTFontManagerUnregisterGraphicsFont((__bridge CGFontRef) previous, nil);
        }

        CFErrorRef error = nil;
        if (CTFontManagerRegisterGraphicsFont(ref, &error))
        {
            if (postScriptName)
            {
                registered[postScriptName] = (__bridge id) ref;
            }
            [Logger info:LOG_CATEGORY_FONTS
                  format:@"Loaded font: %@.", [Fonts getFontNameByRef:ref]];
        }
        else
        {
            NSError *reason = CFBridgingRelease(error);
            [Logger error:LOG_CATEGORY_FONTS
                   format:@"Failed to register font %@. (%@)", path, reason.localizedDescription];
        }
    }

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

+ (UIFont *)replacementFor:(NSString *)name size:(CGFloat)size original:(UIFontDescriptor *)original
{
    NSDictionary *table       = [Fonts overrides];
    NSString     *replacement = table[everyFamily] ?: table[name];
    if (!name || !replacement || [replacement isEqualToString:name])
    {
        return nil;
    }

    // Glyphs the replacement lacks fall back to the original font, not the system one.
    UIFontDescriptor *fallback =
        original ?: [UIFontDescriptor fontDescriptorWithName:name size:size];
    UIFontDescriptor *descriptor = [[UIFontDescriptor fontDescriptorWithName:replacement size:size]
        fontDescriptorByAddingAttributes:@{UIFontDescriptorCascadeListAttribute : @[ fallback ]}];

    replacing    = YES;
    UIFont *font = [UIFont fontWithDescriptor:descriptor size:size];
    replacing    = NO;

    // An unregistered name resolves to a system font; keep Discord's instead.
    if (![font.fontName isEqualToString:replacement])
    {
        return nil;
    }
    return font;
}

@end

%hook UIFont
+ (UIFont *)fontWithName:(NSString *)name size:(CGFloat)size
{
    if (replacing)
    {
        return %orig;
    }
    return [Fonts replacementFor:name size:size original:nil] ?: %orig;
}

+ (UIFont *)fontWithDescriptor:(UIFontDescriptor *)descriptor size:(CGFloat)size
{
    if (replacing)
    {
        return %orig;
    }
    // Only a named descriptor: resolving `postscriptName` on a traits-only one matches fonts.
    NSString *name = [descriptor objectForKey:UIFontDescriptorNameAttribute];
    if (![name isKindOfClass:[NSString class]])
    {
        return %orig;
    }
    return [Fonts replacementFor:name size:size original:descriptor] ?: %orig;
}
%end
