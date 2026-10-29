#import "FileSystem.h"

#include <map>
#include <memory>
#include <mutex>

#import "CoreBridge.h"
#import "CoreConversions.h"
#include "LoaderFileWatcher.h"

using unbound::ios::toStdString;

static const unsigned long kFileVnodeMask =
    DISPATCH_VNODE_ATTRIB | DISPATCH_VNODE_DELETE | DISPATCH_VNODE_EXTEND | DISPATCH_VNODE_LINK |
    DISPATCH_VNODE_RENAME | DISPATCH_VNODE_REVOKE | DISPATCH_VNODE_WRITE;

static const unsigned long kFileGoneMask =
    DISPATCH_VNODE_DELETE | DISPATCH_VNODE_RENAME | DISPATCH_VNODE_REVOKE;

static const unsigned long kDirVnodeMask =
    DISPATCH_VNODE_WRITE | DISPATCH_VNODE_DELETE | DISPATCH_VNODE_RENAME;

class DispatchFileWatchBackend final : public loader::FileWatchBackend
{
public:
    void attach(std::weak_ptr<loader::FileWatcher> watcher)
    {
        watcher_ = std::move(watcher);
    }

    bool watchFile(const std::string &path) override
    {
        dispatch_source_t source = createSource(path, kFileVnodeMask);
        if (!source)
        {
            return false;
        }
        std::weak_ptr<loader::FileWatcher> watcher     = watcher_;
        const std::string                  watchedPath = path;
        dispatch_source_set_event_handler(source, ^{
            if (!isCurrent(files_, watchedPath, source))
            {
                return;
            }
            const loader::FileWatchEvent event = (dispatch_source_get_data(source) & kFileGoneMask)
                                                     ? loader::FileWatchEvent::Removed
                                                     : loader::FileWatchEvent::Changed;
            if (auto active = watcher.lock())
            {
                active->fileChanged(watchedPath, event);
            }
        });
        store(files_, path, source);
        return true;
    }

    void unwatchFile(const std::string &path) override
    {
        cancel(files_, path);
    }

    bool watchDirectory(const std::string &path) override
    {
        dispatch_source_t source = createSource(path, kDirVnodeMask);
        if (!source)
        {
            [Logger error:LOG_CATEGORY_FILESYSTEM
                   format:@"Failed to open dir %s for monitoring (errno %d)", path.c_str(), errno];
            return false;
        }
        std::weak_ptr<loader::FileWatcher> watcher     = watcher_;
        const std::string                  watchedPath = path;
        dispatch_source_set_event_handler(source, ^{
            if (auto active = watcher.lock())
            {
                active->directoryChanged(watchedPath);
            }
        });
        store(directories_, path, source);
        return true;
    }

    void unwatchDirectory(const std::string &path) override
    {
        cancel(directories_, path);
    }

private:
    using Sources = std::map<std::string, dispatch_source_t>;

    static dispatch_source_t createSource(const std::string &path, unsigned long mask)
    {
        int fd = open(path.c_str(), O_EVTONLY);
        if (fd < 0)
        {
            return nil;
        }
        dispatch_source_t source =
            dispatch_source_create(DISPATCH_SOURCE_TYPE_VNODE, fd, mask,
                                   dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0));
        dispatch_source_set_cancel_handler(source, ^{ close(fd); });
        return source;
    }

    bool isCurrent(Sources &sources, const std::string &path, dispatch_source_t source)
    {
        std::lock_guard<std::mutex> lock(mutex_);
        const auto                  found = sources.find(path);
        return found != sources.end() && found->second == source;
    }

    void store(Sources &sources, const std::string &path, dispatch_source_t source)
    {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            sources[path] = source;
        }
        dispatch_resume(source);
    }

    void cancel(Sources &sources, const std::string &path)
    {
        dispatch_source_t source = nil;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            const auto                  found = sources.find(path);
            if (found == sources.end())
            {
                return;
            }
            source = found->second;
            sources.erase(found);
        }
        dispatch_source_cancel(source);
    }

    std::weak_ptr<loader::FileWatcher> watcher_;
    Sources                            files_;
    Sources                            directories_;
    std::mutex                         mutex_;
};

static loader::FileWatcher &fileWatcher(void)
{
    static std::shared_ptr<loader::FileWatcher> watcher;
    static dispatch_once_t                      once;
    dispatch_once(&once, ^{
        auto backend = std::make_shared<DispatchFileWatchBackend>();
        watcher      = std::make_shared<loader::FileWatcher>(
            backend,
            [](double seconds, std::function<void()> work) {
                dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t) (seconds * NSEC_PER_SEC)),
                               dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0),
                               ^{ work(); });
            },
            loader::kDispatchSourceDebounceSeconds);
        backend->attach(watcher);
    });
    return *watcher;
}

@implementation FileSystem
static NSFileManager *manager   = nil;
static NSString      *documents = nil;

+ (BOOL)exists:(NSString *)path
{
    return [manager fileExistsAtPath:path];
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

+ (void)monitor:(NSString *)filePath onChange:(void (^)())onChange autoRestart:(BOOL)autoRestart
{
    dispatch_block_t callback = onChange;
    fileWatcher().watch(toStdString(filePath), [callback] {
        if (callback)
        {
            callback();
        }
    });
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
                  NSString *reason =
                      [NSString stringWithFormat:@"%@ %ld", error.domain, (long) error.code];
                  exception = [[NSException alloc] initWithName:@"DownloadFailed"
                                                         reason:reason
                                                       userInfo:nil];
              }
              else if ([response statusCode] == 200)
              {
                  [Logger info:LOG_CATEGORY_FILESYSTEM
                        format:@"Saving file from %@ to %@", url, path];
                  if (![data writeToFile:path atomically:YES])
                  {
                      exception =
                          [[NSException alloc] initWithName:@"DownloadWriteFailed"
                                                     reason:@"Downloaded bundle could not be saved"
                                                   userInfo:nil];
                  }
              }

              dispatch_semaphore_signal(semaphore);
          }];

    [task resume];

    if (dispatch_semaphore_wait(
            semaphore, dispatch_time(DISPATCH_TIME_NOW, (int64_t) (totalTimeout * NSEC_PER_SEC))) !=
        0)
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
        documents = [NSString
            pathWithComponents:@[ NSHomeDirectory(), @"Documents", [CoreBridge documentsName] ]];
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
