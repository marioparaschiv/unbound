#import <objc/runtime.h>
#import <substrate.h>

#import "Discord.h"
#import "Unbound.h"
#import "CoreBridge.h"
#import "LoaderShared.h"

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
