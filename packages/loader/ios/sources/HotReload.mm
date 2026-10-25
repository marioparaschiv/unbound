#include <istream>
#include <ostream>
#include <streambuf>

#import "HotReload.h"
#import "SettingsCore.h"
#import "UpdaterCore.h"

#include <memory>

#include "LoaderHotReload.h"

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

static uint64_t connectionOf(NSURLSessionTask *task)
{
    return strtoull(task.taskDescription.UTF8String ?: "0", nullptr, 10);
}

@implementation HotReload
{
    dispatch_queue_t                             _queue;
    NSURLSession                                *_session;
    NSURLSessionDataTask                        *_task;
    std::shared_ptr<loader::HotReloadController> _controller;
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

        dispatch_queue_t queue = _queue;
        _controller            = std::make_shared<loader::HotReloadController>(
            UnboundSettingsStore(), [] { return UnboundUpdateURL(); },
            std::make_shared<IOSHotReloadTransport>(self),
            [queue](double seconds, std::function<void()> work) {
                auto task = std::make_shared<std::function<void()>>(std::move(work));
                dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t) (seconds * NSEC_PER_SEC)), queue,
                               ^{ (*task)(); });
            },
            [] { [Utilities reloadApp]; });
    }

    return self;
}

- (void)sync
{
    _controller->sync();
}

- (void)openRequest:(const loader::HotReloadRequest &)request
{
    NSURL *url = [NSURL URLWithString:@(request.url.c_str())];
    if (!url)
    {
        _controller->onClosed(request.connection, std::string("invalid URL"));
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

    _task                 = [_session dataTaskWithRequest:urlRequest];
    _task.taskDescription = [NSString stringWithFormat:@"%llu", (unsigned long long) request.connection];
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
    NSInteger status = [response isKindOfClass:[NSHTTPURLResponse class]]
                           ? [(NSHTTPURLResponse *) response statusCode]
                           : 0;
    completionHandler(_controller->onResponse(connectionOf(dataTask), static_cast<int>(status))
                          ? NSURLSessionResponseAllow
                          : NSURLSessionResponseCancel);
}

- (void)URLSession:(NSURLSession *)session
          dataTask:(NSURLSessionDataTask *)dataTask
    didReceiveData:(NSData *)data
{
    std::string_view chunk(static_cast<const char *>(data.bytes), data.length);
    if (!_controller->onChunk(connectionOf(dataTask), chunk))
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

    _controller->onClosed(connectionOf(task),
                          error ? std::optional<std::string>(error.localizedDescription.UTF8String ?: "")
                                : std::nullopt);
}

@end
