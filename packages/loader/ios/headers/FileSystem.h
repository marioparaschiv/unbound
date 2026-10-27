#import "Unbound.h"

@interface FileSystem : NSObject
{
    NSFileManager *manager;
    NSString      *documents;
}

+ (BOOL)createDirectory:(NSString *)path;
+ (void)writeFile:(NSString *)path contents:(NSData *)contents;

+ (id)delete:(NSString *)path;

+ (NSHTTPURLResponse *)download:(NSURL *)url
                           path:(NSString *)path
                    withHeaders:(NSDictionary *)headers
                 requestTimeout:(NSTimeInterval)requestTimeout
                   totalTimeout:(NSTimeInterval)totalTimeout;

+ (void)monitor:(NSString *)filePath onChange:(void (^)())onChange autoRestart:(BOOL)autoRestart;
+ (void)stopMonitoring:(NSString *)path;

+ (NSArray *)readDirectory:(NSString *)path;
+ (NSData *)readFile:(NSString *)path;

+ (BOOL)isDirectory:(NSString *)path;
+ (BOOL)exists:(NSString *)path;

+ (void)init;

+ (NSString *)documents;

@end
