#import <CoreGraphics/CGFont.h>
#import <CoreText/CoreText.h>
#import <objc/runtime.h>
#import <substrate.h>

#import "LoaderShared.h"
#import "Unbound.h"

@interface Fonts : NSObject

+ (void)apply;
+ (void)init;
+ (void)loadFont:(NSString *)path;
+ (NSString *)getFontNameByRef:(CGFontRef)ref;

+ (NSDictionary<NSString *, NSString *> *)overrides;
+ (UIFont *)replacementFor:(NSString *)name
                      size:(CGFloat)size
                  original:(UIFontDescriptor *)original;

@end
