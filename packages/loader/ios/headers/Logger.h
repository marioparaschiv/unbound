#import <Foundation/Foundation.h>
#import <os/log.h>

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, LogLevel) {
    LogLevelDebug,
    LogLevelInfo,
    LogLevelNotice,
    LogLevelError,
    LogLevelFault
};

@interface Logger : NSObject

+ (void)initialize;

+ (void)log:(LogLevel)level category:(const char *)category format:(NSString *)format, ...;

+ (void)debug:(const char *)category format:(NSString *)format, ...;
+ (void)info:(const char *)category format:(NSString *)format, ...;
+ (void)notice:(const char *)category format:(NSString *)format, ...;
+ (void)error:(const char *)category format:(NSString *)format, ...;
+ (void)fault:(const char *)category format:(NSString *)format, ...;

@end

#define LOG_CATEGORY_DEFAULT    "default"
#define LOG_CATEGORY_PLUGINS    "plugins"
#define LOG_CATEGORY_THEMES     "themes"
#define LOG_CATEGORY_SETTINGS   "settings"
#define LOG_CATEGORY_FILESYSTEM "filesystem"
#define LOG_CATEGORY_UPDATER    "updater"
#define LOG_CATEGORY_UTILITIES  "utilities"
#define LOG_CATEGORY_TOOLBOX    "toolbox"
#define LOG_CATEGORY_FONTS      "fonts"
#define LOG_CATEGORY_CHATUI     "chatui"
#define LOG_CATEGORY_DEBUGGER   "debugger"

NS_ASSUME_NONNULL_END
