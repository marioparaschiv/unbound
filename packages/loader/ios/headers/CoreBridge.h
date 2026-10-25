#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface CoreBridge : NSObject

+ (void)installLogging;

+ (uint32_t)mainBundleBytecodeVersion;

+ (nullable UIColor *)colorFromString:(NSString *)value;
+ (nullable NSDictionary *)themeColorsForId:(NSString *)themeId;
+ (BOOL)hasTheme:(NSString *)themeId;

+ (void)scanAddons;
+ (NSArray *)themes;
+ (NSArray<NSDictionary *> *)fonts;

+ (NSString *)toolbox:(NSString *)action argument:(NSString *)argument;
+ (BOOL)toolboxSucceeded:(NSString *)action argument:(NSString *)argument;
+ (NSString *)toolboxMessage:(NSString *)key;
+ (NSString *)preference:(NSString *)action argument:(NSString *)argument;
+ (BOOL)preferenceEnabled:(NSString *)action;

@end

NS_ASSUME_NONNULL_END
