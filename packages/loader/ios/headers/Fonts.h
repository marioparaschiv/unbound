#import <CoreGraphics/CGFont.h>
#import <CoreText/CoreText.h>
#import <objc/runtime.h>
#import <substrate.h>

#import "Unbound.h"
#import "LoaderShared.h"

@interface Fonts : NSObject
{
    NSMutableDictionary<NSString *, NSString *>            *overrides;
    NSMutableArray<NSDictionary<NSString *, NSString *> *> *fonts;
}

+ (void)apply;
+ (void)init;
+ (void)loadFont:(NSString *)path;
+ (NSString *)getFontName:(NSString *)path;
+ (NSString *)getFontNameByRef:(CGFontRef)ref;
+ (NSArray *)getAvailableFonts;

+ (NSString *)makeAvailableJSON;
+ (NSString *)makeJSON;

+ (NSMutableDictionary<NSString *, NSString *> *)overrides;

@end
