#import <objc/runtime.h>
#import <substrate.h>

#import "CoreBridge.h"
#import "Discord.h"
#import "LoaderShared.h"
#import "Unbound.h"

@interface Themes : NSObject
{
    NSMutableDictionary<NSString *, NSValue *> *originalRawImplementations;
    NSString                                   *currentThemeId;
}

+ (BOOL)isValidCustomTheme:(NSString *)manifestId;
+ (void)applyTheme:(NSString *)manifestId;
+ (BOOL)setTheme:(NSString *)manifestId;
+ (NSString *)getTheme;
+ (NSArray *)getThemes;
+ (void)refreshThemes;
+ (void)swizzleRawColors:(NSDictionary *)payload;
+ (void)restoreOriginalRawColors;
+ (void)swizzleSemanticColors;
+ (void)init;
+ (void)applySelectedTheme;

@end
