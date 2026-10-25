#import <CoreGraphics/CGFont.h>
#import <CoreText/CoreText.h>
#import <objc/runtime.h>
#import <substrate.h>

#import "Unbound.h"
#import "LoaderShared.h"

@interface Fonts : NSObject

+ (void)apply;
+ (void)init;
+ (void)loadFont:(NSString *)path;
+ (NSString *)getFontNameByRef:(CGFontRef)ref;
+ (NSArray *)getAvailableFonts;


+ (NSDictionary<NSString *, NSString *> *)overrides;

@end
