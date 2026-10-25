#import "Unbound.h"

@interface FileMonitor : NSObject
@property (copy) NSString           *path;
@property (copy) dispatch_block_t    onChange;
@property (strong) dispatch_source_t fileSource;
@property (strong) dispatch_source_t debounceTimer;
@property (strong) dispatch_queue_t  queue;
@end

@interface DirectoryWatcher : NSObject
@property (copy) NSString                   *path;
@property (strong) dispatch_source_t         source;
@property (strong) NSMutableSet<NSString *> *files;
@end

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
                    withHeaders:(NSDictionary *)headers;
+ (NSHTTPURLResponse *)download:(NSURL *)url path:(NSString *)path;

+ (void)monitor:(NSString *)filePath onChange:(void (^)())onChange autoRestart:(BOOL)autoRestart;
+ (void)stopMonitoring:(NSString *)path;

+ (DirectoryWatcher *)watcherForDirectory:(NSString *)dirPath queue:(dispatch_queue_t)queue;
+ (void)releaseDirectoryWatcherFor:(NSString *)dirPath;
+ (void)handleDirectoryEvent:(NSString *)dirPath;
+ (void)armFileSource:(FileMonitor *)monitor;
+ (void)scheduleNotify:(FileMonitor *)monitor;

+ (NSArray *)readDirectory:(NSString *)path;
+ (NSData *)readFile:(NSString *)path;

+ (BOOL)isDirectory:(NSString *)path;
+ (BOOL)exists:(NSString *)path;

+ (void)init;

+ (NSString *)documents;

@end
