#import <CoreGraphics/CGFont.h>
#import <CoreText/CoreText.h>
#import <objc/runtime.h>
#import <substrate.h>

#import "Unbound.h"
#import "LoaderShared.h"

@interface Fonts : NSObject
{
    NSMutableDictionary<NSString *, NSString *>            *overrides;
}

+ (void)apply;
+ (void)init;
+ (void)loadFont:(NSString *)path;
+ (NSString *)getFontNameByRef:(CGFontRef)ref;
+ (NSArray *)getAvailableFonts;


+ (NSMutableDictionary<NSString *, NSString *> *)overrides;

@end
