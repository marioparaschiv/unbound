#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface CoreBridge : NSObject

+ (void)installLogging;

+ (NSMutableArray *)scanPluginsIn:(NSString *)documents;
+ (NSMutableArray *)scanThemesIn:(NSString *)documents;
+ (NSMutableArray *)scanFontsIn:(NSString *)documents
                   nameResolver:(NSString *_Nullable (^)(NSString *path))resolver;

+ (BOOL)wipeAddonsNamed:(NSString *)kind in:(NSString *)documents;
+ (BOOL)factoryResetIn:(NSString *)documents;
+ (NSString *)issueURLForPlatform:(NSString *)platform
                      environment:(NSArray<NSArray<NSString *> *> *)environment
                      attachments:(NSArray<NSArray<NSString *> *> *)attachments;

@end

NS_ASSUME_NONNULL_END
