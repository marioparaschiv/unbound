#import "HotReload.h"

#include <istream>
#include <memory>
#include <ostream>
#include <streambuf>

#import "AddonsCore.h"
#include "LoaderHotReload.h"
#import "SettingsCore.h"

@interface HotReload ()
- (void)openRequest:(const loader::HotReloadRequest &)request;
- (void)cancelTask;
@end

class IOSHotReloadTransport final : public loader::HotReloadTransport
{
public:
    explicit IOSHotReloadTransport(HotReload *owner) : owner_(owner) {}

    void open(const loader::HotReloadRequest &request) override
    {
        [owner_ openRequest:request];
    }

    void cancel() override
    {
        [owner_ cancelTask];
    }

private:
    __weak HotReload *owner_;
};

std::shared_ptr<loader::HotReloadTransport> UnboundHotReloadTransport()
{
    return std::make_shared<IOSHotReloadTransport>([HotReload shared]);
}

// Empty only while the loader starts, as it asks for the transport before making the controller.
static std::shared_ptr<loader::HotReloadController> controller()
{
    return UnboundLoader()->hotReload();
}

static uint64_t connectionOf(NSURLSessionTask *task)
{
    return strtoull(task.taskDescription.UTF8String ?: "0", nullptr, 10);
}

@implementation HotReload
{
    dispatch_queue_t      _queue;
    NSURLSession         *_session;
    NSURLSessionDataTask *_task;
}

+ (instancetype)shared
{
    static HotReload      *shared = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{ shared = [[HotReload alloc] init]; });
    return shared;
}

+ (void)observe
{
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        [[NSNotificationCenter defaultCenter] addObserver:[HotReload shared]
                                                 selector:@selector(sync)
                                                     name:SettingsDidChangeNotification
                                                   object:nil];
    });

    [HotReload sync];
}

+ (void)sync
{
    [[HotReload shared] sync];
}

- (instancetype)init
{
    if ((self = [super init]))
    {
        _queue = dispatch_queue_create("app.unbound.hotreload", DISPATCH_QUEUE_SERIAL);

        NSOperationQueue *delegateQueue           = [[NSOperationQueue alloc] init];
        delegateQueue.underlyingQueue             = _queue;
        delegateQueue.maxConcurrentOperationCount = 1;

        NSURLSessionConfiguration *config = [NSURLSessionConfiguration defaultSessionConfiguration];
        config.timeoutIntervalForResource = DBL_MAX;

        _session = [NSURLSession sessionWithConfiguration:config
                                                 delegate:self
                                            delegateQueue:delegateQueue];
    }

    return self;
}

- (void)sync
{
    if (auto hotReload = controller())
    {
        hotReload->sync();
    }
}

- (void)openRequest:(const loader::HotReloadRequest &)request
{
    NSURL *url = [NSURL URLWithString:@(request.url.c_str())];
    if (!url)
    {
        if (auto hotReload = controller())
        {
            hotReload->onClosed(request.connection, std::string("invalid URL"));
        }
        return;
    }

    NSMutableURLRequest *urlRequest =
        [NSMutableURLRequest requestWithURL:url
                                cachePolicy:NSURLRequestReloadIgnoringCacheData
                            timeoutInterval:request.readTimeoutSeconds];
    for (const auto &[name, value] : request.headers)
    {
        [urlRequest setValue:@(value.c_str()) forHTTPHeaderField:@(name.c_str())];
    }

    _task = [_session dataTaskWithRequest:urlRequest];
    _task.taskDescription =
        [NSString stringWithFormat:@"%llu", (unsigned long long) request.connection];
    [_task resume];
}

- (void)cancelTask
{
    [_task cancel];
    _task = nil;
}

#pragma mark - NSURLSessionDataDelegate

- (void)URLSession:(NSURLSession *)session
              dataTask:(NSURLSessionDataTask *)dataTask
    didReceiveResponse:(NSURLResponse *)response
     completionHandler:(void (^)(NSURLSessionResponseDisposition))completionHandler
{
    NSInteger status    = [response isKindOfClass:[NSHTTPURLResponse class]]
                              ? [(NSHTTPURLResponse *) response statusCode]
                              : 0;
    auto      hotReload = controller();
    completionHandler(
        hotReload && hotReload->onResponse(connectionOf(dataTask), static_cast<int>(status))
            ? NSURLSessionResponseAllow
            : NSURLSessionResponseCancel);
}

- (void)URLSession:(NSURLSession *)session
          dataTask:(NSURLSessionDataTask *)dataTask
    didReceiveData:(NSData *)data
{
    std::string_view chunk(static_cast<const char *>(data.bytes), data.length);
    auto             hotReload = controller();
    if (!hotReload || !hotReload->onChunk(connectionOf(dataTask), chunk))
    {
        [dataTask cancel];
    }
}

- (void)URLSession:(NSURLSession *)session
                    task:(NSURLSessionTask *)task
    didCompleteWithError:(NSError *)error
{
    if (_task == task)
    {
        _task = nil;
    }

    if (auto hotReload = controller())
    {
        hotReload->onClosed(
            connectionOf(task),
            error ? std::optional<std::string>(error.localizedDescription.UTF8String ?: "")
                  : std::nullopt);
    }
}

@end
