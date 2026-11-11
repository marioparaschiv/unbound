#import "Themes.h"

#include <mach-o/dyld.h>
#include <mach-o/getsect.h>
#include <mach/mach_time.h>

#import "AddonsCore.h"
#import "CoreBridge.h"
#import "CoreConversions.h"
#include "LoaderThemes.h"

using unbound::ios::toNSString;
using unbound::ios::toStdString;

@interface Themes ()
+ (void)refreshDiscordTheme;
+ (void)refreshDiscordThemeOnMainThread;
+ (void)ensureSemanticColorsSwizzled;
@end

@implementation Themes
static NSMutableDictionary<NSString *, NSValue *> *originalRawImplementations;
static __weak DCDThemeModule                      *currentDiscordTheme;
static BOOL                                        semanticColorsSwizzled = NO;
static BOOL                                        refreshingDiscordTheme = NO;
static NSDictionary<NSString *, UIColor *>        *semanticColors         = nil;
static NSDictionary<NSString *, NSString *>       *rawFallbacks           = nil;
static NSDictionary<NSNumber *, UIColor *>        *paletteColors          = nil;

static NSNumber *paletteKey(CGFloat red, CGFloat green, CGFloat blue, CGFloat alpha)
{
    auto channel = [](CGFloat value) {
        return (uint32_t) lround(fmin(fmax(value, 0.0), 1.0) * 255.0);
    };
    return @((channel(red) << 24) | (channel(green) << 16) | (channel(blue) << 8) | channel(alpha));
}

static NSNumber *paletteKeyForColor(UIColor *color)
{
    CGFloat red, green, blue, alpha;
    return [color getRed:&red green:&green blue:&blue alpha:&alpha]
               ? paletteKey(red, green, blue, alpha)
               : nil;
}

static NSNumber *paletteKeyForHSB(CGFloat hue, CGFloat saturation, CGFloat brightness,
                                  CGFloat alpha)
{
    // UIKit's HSB to RGB conversion, so a palette colour keys like its raw getter.
    auto channel = [&](CGFloat offset) {
        CGFloat k = fmod(offset + fmod(hue, 1.0) * 6.0, 6.0);
        return brightness - brightness * saturation * fmax(0.0, fmin(fmin(k, 4.0 - k), 1.0));
    };
    return paletteKey(channel(5.0), channel(3.0), channel(1.0), alpha);
}

// Raw pointers keep ARC out of the original initializer's consumed receiver and retained result.
static void *(*originalInitWithHue)(void *, SEL, CGFloat, CGFloat, CGFloat, CGFloat);
static uintptr_t discordTextStart = 0;
static uintptr_t discordTextEnd   = 0;

// Discord's own binary calls initWithHue: only from its colour palette, so its __TEXT range tells
// palette colours apart from ones UIKit, React Native or other libraries create.
static void findDiscordText(void)
{
    for (uint32_t index = 0; index < _dyld_image_count(); index++)
    {
        const struct mach_header_64 *header =
            (const struct mach_header_64 *) _dyld_get_image_header(index);
        if (header->filetype != MH_EXECUTE)
        {
            continue;
        }

        unsigned long size  = 0;
        uint8_t      *start = getsegmentdata(header, "__TEXT", &size);
        discordTextStart    = (uintptr_t) start;
        discordTextEnd      = (uintptr_t) start + size;
        return;
    }
}

// Discord's Swift chat palette builds colours from literal HSB values (the mention highlight is
// YELLOW_300) and never calls the raw getters, so a palette colour that matches a themed raw colour
// resolves to the theme's colour instead.
static NS_RETURNS_RETAINED UIColor *themedInitWithHue(NS_RELEASES_ARGUMENT id self, SEL _cmd,
                                                      CGFloat hue, CGFloat saturation,
                                                      CGFloat brightness, CGFloat alpha)
{
    uintptr_t caller  = (uintptr_t) __builtin_extract_return_addr(__builtin_return_address(0));
    BOOL      palette = caller >= discordTextStart && caller < discordTextEnd;

    UIColor *themed = nil;
    @synchronized([Themes class])
    {
        if (palette && paletteColors.count)
        {
            themed = paletteColors[paletteKeyForHSB(hue, saturation, brightness, alpha)];
        }
    }

    if (themed)
    {
        return themed;
    }

    return (__bridge_transfer UIColor *) originalInitWithHue((__bridge_retained void *) self, _cmd,
                                                             hue, saturation, brightness, alpha);
}

static void hookPaletteColors(void)
{
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        findDiscordText();
        MSHookMessageEx(NSClassFromString(@"UIPlaceholderColor"),
                        @selector(initWithHue:saturation:brightness:alpha:),
                        (IMP) themedInitWithHue, (IMP *) &originalInitWithHue);
    });
}

static loader::ThemeSelection &themeSelection(void)
{
    static loader::ThemeSelection selection([](const std::string &themeId) {
        return UnboundAddonState().theme(themeId).has_value();
    });
    return selection;
}

static NSString *optionalThemeId(const std::optional<std::string> &themeId)
{
    return themeId ? toNSString(*themeId) : nil;
}

static NSObject *themeApplicationLock(void)
{
    static NSObject       *lock = nil;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        lock                       = [[NSObject alloc] init];
        originalRawImplementations = [[NSMutableDictionary alloc] init];
    });
    return lock;
}

static double millisecondsSince(uint64_t start)
{
    static mach_timebase_info_data_t timebase;
    static dispatch_once_t           once;
    dispatch_once(&once, ^{ mach_timebase_info(&timebase); });
    return (double) (mach_absolute_time() - start) * timebase.numer / timebase.denom / 1e6;
}

// Reloads the chat and the collections inside it, such as reaction lists, which the chat's reload
// leaves configured. Children reload before the chat that may reuse them.
static void reloadChatViews(UIView *view, BOOL inChat)
{
    BOOL chat = [view isKindOfClass:NSClassFromString(@"DCDTableView")];

    for (UIView *subview in view.subviews)
    {
        reloadChatViews(subview, inChat || chat);
    }

    if (chat)
    {
        [(UITableView *) view reloadData];
    }
    else if (inChat && [view isKindOfClass:[UICollectionView class]])
    {
        [(UICollectionView *) view reloadData];
    }
}

// Chat cells keep the palette colours they were configured with, so on-screen ones are reloaded to
// pick up the theme that replaced them.
static void reloadVisibleChats(void)
{
    for (UIScene *scene in UIApplication.sharedApplication.connectedScenes)
    {
        if (![scene isKindOfClass:[UIWindowScene class]])
        {
            continue;
        }

        for (UIWindow *window in ((UIWindowScene *) scene).windows)
        {
            reloadChatViews(window, NO);
        }
    }
}

+ (BOOL)isValidCustomTheme:(NSString *)manifestId
{
    return [CoreBridge hasTheme:manifestId];
}

+ (NSString *)getTheme
{
    return optionalThemeId(themeSelection().current());
}

+ (NSArray *)getThemes
{
    return [CoreBridge themes];
}

+ (void)applyTheme:(NSString *)manifestId
{
    @synchronized(themeApplicationLock())
    {
        NSString *themeId = optionalThemeId(themeSelection().apply(toStdString(manifestId)));

        [Logger info:LOG_CATEGORY_THEMES format:@"Theme updated. (%@)", themeId ?: @"default"];

        [Themes restoreOriginalRawColors];

        NSDictionary *colors = nil;
        if (themeId)
        {
            colors = [CoreBridge themeColorsForId:themeId];
        }

        NSDictionary *semantic  = colors[@"semantic"];
        NSDictionary *fallbacks = colors[@"rawFallbacks"];
        if (semantic.count || fallbacks.count)
        {
            [Themes ensureSemanticColorsSwizzled];
        }

        @synchronized([Themes class])
        {
            semanticColors = semantic;
            rawFallbacks   = fallbacks;
        }

        NSDictionary *raw = colors[@"raw"];
        if (raw.count)
        {
            [Themes swizzleRawColors:raw];
        }
    }
}

+ (void)refreshDiscordTheme
{
    if ([NSThread isMainThread])
    {
        [Themes refreshDiscordThemeOnMainThread];
        return;
    }
    dispatch_async(dispatch_get_main_queue(), ^{ [Themes refreshDiscordThemeOnMainThread]; });
}

+ (void)refreshDiscordThemeOnMainThread
{
    reloadVisibleChats();

    DCDThemeModule *theme        = currentDiscordTheme;
    NSString       *discordTheme = optionalThemeId(themeSelection().discordTheme());
    if (!theme || discordTheme.length == 0)
    {
        return;
    }

    refreshingDiscordTheme = YES;
    @try
    {
        [theme updateTheme:discordTheme];
    }
    @finally
    {
        refreshingDiscordTheme = NO;
    }
}

+ (BOOL)setTheme:(NSString *)manifestId
{
    @synchronized(themeApplicationLock())
    {
        if (!themeSelection().select(toStdString(manifestId)))
        {
            return NO;
        }

        [Themes applyTheme:manifestId];
    }
    [Themes refreshDiscordTheme];
    return YES;
}

+ (void)refreshThemes
{
    switch (themeSelection().refresh())
    {
        case loader::ThemeRefresh::Reset:
            [Themes applyTheme:nil];
            break;
        case loader::ThemeRefresh::Reapply:
            [Themes applyTheme:[Themes getTheme]];
            break;
        case loader::ThemeRefresh::None:
            break;
    }

    [Themes refreshDiscordTheme];
}

+ (void)init
{
    uint64_t started = mach_absolute_time();
    [Themes refreshThemes];

    static dispatch_once_t observeOnce;
    dispatch_once(&observeOnce, ^{
        [[NSNotificationCenter defaultCenter]
            addObserverForName:SettingsDidChangeNotification
                        object:nil
                         queue:[NSOperationQueue mainQueue]
                    usingBlock:^(NSNotification *notification) { [Themes applySelectedTheme]; }];
    });
    [Themes applySelectedTheme];

    [Logger
          info:LOG_CATEGORY_THEMES
        format:@"Themes initialized in %.2f ms on the %@ thread. (%@)", millisecondsSince(started),
               [NSThread isMainThread] ? @"main" : @"runtime", [Themes getTheme] ?: @"default"];
};

+ (void)applySelectedTheme
{
    NSString *applied = [CoreBridge activeThemeId];
    if (!themeSelection().needsSelection(toStdString(applied)))
    {
        return;
    }

    NSString *themeId = applied.length > 0 ? applied : nil;

    if (![Themes setTheme:themeId])
    {
        [Logger error:LOG_CATEGORY_THEMES format:@"Selected theme %@ is not installed.", themeId];
    }
}

+ (void)swizzleRawColors:(NSDictionary *)payload
{
    Class instance = object_getClass(NSClassFromString(@"UIColor"));

    [Logger info:LOG_CATEGORY_THEMES format:@"Attempting swizzle raw colors..."];

    hookPaletteColors();

    Class                                       colorClass = NSClassFromString(@"UIColor");
    NSMutableDictionary<NSNumber *, UIColor *> *palette    = [NSMutableDictionary dictionary];
    NSMutableSet<NSNumber *>                   *ambiguous  = [NSMutableSet set];

    @try
    {
        for (NSString *raw in payload)
        {
            SEL selector = NSSelectorFromString(raw);

            // Read Discord's colour before hooking; themes may name raw colours this build lacks.
            UIColor *native = nil;
            if ([colorClass respondsToSelector:selector])
            {
                UIColor *(*getColor)(id, SEL) =
                    (UIColor * (*)(id, SEL)) [colorClass methodForSelector:selector];
                native = getColor(colorClass, selector);
            }

            __block id (*original)(Class, SEL);
            IMP     replacement = imp_implementationWithBlock(^UIColor *(id self) {
                UIColor *color = payload[raw];
                return color ?: original(instance, selector);
            });

            MSHookMessageEx(instance, selector, replacement, (IMP *) &original);

            originalRawImplementations[raw] = [NSValue valueWithPointer:(void *) original];

            NSNumber *key = native ? paletteKeyForColor(native) : nil;
            if (key && palette[key] && ![palette[key] isEqual:payload[raw]])
            {
                [ambiguous addObject:key];
            }
            else if (key)
            {
                palette[key] = payload[raw];
            }
        }

        [palette removeObjectsForKeys:ambiguous.allObjects];
        @synchronized([Themes class])
        {
            paletteColors = [palette copy];
        }

        [Logger info:LOG_CATEGORY_THEMES format:@"Raw color swizzle completed."];
    }
    @catch (NSException *e)
    {
        [Logger error:LOG_CATEGORY_THEMES format:@"Failed to swizzle raw colors. (%@)", e.reason];
    }
}

+ (void)restoreOriginalRawColors
{
    Class instance = object_getClass(NSClassFromString(@"UIColor"));

    @synchronized([Themes class])
    {
        paletteColors = nil;
    }

    for (NSString *selectorName in originalRawImplementations)
    {
        SEL selector    = NSSelectorFromString(selectorName);
        IMP originalIMP = (IMP)[originalRawImplementations[selectorName] pointerValue];

        if (originalIMP)
        {
            MSHookMessageEx(instance, selector, originalIMP, NULL);
        }
        else
        {
            [Logger error:LOG_CATEGORY_THEMES
                   format:@"Failed to restore implementation for %@: Original IMP is NULL",
                          selectorName];
        }
    }

    [originalRawImplementations removeAllObjects];
}

+ (void)ensureSemanticColorsSwizzled
{
    @synchronized(themeApplicationLock())
    {
        if (semanticColorsSwizzled)
        {
            return;
        }
        semanticColorsSwizzled = YES;
        [Themes swizzleSemanticColors];
    }
}

+ (void)swizzleSemanticColors
{
    [Logger info:LOG_CATEGORY_THEMES format:@"Attempting swizzle semantic colors..."];
    uint64_t started  = mach_absolute_time();
    unsigned swizzled = 0;

    @try
    {
        Class instance = object_getClass(NSClassFromString(@"DCDThemeColor"));

        unsigned methodCount = 0;
        Method  *methods     = class_copyMethodList(instance, &methodCount);

        for (unsigned int i = 0; i < methodCount; i++)
        {
            Method method = methods[i];

            if (method_getNumberOfArguments(method) != 2)
            {
                continue;
            }

            char returnType[8] = {0};
            method_getReturnType(method, returnType, sizeof(returnType));
            if (returnType[0] != '@')
            {
                continue;
            }

            SEL       selector = method_getName(method);
            NSString *name     = NSStringFromSelector(selector);

            __block id (*original)(Class, SEL) =
                (id (*)(Class, SEL)) method_getImplementation(method);
            IMP replacement = imp_implementationWithBlock(^UIColor *(id self) {
                UIColor  *themed   = nil;
                NSString *fallback = nil;
                @synchronized([Themes class])
                {
                    themed   = semanticColors[name];
                    fallback = themed ? nil : rawFallbacks[name];
                }

                if (themed)
                {
                    return themed;
                }

                if (fallback)
                {
                    SEL   colorSelector = NSSelectorFromString(fallback);
                    Class colorClass    = object_getClass(NSClassFromString(@"UIColor"));
                    if ([colorClass respondsToSelector:colorSelector])
                    {
                        UIColor *(*getColor)(id, SEL) =
                            (UIColor * (*)(id, SEL)) [colorClass methodForSelector:colorSelector];
                        return getColor(colorClass, colorSelector);
                    }
                }

                return original(instance, selector);
            });

            MSHookMessageEx(instance, selector, replacement, (IMP *) &original);
            swizzled++;
        }

        free(methods);
        [Logger info:LOG_CATEGORY_THEMES
              format:@"Semantic color swizzle completed: %u of %u getters in %.2f ms.", swizzled,
                     methodCount, millisecondsSince(started)];
    }
    @catch (NSException *e)
    {
        [Logger error:LOG_CATEGORY_THEMES
               format:@"Failed to swizzle semantic colors. (%@)", e.reason];
    }
}
@end

%hook DCDThemeModule
- (void)updateTheme:(id)theme
{
    if (![theme isKindOfClass:[NSString class]])
    {
        [Utilities runOnMainThread:^{ currentDiscordTheme = self; }];
        return %orig;
    }

    if (refreshingDiscordTheme)
    {
        return %orig;
    }

    [Utilities runOnMainThread:^{
        currentDiscordTheme = self;

        if (themeSelection().followDiscordTheme(toStdString(theme)))
        {
            [Themes applyTheme:theme];
        }
    }];

    %orig;
}
%end
