#import "CoreBridge.h"
#import "Themes.h"

@interface Themes ()
+ (void)loadThemes;
+ (void)refreshDiscordTheme;
+ (void)applyThemeOnMainThread:(NSString *)manifestId;
+ (BOOL)setThemeOnMainThread:(NSString *)manifestId;
@end

@implementation Themes
static NSMutableDictionary<NSString *, NSValue *> *originalRawImplementations;
static NSMutableArray                             *themes         = nil;
static NSString                                   *currentThemeId = nil;
static __weak DCDThemeModule                      *currentDiscordTheme;
static NSString                                   *lastDiscordThemeId = nil;
static BOOL                                        semanticColorsSwizzled = NO;
static BOOL                                        refreshingDiscordTheme = NO;
static BOOL                                        customThemeActive = NO;
static NSDictionary<NSString *, UIColor *>        *semanticColors = nil;
static NSDictionary<NSString *, NSString *>       *rawFallbacks   = nil;

+ (NSString *)makeJSON
{
    return [Utilities JSONStringFromObject:themes options:0 fallback:@"[]"];
};

+ (NSDictionary *)getThemeById:(NSString *)manifestId
{
    NSPredicate *predicate = [NSPredicate predicateWithFormat:@"manifest.id == %@", manifestId];
    NSArray     *array     = [themes filteredArrayUsingPredicate:predicate];

    if ([array count] != 0)
    {
        return array[0];
    }

    return nil;
}

+ (BOOL)isValidCustomTheme:(NSString *)manifestId
{
    return [Themes getThemeById:manifestId] != nil;
}

+ (NSString *)getTheme
{
    return currentThemeId;
}

+ (NSArray *)getThemes
{
    return [themes copy] ?: @[];
}

+ (void)applyTheme:(NSString *)manifestId
{
    [Utilities runOnMainThread:^{ [Themes applyThemeOnMainThread:manifestId]; }];
}

+ (void)applyThemeOnMainThread:(NSString *)manifestId
{
    NSString *themeId = manifestId.length > 0 ? manifestId : nil;

    [Logger info:LOG_CATEGORY_THEMES format:@"Theme updated. (%@)", themeId ?: @"default"];
    currentThemeId = themeId;

    [Themes restoreOriginalRawColors];

    NSDictionary *colors = nil;
    if (themeId && ![CoreBridge preferenceEnabled:@"recovery"])
    {
        colors = [CoreBridge themeColors:[Themes getThemeById:themeId] ?: @{}];
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
    DCDThemeModule *theme = currentDiscordTheme;
    if (!theme || lastDiscordThemeId.length == 0)
    {
        return;
    }

    refreshingDiscordTheme = YES;
    @try
    {
        [theme updateTheme:lastDiscordThemeId];
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
    NSString *themeId = manifestId.length > 0 ? manifestId : nil;
    if (themeId && ![Themes isValidCustomTheme:themeId])
    {
        return NO;
    }

    customThemeActive = themeId != nil;
    [Themes applyThemeOnMainThread:themeId];
    [Themes refreshDiscordTheme];
    return YES;
}

+ (void)loadThemes
{
    [themes addObjectsFromArray:[CoreBridge scanThemesIn:FileSystem.documents]];
}

+ (NSArray *)reloadThemes
{
    [themes removeAllObjects];
    [Themes loadThemes];

    if (currentThemeId && ![Themes isValidCustomTheme:currentThemeId])
    {
        customThemeActive = NO;
        [Themes applyTheme:nil];
    }
    else if (currentThemeId)
    {
        [Themes applyTheme:currentThemeId];
    }

    [Themes refreshDiscordTheme];
    return [Themes getThemes];
}

+ (void)init
{
    if (!themes)
    {
        themes = [[NSMutableArray alloc] init];
    }

    if (!originalRawImplementations)
    {
        originalRawImplementations = [[NSMutableDictionary alloc] init];
    }

    [Themes reloadThemes];

    if (![CoreBridge preferenceEnabled:@"recovery"] && !semanticColorsSwizzled)
    {
        [Themes swizzleSemanticColors];
        semanticColorsSwizzled = YES;
    }

    static dispatch_once_t observeOnce;
    dispatch_once(&observeOnce, ^{
        [[NSNotificationCenter defaultCenter] addObserverForName:SettingsDidChangeNotification
                                                          object:nil
                                                           queue:[NSOperationQueue mainQueue]
                                                      usingBlock:^(NSNotification *notification) {
                                                          [Themes applySelectedTheme];
                                                      }];
    });
    [Themes applySelectedTheme];
};

+ (void)applySelectedTheme
{
    NSString *applied = [CoreBridge preference:@"applied-theme" argument:@""];
    NSString *themeId = applied.length > 0 ? applied : nil;
    if (themeId == currentThemeId || [themeId isEqualToString:currentThemeId])
    {
        return;
    }

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
                            (UIColor * (*) (id, SEL))[colorClass methodForSelector:colorSelector];
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
        lastDiscordThemeId = theme;

        if (!customThemeActive && ![currentThemeId isEqualToString:theme])
        {
            [Themes applyTheme:theme];
        }
    }];

    %orig;
}
%end
