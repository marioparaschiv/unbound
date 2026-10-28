#import "Unbound.h"

@interface FileSystem : NSObject
{
    NSFileManager *manager;
    NSString      *documents;
}

+ (BOOL)createDirectory:(NSString *)path;

+ (NSHTTPURLResponse *)download:(NSURL *)url
                           path:(NSString *)path
                    withHeaders:(NSDictionary *)headers
                 requestTimeout:(NSTimeInterval)requestTimeout
                   totalTimeout:(NSTimeInterval)totalTimeout;

+ (void)monitor:(NSString *)filePath onChange:(void (^)())onChange autoRestart:(BOOL)autoRestart;

+ (BOOL)exists:(NSString *)path;

+ (void)init;

+ (NSString *)documents;

@end
