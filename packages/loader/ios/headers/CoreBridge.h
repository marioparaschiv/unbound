#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface CoreBridge : NSObject

+ (void)installLogging;

+ (NSString *)documentsName;

+ (uint32_t)mainBundleBytecodeVersion;

+ (nullable UIColor *)colorFromString:(NSString *)value;
+ (nullable NSDictionary *)themeColorsForId:(NSString *)themeId;
+ (BOOL)hasTheme:(NSString *)themeId;

+ (void)scanAddons;
+ (NSArray *)themes;
+ (NSArray<NSDictionary *> *)fonts;
+ (NSDictionary<NSString *, NSDictionary *> *)fontOverrideTargets;

+ (NSString *)toolbox:(NSString *)action argument:(NSString *)argument;
+ (NSDictionary *)toolboxObject:(NSString *)action argument:(NSString *)argument;
+ (NSDictionary *)toolboxMenu:(NSDictionary *)options;
+ (NSTimeInterval)toolboxHoldDuration;
+ (NSString *)preference:(NSString *)action argument:(NSString *)argument;
+ (BOOL)preferenceEnabled:(NSString *)action;

@end

NS_ASSUME_NONNULL_END
