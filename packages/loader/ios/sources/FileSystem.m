#import "FileSystem.h"

static const NSTimeInterval kMonitorDebounce = 0.250;

static const unsigned long kFileVnodeMask =
    DISPATCH_VNODE_ATTRIB | DISPATCH_VNODE_DELETE | DISPATCH_VNODE_EXTEND | DISPATCH_VNODE_LINK |
    DISPATCH_VNODE_RENAME | DISPATCH_VNODE_REVOKE | DISPATCH_VNODE_WRITE;

static const unsigned long kFileGoneMask =
    DISPATCH_VNODE_DELETE | DISPATCH_VNODE_RENAME | DISPATCH_VNODE_REVOKE;

static const unsigned long kDirVnodeMask =
    DISPATCH_VNODE_WRITE | DISPATCH_VNODE_DELETE | DISPATCH_VNODE_RENAME;

@implementation FileMonitor
@end

@implementation DirectoryWatcher
@end

@implementation FileSystem
static NSMutableDictionary<NSString *, FileMonitor *>      *monitors    = nil;
static NSMutableDictionary<NSString *, DirectoryWatcher *> *dirWatchers = nil;
static NSFileManager                                       *manager     = nil;
static NSString                                            *documents   = nil;

static dispatch_queue_t monitorRegistryQueue(void)
{
    static dispatch_queue_t queue;
    static dispatch_once_t  once;
    dispatch_once(&once, ^{
        queue = dispatch_queue_create("app.unbound.fs.monitors", DISPATCH_QUEUE_SERIAL);
    });
    return queue;
}

+ (BOOL)exists:(NSString *)path
{
    return [manager fileExistsAtPath:path];
}

+ (BOOL)isDirectory:(NSString *)path
{
    BOOL isDirectory = NO;

    [manager fileExistsAtPath:path isDirectory:&isDirectory];

    return isDirectory;
}

+ (void)writeFile:(NSString *)path contents:(NSData *)contents
{
    NSError *error;
    if (![contents writeToFile:path options:NSDataWritingAtomic error:&error])
    {
        [Logger error:LOG_CATEGORY_FILESYSTEM format:@"Atomic write to %@ failed. (%@)", path, error];
    }
}

+ (id)delete:(NSString *)path
{
    if (![manager fileExistsAtPath:path])
    {
        NSError *error = [NSError errorWithDomain:NSCocoaErrorDomain
                                             code:NSFileNoSuchFileError
                                         userInfo:@{NSFilePathErrorKey : path}];

        return error;
    }

    NSError *error;
    [manager removeItemAtPath:path error:&error];

    return error ? error : path;
}

+ (NSData *)readFile:(NSString *)path
{
    if (![manager fileExistsAtPath:path])
    {
        @throw [[NSException alloc]
            initWithName:@"FileNotFound"
                  reason:[NSString stringWithFormat:@"File at path %@ was not found.", path]
                userInfo:nil];
    }

    NSError *error = nil;
    NSData  *data  = [NSData dataWithContentsOfFile:path options:0 error:&error];

    if (error)
    {
        @throw [[NSException alloc] initWithName:error.domain
                                          reason:error.localizedDescription
                                        userInfo:nil];
    }

    return data;
}

+ (BOOL)createDirectory:(NSString *)path
{
    if ([manager fileExistsAtPath:path])
    {
        return true;
    }

    NSError *err;
    [manager createDirectoryAtPath:path
        withIntermediateDirectories:false
                         attributes:nil
                              error:&err];

    return err ? false : true;
}

+ (NSArray *)readDirectory:(NSString *)path
{
    NSError *err;
    NSArray *files = [manager contentsOfDirectoryAtPath:path error:&err];

    return err ? @[] : files;
}

+ (void)monitor:(NSString *)filePath onChange:(void (^)())onChange autoRestart:(BOOL)autoRestart
{
    dispatch_async(monitorRegistryQueue(), ^{
        if (!monitors)
        {
            monitors = [NSMutableDictionary dictionary];
        }
        if (!dirWatchers)
        {
            dirWatchers = [NSMutableDictionary dictionary];
        }
        if (monitors[filePath])
        {
            return;
        }

        FileMonitor *monitor = [[FileMonitor alloc] init];
        monitor.path         = filePath;
        monitor.onChange     = onChange;
        monitor.queue        = dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0);
        monitors[filePath]   = monitor;

        DirectoryWatcher *dir =
            [FileSystem watcherForDirectory:monitor.path.stringByDeletingLastPathComponent
                                      queue:monitor.queue];
        [dir.files addObject:filePath];

        [FileSystem armFileSource:monitor];
    });
}

+ (void)stopMonitoring:(NSString *)path
{
    dispatch_async(monitorRegistryQueue(), ^{
        FileMonitor *monitor = monitors[path];
        if (!monitor)
        {
            return;
        }

        if (monitor.fileSource)
        {
            dispatch_source_cancel(monitor.fileSource);
        }
        if (monitor.debounceTimer)
        {
            dispatch_source_cancel(monitor.debounceTimer);
        }

        [monitors removeObjectForKey:path];
        [FileSystem releaseDirectoryWatcherFor:path.stringByDeletingLastPathComponent];

        [Logger debug:LOG_CATEGORY_FILESYSTEM format:@"monitor for %@ was destroyed", path];
    });
}

#pragma mark - Monitoring internals (run on monitorRegistryQueue)

+ (DirectoryWatcher *)watcherForDirectory:(NSString *)dirPath queue:(dispatch_queue_t)queue
{
    DirectoryWatcher *existing = dirWatchers[dirPath];
    if (existing)
    {
        return existing;
    }

    DirectoryWatcher *watcher = [[DirectoryWatcher alloc] init];
    watcher.path              = dirPath;
    watcher.files             = [NSMutableSet set];
    dirWatchers[dirPath]      = watcher;

    int fd = open(dirPath.fileSystemRepresentation, O_EVTONLY);
    if (fd < 0)
    {
        [Logger error:LOG_CATEGORY_FILESYSTEM
               format:@"Failed to open dir %@ for monitoring (errno %d)", dirPath, errno];
        return watcher;
    }

    watcher.source = dispatch_source_create(DISPATCH_SOURCE_TYPE_VNODE, fd, kDirVnodeMask, queue);

    dispatch_source_set_event_handler(watcher.source, ^{
        dispatch_sync(monitorRegistryQueue(), ^{ [FileSystem handleDirectoryEvent:dirPath]; });
    });
    dispatch_source_set_cancel_handler(watcher.source, ^{ close(fd); });

    dispatch_resume(watcher.source);
    return watcher;
}

+ (void)handleDirectoryEvent:(NSString *)dirPath
{
    for (NSString *file in [dirWatchers[dirPath].files copy])
    {
        FileMonitor *monitor = monitors[file];
        if (!monitor.fileSource)
        {
            [FileSystem armFileSource:monitor];
        }
        [FileSystem scheduleNotify:monitor];
    }
}

+ (void)releaseDirectoryWatcherFor:(NSString *)dirPath
{
    DirectoryWatcher *watcher = dirWatchers[dirPath];
    [watcher.files removeObject:dirPath];

    if (watcher.files.count == 0)
    {
        if (watcher.source)
        {
            dispatch_source_cancel(watcher.source);
        }
        [dirWatchers removeObjectForKey:dirPath];
    }
}

+ (void)armFileSource:(FileMonitor *)monitor
{
    if (!monitor || monitor.fileSource)
    {
        return;
    }

    int fd = open(monitor.path.fileSystemRepresentation, O_EVTONLY);
    if (fd < 0)
    {
        return;
    }

    dispatch_source_t source =
        dispatch_source_create(DISPATCH_SOURCE_TYPE_VNODE, fd, kFileVnodeMask, monitor.queue);

    dispatch_source_set_event_handler(source, ^{
        unsigned long flags = dispatch_source_get_data(source);
        dispatch_sync(monitorRegistryQueue(), ^{ [FileSystem scheduleNotify:monitor]; });

        if (flags & kFileGoneMask)
        {
            dispatch_sync(monitorRegistryQueue(), ^{
                if (monitor.fileSource == source)
                {
                    monitor.fileSource = nil;
                }
            });
            dispatch_source_cancel(source);
        }
    });
    dispatch_source_set_cancel_handler(source, ^{ close(fd); });

    monitor.fileSource = source;
    dispatch_resume(source);
}

+ (void)scheduleNotify:(FileMonitor *)monitor
{
    if (!monitor)
    {
        return;
    }

    if (monitor.debounceTimer)
    {
        dispatch_source_cancel(monitor.debounceTimer);
    }

    dispatch_block_t onChange = monitor.onChange;
    monitor.debounceTimer     = [Utilities createDebounceTimer:kMonitorDebounce
                                                     queue:monitor.queue
                                                     block:^{
                                                         if (onChange)
                                                         {
                                                             onChange();
                                                         }
                                                     }];
}

+ (NSHTTPURLResponse *)download:(NSURL *)url
                           path:(NSString *)path
                    withHeaders:(NSDictionary *)headers
                 requestTimeout:(NSTimeInterval)requestTimeout
                   totalTimeout:(NSTimeInterval)totalTimeout
{
    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);

    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
    request.cachePolicy          = NSURLRequestReloadIgnoringCacheData;
    request.timeoutInterval      = requestTimeout;

    __block NSHTTPURLResponse *response;
    __block NSException       *exception;

    for (NSString *header in headers)
    {
        NSString *value = headers[header];
        [request setValue:value forHTTPHeaderField:header];
    }

    NSURLSessionTask *task = [[NSURLSession sharedSession]
        dataTaskWithRequest:request
          completionHandler:^(NSData *data, NSURLResponse *res, NSError *error) {
              response = (NSHTTPURLResponse *) res;

              if (error != nil)
              {
                  exception = [[NSException alloc] initWithName:@"DownloadFailed"
                                                         reason:error.localizedDescription
                                                       userInfo:nil];
              }
              else if ([response statusCode] == 200)
              {
                  [Logger info:LOG_CATEGORY_FILESYSTEM
                        format:@"Saving file from %@ to %@", url, path];
                  if (![data writeToFile:path atomically:YES])
                  {
                      exception = [[NSException alloc] initWithName:@"DownloadWriteFailed"
                                                             reason:@"Downloaded bundle could not be saved"
                                                           userInfo:nil];
                  }
              }

              dispatch_semaphore_signal(semaphore);
          }];

    [task resume];

    if (dispatch_semaphore_wait(semaphore,
                                dispatch_time(DISPATCH_TIME_NOW, (int64_t) (totalTimeout * NSEC_PER_SEC))) != 0)
    {
        [task cancel];
        @throw [[NSException alloc] initWithName:@"DownloadTimedOut"
                                         reason:@"Bundle download exceeded its time limit"
                                       userInfo:nil];
    }

    if (exception)
    {
        @throw exception;
    }

    return response;
}

+ (void)init
{
    if (!manager)
    {
        manager = [NSFileManager defaultManager];
    }

    if (!documents)
    {
        documents = [NSString pathWithComponents:@[ NSHomeDirectory(), @"Documents", @"Unbound" ]];
    }

    if (![FileSystem exists:documents])
    {
        [FileSystem createDirectory:documents];
    }
}

+ (NSString *)documents
{
    return documents;
}
@end
