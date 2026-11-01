#import "Themes.h"

#import "AddonsCore.h"
#import "CoreBridge.h"
#import "CoreConversions.h"
#include "LoaderThemes.h"

using unbound::ios::toNSString;
using unbound::ios::toStdString;

@interface Themes ()
+ (void)refreshDiscordTheme;
+ (void)applyThemeOnMainThread:(NSString *)manifestId;
+ (BOOL)setThemeOnMainThread:(NSString *)manifestId;
@end

@implementation Themes
static NSMutableDictionary<NSString *, NSValue *> *originalRawImplementations;
static __weak DCDThemeModule                      *currentDiscordTheme;
static BOOL                                        semanticColorsSwizzled = NO;
static BOOL                                        refreshingDiscordTheme = NO;
static NSDictionary<NSString *, UIColor *>        *semanticColors         = nil;
static NSDictionary<NSString *, NSString *>       *rawFallbacks           = nil;

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
    [Utilities runOnMainThread:^{ [Themes applyThemeOnMainThread:manifestId]; }];
}

+ (void)applyThemeOnMainThread:(NSString *)manifestId
{
    NSString *themeId = optionalThemeId(themeSelection().apply(toStdString(manifestId)));

    [Logger info:LOG_CATEGORY_THEMES format:@"Theme updated. (%@)", themeId ?: @"default"];

    [Themes restoreOriginalRawColors];

    NSDictionary *colors = nil;
    if (themeId)
    {
        colors = [CoreBridge themeColorsForId:themeId];
    }

    @synchronized([Themes class])
    {
        semanticColors = colors[@"semantic"];
        rawFallbacks   = colors[@"rawFallbacks"];
    }

    NSDictionary *raw = colors[@"raw"];
    if (raw.count)
    {
        [Themes swizzleRawColors:raw];
    }
}

+ (void)refreshDiscordTheme
{
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
    __block BOOL applied = NO;
    [Utilities runOnMainThread:^{ applied = [Themes setThemeOnMainThread:manifestId]; }];
    return applied;
}

+ (BOOL)setThemeOnMainThread:(NSString *)manifestId
{
    if (!themeSelection().select(toStdString(manifestId)))
    {
        return NO;
    }

    [Themes applyThemeOnMainThread:manifestId];
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
    if (!originalRawImplementations)
    {
        originalRawImplementations = [[NSMutableDictionary alloc] init];
    }

    [Themes refreshThemes];

    if (!semanticColorsSwizzled)
    {
        [Themes swizzleSemanticColors];
        semanticColorsSwizzled = YES;
    }

    static dispatch_once_t observeOnce;
    dispatch_once(&observeOnce, ^{
        [[NSNotificationCenter defaultCenter]
            addObserverForName:SettingsDidChangeNotification
                        object:nil
                         queue:[NSOperationQueue mainQueue]
                    usingBlock:^(NSNotification *notification) { [Themes applySelectedTheme]; }];
    });
    [Themes applySelectedTheme];
};

+ (void)applySelectedTheme
{
    NSString *applied = [CoreBridge preference:@"active-theme" argument:@""];
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

    @try
    {
        for (NSString *raw in payload)
        {
            SEL selector = NSSelectorFromString(raw);

            __block id (*original)(Class, SEL);
            IMP     replacement = imp_implementationWithBlock(^UIColor *(id self) {
                UIColor *color = payload[raw];
                return color ?: original(instance, selector);
            });

            MSHookMessageEx(instance, selector, replacement, (IMP *) &original);

            originalRawImplementations[raw] = [NSValue valueWithPointer:(void *) original];
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

+ (void)swizzleSemanticColors
{
    [Logger info:LOG_CATEGORY_THEMES format:@"Attempting swizzle semantic colors..."];

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

            __block id (*original)(Class, SEL);
            IMP     replacement = imp_implementationWithBlock(^UIColor *(id self) {
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
        }

        free(methods);
        [Logger info:LOG_CATEGORY_THEMES format:@"Semantic color swizzle completed."];
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
