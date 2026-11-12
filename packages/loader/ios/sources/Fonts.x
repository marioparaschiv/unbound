#import "Fonts.h"

@implementation Fonts
static NSDictionary<NSString *, NSString *> *overrides   = nil;
static NSString                             *everyFamily = nil;
// PostScript name -> the CGFont registered under it, so a reinstalled face replaces the old one.
static NSMutableDictionary<NSString *, id> *registered = nil;
// Font file -> `{ name, family }` it registered under, which a variable font's instances draw from.
static NSMutableDictionary<NSString *, NSDictionary *> *registeredFiles = nil;
// An installed face's name -> the name CoreText registered it under, such as `Inter-Medium` ->
// `Inter-Regular_Medium` for a variable font's instance.
static NSMutableDictionary<NSString *, NSString *> *faceNames = nil;
// Names asked for that no installed face has; a face installed later is asked for only after.
static NSMutableSet<NSString *> *unknownNames = nil;
// Families of the files the overrides' variable instances draw from.
static NSMutableSet<NSString *> *instanceFamilies = nil;
static NSString *const           chosenFaceKey    = @"UnboundFontsChosenFace";
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
    if ([variable isKindOfClass:[NSDictionary class]])
    {
        for (NSString *name in variable)
        {
            NSDictionary *instance = variable[name];
            [Fonts registerInstance:name path:instance[@"path"] variations:instance[@"variations"]];
        }
    }

    @synchronized([Fonts class])
    {
        overrides = [table isKindOfClass:[NSDictionary class]] ? table : @{};
    }
}

+ (BOOL)isInstanceFamily:(NSString *)family
{
    @synchronized([Fonts class])
    {
        return family && [instanceFamilies containsObject:family];
    }
}

// Notes `font` as the face this thread just drew for an override or preview: the family lookup
// that follows it lists only this face.
+ (UIFont *)chose:(UIFont *)font
{
    if (font.familyName && font.fontName)
    {
        NSThread.currentThread.threadDictionary[chosenFaceKey] =
            @[ font.familyName, font.fontName ];
    }
    return font;
}

// The face `chose:` noted for `family` on this thread, once.
+ (NSString *)takeChosenFaceOf:(NSString *)family
{
    NSMutableDictionary *thread = NSThread.currentThread.threadDictionary;
    NSArray             *chosen = thread[chosenFaceKey];
    if (!chosen || ![chosen[0] isEqualToString:family])
    {
        return nil;
    }
    [thread removeObjectForKey:chosenFaceKey];
    return chosen[1];
}

+ (NSDictionary *)registeredFile:(NSString *)path
{
    @synchronized([Fonts class])
    {
        return path ? registeredFiles[path] : nil;
    }
}

// Registers `ref` under `name`, replacing a font registered under it before.
+ (BOOL)registerGraphicsFont:(CGFontRef)ref name:(NSString *)name
{
    @synchronized([Fonts class])
    {
        registered  = registered ?: [NSMutableDictionary dictionary];
        id previous = registered[name];
        if (previous)
        {
            CTFontManagerUnregisterGraphicsFont((__bridge CGFontRef) previous, nil);
        }

        CFErrorRef error = nil;
        if (!CTFontManagerRegisterGraphicsFont(ref, &error))
        {
            NSError *reason = CFBridgingRelease(error);
            [Logger error:LOG_CATEGORY_FONTS
                   format:@"Failed to register font %@. (%@)", name, reason.localizedDescription];
            return NO;
        }

        registered[name] = (__bridge id) ref;
        return YES;
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
    if (postScriptName && [Fonts registerGraphicsFont:ref name:postScriptName])
    {
        CTFontRef font   = CTFontCreateWithGraphicsFont(ref, 0, NULL, NULL);
        NSString *family = CFBridgingRelease(CTFontCopyFamilyName(font));
        CFRelease(font);
        @synchronized([Fonts class])
        {
            registeredFiles       = registeredFiles ?: [NSMutableDictionary dictionary];
            registeredFiles[path] = @{@"name" : postScriptName, @"family" : family ?: @""};
        }
        [Logger info:LOG_CATEGORY_FONTS format:@"Loaded font: %@.", [Fonts getFontNameByRef:ref]];
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

// `{ wght: 700 }` keyed by the axis names CoreGraphics wants, such as `{ Weight: 700 }`.
+ (NSDictionary *)axisNames:(NSDictionary *)variations of:(CGFontRef)graphics
{
    CTFontRef font = CTFontCreateWithGraphicsFont(graphics, 0, NULL, NULL);
    NSArray  *axes = CFBridgingRelease(CTFontCopyVariationAxes(font));
    CFRelease(font);

    NSMutableDictionary *named = [NSMutableDictionary dictionary];
    for (NSDictionary *axis in axes)
    {
        NSNumber *tag  = axis[(__bridge NSString *) kCTFontVariationAxisIdentifierKey];
        NSString *name = axis[(__bridge NSString *) kCTFontVariationAxisNameKey];
        uint32_t  code = tag.unsignedIntValue;
        char bytes[5]  = {(char) (code >> 24), (char) (code >> 16), (char) (code >> 8), (char) code,
                          0};
        NSNumber *value = variations[[[NSString stringWithUTF8String:bytes]
            stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]]];
        if (name && [value isKindOfClass:[NSNumber class]])
        {
            named[name] = value;
        }
    }
    return named;
}

// Registers face `name`, a variable font file drawn at `variations`, as a font of its own:
// Discord's text matches fonts by their descriptor's name, which an unregistered instance lacks.
+ (NSString *)registerInstance:(NSString *)name
                          path:(NSString *)path
                    variations:(NSDictionary *)variations
{
    NSString *fileName = [Fonts registeredFile:path][@"name"];
    id        graphics;
    @synchronized([Fonts class])
    {
        graphics = fileName ? registered[fileName] : nil;
    }
    if (!graphics || ![variations isKindOfClass:[NSDictionary class]])
    {
        return nil;
    }

    NSDictionary *named = [Fonts axisNames:variations of:(__bridge CGFontRef) graphics];
    CGFontRef     copy  = CGFontCreateCopyWithVariations((__bridge CGFontRef) graphics,
                                                         (__bridge CFDictionaryRef) named);
    if (!copy)
    {
        [Logger error:LOG_CATEGORY_FONTS format:@"Failed to create font instance %@", name];
        return nil;
    }

    NSString *postScriptName = CFBridgingRelease(CGFontCopyPostScriptName(copy));
    // The file's default coordinates name the file's own font, already registered.
    BOOL ready = [postScriptName isEqualToString:fileName] ||
                 (postScriptName && [Fonts registerGraphicsFont:copy name:postScriptName]);
    CGFontRelease(copy);
    if (!ready)
    {
        return nil;
    }

    NSString *family = [Fonts registeredFile:path][@"family"];
    @synchronized([Fonts class])
    {
        faceNames        = faceNames ?: [NSMutableDictionary dictionary];
        faceNames[name]  = postScriptName;
        instanceFamilies = instanceFamilies ?: [NSMutableSet set];
        if (family.length)
        {
            [instanceFamilies addObject:family];
        }
    }
    return postScriptName;
}

// The name CoreText knows installed face `name` by, registering it on first use: only the faces an
// override uses load at launch, but settings previews any installed face.
+ (NSString *)registeredName:(NSString *)name
{
    if (!name.length)
    {
        return nil;
    }

    @synchronized([Fonts class])
    {
        NSString *known = faceNames[name];
        if (known || [unknownNames containsObject:name])
        {
            return known;
        }
    }

    NSDictionary *face = [CoreBridge installedFont:name];
    NSString     *path = face[@"path"];
    NSString     *registeredName;
    if ([path isKindOfClass:[NSString class]])
    {
        if (![Fonts registeredFile:path])
        {
            [Fonts loadFont:path];
        }

        NSDictionary *variations = face[@"variations"];
        registeredName = [variations isKindOfClass:[NSDictionary class]] && variations.count
                             ? [Fonts registerInstance:name path:path variations:variations]
                             : [Fonts registeredFile:path][@"name"];
    }

    @synchronized([Fonts class])
    {
        faceNames    = faceNames ?: [NSMutableDictionary dictionary];
        unknownNames = unknownNames ?: [NSMutableSet set];
        if (registeredName)
        {
            faceNames[name] = registeredName;
        }
        else
        {
            [unknownNames addObject:name];
        }
    }
    return registeredName;
}

+ (UIFont *)replacementFor:(NSString *)name size:(CGFloat)size original:(UIFontDescriptor *)original
{
    // `fontWithDescriptor:size:0` means the descriptor's size; CoreText reads 0 as 12 pt.
    size = size > 0 ? size : original.pointSize;

    NSDictionary *table       = [Fonts overrides];
    NSString     *replacement = table[everyFamily] ?: table[name];
    if (!name || !replacement || [replacement isEqualToString:name])
    {
        return nil;
    }

    replacement = [Fonts registeredName:replacement] ?: replacement;

    // Glyphs the replacement lacks fall back to the original font, not the system one.
    UIFontDescriptor *fallback =
        original ?: [UIFontDescriptor fontDescriptorWithName:name size:size];
    NSDictionary     *cascade    = @{UIFontDescriptorCascadeListAttribute : @[ fallback ]};
    UIFontDescriptor *descriptor = [[UIFontDescriptor fontDescriptorWithName:replacement size:size]
        fontDescriptorByAddingAttributes:cascade];

    replacing    = YES;
    UIFont *font = [UIFont fontWithDescriptor:descriptor size:size];
    replacing    = NO;

    // An unregistered name resolves to a system font; keep Discord's instead.
    return [font.fontName isEqualToString:replacement] ? [Fonts chose:font] : nil;
}

// An installed face asked for by its own name, as settings previews do, before an override uses it.
+ (UIFont *)installedFace:(NSString *)name size:(CGFloat)size
{
    NSString *registeredName = [Fonts registeredName:name];
    if (!registeredName)
    {
        return nil;
    }

    replacing    = YES;
    UIFont *font = [UIFont fontWithName:registeredName size:size];
    replacing    = NO;
    return [Fonts chose:font];
}

@end

%hook UIFont
+ (UIFont *)fontWithName:(NSString *)name size:(CGFloat)size
{
    if (replacing)
    {
        return %orig;
    }
    return [Fonts replacementFor:name size:size original:nil] ?: %orig
                                                              ?: [Fonts installedFace:name size:size];
}

// React Native and Discord swap a font for the closest weight among its family's names, which would
// trade the face an override picked for a sibling; the family lists only that face, or none.
+ (NSArray<NSString *> *)fontNamesForFamilyName:(NSString *)family
{
    NSString *chosen = [Fonts takeChosenFaceOf:family];
    if (chosen)
    {
        return @[ chosen ];
    }
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
