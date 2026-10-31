#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface CoreBridge : NSObject

+ (void)installLogging;
+ (void)openLogFile;

+ (NSString *)documentsName;

+ (uint32_t)mainBundleBytecodeVersion;

+ (nullable UIColor *)colorFromString:(NSString *)value;
+ (BOOL)isDarkColor:(UIColor *)color;

+ (nullable NSDictionary *)themeColorsForId:(NSString *)themeId;
+ (BOOL)hasTheme:(NSString *)themeId;

+ (void)scanAddons;
+ (NSArray *)themes;
+ (NSArray<NSDictionary *> *)fonts;
+ (NSDictionary *)fontOverridePlan;
+ (NSString *)everyFontFamily;

+ (NSString *)toolbox:(NSString *)action argument:(NSString *)argument;
+ (NSDictionary *)toolboxObject:(NSString *)action argument:(NSString *)argument;
+ (NSArray *)toolboxArray:(NSString *)action argument:(NSString *)argument;
+ (NSDictionary *)toolboxMenu:(NSDictionary *)options;
+ (NSTimeInterval)toolboxHoldDuration;
+ (NSString *)preference:(NSString *)action argument:(NSString *)argument;
+ (BOOL)preferenceEnabled:(NSString *)action;

+ (CGFloat)devOverlayButtonSide;
+ (CGPoint)devOverlayCenterInBounds:(CGSize)bounds insets:(UIEdgeInsets)insets;
+ (CGPoint)clampDevOverlayCenter:(CGPoint)center bounds:(CGSize)bounds insets:(UIEdgeInsets)insets;
+ (void)saveDevOverlayCenter:(CGPoint)center bounds:(CGSize)bounds;
+ (CGRect)devOverlayButtonFrameForCenter:(CGPoint)center;
+ (CGRect)devOverlayCollapsedFrameForCenter:(CGPoint)center screen:(CGRect)screen;
+ (BOOL)devOverlayVisibleOnVirtualDevice:(BOOL)virtualDevice debugBuild:(BOOL)debugBuild;

+ (NSString *)incompatibleHostMessage;
+ (NSString *)developmentBuildBanner;
+ (NSTimeInterval)developmentBuildBannerDuration;

@end

NS_ASSUME_NONNULL_END
