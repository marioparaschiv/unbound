#import "Fonts.h"

@implementation Fonts
static NSDictionary<NSString *, NSString *> *overrides   = nil;
static NSString                             *everyFamily = nil;
// PostScript name -> the CGFont registered under it, so a reinstalled face replaces the old one.
static NSMutableDictionary<NSString *, id> *registered = nil;
// Font file -> `{ name, family }` it registered under, which a variable font's instances draw from.
static NSMutableDictionary<NSString *, NSDictionary *> *registeredFiles = nil;
// Face name -> `{ path, variations }` for each variable font instance an override points at.
static NSDictionary<NSString *, NSDictionary *> *instances = nil;
// Families of the files those instances draw from.
static NSSet<NSString *> *instanceFamilies = nil;
// An instance's CoreText name, such as `Inter-Regular_Medium` -> the Discord family it replaced.
static NSMutableDictionary<NSString *, NSString *> *instanceNames = nil;
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

    NSDictionary<NSString *, NSString *> *table    = plan[@"table"];
    NSDictionary                         *variable = plan[@"instances"];
    @synchronized([Fonts class])
    {
        overrides = [table isKindOfClass:[NSDictionary class]] ? table : @{};
        instances = [variable isKindOfClass:[NSDictionary class]] ? variable : @{};

        NSMutableSet *families = [NSMutableSet set];
        for (NSDictionary *instance in instances.allValues)
        {
            NSString *family = registeredFiles[instance[@"path"]][@"family"];
            if (family.length)
            {
                [families addObject:family];
            }
        }
        instanceFamilies = families;
        instanceNames    = [NSMutableDictionary dictionary];
    }
}

+ (BOOL)isInstanceFamily:(NSString *)family
{
    @synchronized([Fonts class])
    {
        return family && [instanceFamilies containsObject:family];
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
                CTFontRef font             = CTFontCreateWithGraphicsFont(ref, 0, NULL, NULL);
                NSString *family           = CFBridgingRelease(CTFontCopyFamilyName(font));
                CFRelease(font);
                registeredFiles       = registeredFiles ?: [NSMutableDictionary dictionary];
                registeredFiles[path] = @{@"name" : postScriptName, @"family" : family ?: @""};
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

// `{ wght: 700 }` as CoreText's variation attribute, keyed by each axis tag's four bytes.
+ (NSDictionary<NSNumber *, NSNumber *> *)variationAttribute:(NSDictionary *)variations
{
    NSMutableDictionary *attribute = [NSMutableDictionary dictionary];
    for (NSString *tag in variations)
    {
        NSString *padded = [tag stringByPaddingToLength:4 withString:@" " startingAtIndex:0];
        NSData   *bytes  = [padded dataUsingEncoding:NSASCIIStringEncoding];
        NSNumber *value  = variations[tag];
        if (bytes.length != 4 || ![value isKindOfClass:[NSNumber class]])
        {
            continue;
        }
        const uint8_t *tagBytes = (const uint8_t *) bytes.bytes;
        uint32_t       key      = ((uint32_t) tagBytes[0] << 24) | ((uint32_t) tagBytes[1] << 16) |
                                  ((uint32_t) tagBytes[2] << 8) | tagBytes[3];
        attribute[@(key)]       = value;
    }
    return attribute;
}

// A UIFont descriptor ignores variations on a registered graphics font, so the instance is a CTFont
// copied from it at the coordinates. CTFont and UIFont are toll-free bridged.
+ (UIFont *)instanceOf:(CGFontRef)graphics
            variations:(NSDictionary *)variations
                  size:(CGFloat)size
            attributes:(NSDictionary *)attributes
                family:(NSString *)family
{
    NSMutableDictionary *all                             = [attributes mutableCopy];
    all[(__bridge NSString *) kCTFontVariationAttribute] = [Fonts variationAttribute:variations];
    CTFontDescriptorRef descriptor =
        CTFontDescriptorCreateWithAttributes((__bridge CFDictionaryRef) all);
    CTFontRef base = CTFontCreateWithGraphicsFont(graphics, size, NULL, NULL);
    CTFontRef font = CTFontCreateCopyWithAttributes(base, size, NULL, descriptor);
    CFRelease(base);
    CFRelease(descriptor);

    UIFont *result = CFBridgingRelease(font);
    // A family mismatch means the copy fell back to another font; keep Discord's instead.
    return [result.familyName isEqualToString:family] ? result : nil;
}

+ (UIFont *)replacementFor:(NSString *)name size:(CGFloat)size original:(UIFontDescriptor *)original
{
    // `fontWithDescriptor:size:0` means the descriptor's size; CoreText reads 0 as 12 pt.
    size = size > 0 ? size : original.pointSize;

    // An instance asked for by its own name, as text layout does, is the family it replaced.
    NSString *replaced;
    @synchronized([Fonts class])
    {
        replaced = name ? instanceNames[name] : nil;
    }
    if (replaced)
    {
        name     = replaced;
        original = nil;
    }

    NSDictionary *table       = [Fonts overrides];
    NSString     *replacement = table[everyFamily] ?: table[name];
    if (!name || !replacement || [replacement isEqualToString:name])
    {
        return nil;
    }

    // A variable font's instance draws the file's registered font at its coordinates.
    NSDictionary *instance;
    NSDictionary *file;
    id            graphics;
    @synchronized([Fonts class])
    {
        instance = instances[replacement];
        file     = instance ? registeredFiles[instance[@"path"]] : nil;
        graphics = file ? registered[file[@"name"]] : nil;
    }
    if (instance && !graphics)
    {
        return nil;
    }

    // Glyphs the replacement lacks fall back to the original font, not the system one.
    UIFontDescriptor *fallback =
        original ?: [UIFontDescriptor fontDescriptorWithName:name size:size];
    NSDictionary *cascade = @{UIFontDescriptorCascadeListAttribute : @[ fallback ]};

    if (instance)
    {
        UIFont *font = [Fonts instanceOf:(__bridge CGFontRef) graphics
                              variations:instance[@"variations"]
                                    size:size
                              attributes:cascade
                                  family:file[@"family"]];
        if (font.fontName)
        {
            @synchronized([Fonts class])
            {
                instanceNames[font.fontName] = name;
            }
        }
        return font;
    }

    UIFontDescriptor *descriptor = [[UIFontDescriptor fontDescriptorWithName:replacement size:size]
        fontDescriptorByAddingAttributes:cascade];

    replacing    = YES;
    UIFont *font = [UIFont fontWithDescriptor:descriptor size:size];
    replacing    = NO;

    // An unregistered name resolves to a system font; keep Discord's instead.
    return [font.fontName isEqualToString:replacement] ? font : nil;
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

// React Native swaps a font for the closest weight among its family's names, which would trade a
// variable instance for the file's default one; such a family lists no names, so it stays.
+ (NSArray<NSString *> *)fontNamesForFamilyName:(NSString *)family
{
    return [Fonts isInstanceFamily:family] ? @[] : %orig;
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
