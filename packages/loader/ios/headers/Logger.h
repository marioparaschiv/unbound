#import <Foundation/Foundation.h>
#import <os/log.h>

#include "LoaderLogCategories.h"

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, LogLevel) {
    LogLevelDebug,
    LogLevelInfo,
    LogLevelWarning,
    LogLevelError
};

@interface Logger : NSObject

+ (void)initialize;

+ (void)log:(LogLevel)level category:(const char *)category format:(NSString *)format, ...;

+ (void)debug:(const char *)category format:(NSString *)format, ...;
+ (void)info:(const char *)category format:(NSString *)format, ...;
+ (void)warning:(const char *)category format:(NSString *)format, ...;
+ (void)error:(const char *)category format:(NSString *)format, ...;

@end

NS_ASSUME_NONNULL_END
