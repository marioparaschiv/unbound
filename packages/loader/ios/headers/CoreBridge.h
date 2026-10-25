#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface CoreBridge : NSObject

+ (void)installLogging;

+ (uint32_t)mainBundleBytecodeVersion;

+ (nullable UIColor *)colorFromString:(NSString *)value;
+ (NSDictionary *)themeColors:(NSDictionary *)theme;

+ (NSMutableArray *)scanPluginsIn:(NSString *)documents;
+ (NSMutableArray *)scanThemesIn:(NSString *)documents;
+ (NSMutableArray *)scanFontsIn:(NSString *)documents
                   nameResolver:(NSString *_Nullable (^)(NSString *path))resolver;

+ (NSString *)toolbox:(NSString *)action argument:(NSString *)argument;
+ (BOOL)toolboxSucceeded:(NSString *)action argument:(NSString *)argument;
+ (NSString *)toolboxMessage:(NSString *)key;

@end

NS_ASSUME_NONNULL_END
