#import "Unbound.h"

@interface Updater : NSObject
{
    NSString *etag;
}

+ (NSString *)downloadBundle:(NSString *)preferredPath;
+ (NSString *)resolveBundlePath;
+ (NSString *)resolveUpdateURL;
+ (NSURL *)getDownloadURL;
+ (BOOL)markBundleAttempted:(NSString *)path;
+ (BOOL)acceptBundle:(NSString *)path;
+ (void)rejectBundle:(NSString *)path;

@end
