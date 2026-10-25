#import <objc/runtime.h>
#import <substrate.h>

#import "Discord.h"
#import "Unbound.h"
#import "CoreBridge.h"
#import "LoaderShared.h"

@interface Themes : NSObject
{
    NSMutableArray                             *themes;
    NSMutableDictionary<NSString *, NSValue *> *originalRawImplementations;
    NSString                                   *currentThemeId;
}

+ (NSDictionary *)getThemeById:(NSString *)manifestId;
+ (BOOL)isValidCustomTheme:(NSString *)manifestId;
+ (void)applyTheme:(NSString *)manifestId;
+ (BOOL)setTheme:(NSString *)manifestId;
+ (NSString *)getTheme;
+ (NSArray *)getThemes;
+ (NSArray *)reloadThemes;
+ (void)swizzleRawColors:(NSDictionary *)payload;
+ (void)restoreOriginalRawColors;
+ (void)swizzleSemanticColors;
+ (NSString *)makeJSON;
+ (void)init;
+ (void)applySelectedTheme;

@end
