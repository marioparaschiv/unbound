#import "CoreBridge.h"
#include <istream>
#include <ostream>
#include <streambuf>

#import "HotReload.h"
#import "UpdaterCore.h"

#include <memory>

#include "LoaderHotReload.h"

@implementation HotReload
{
    dispatch_queue_t      _queue;
    NSURLSession         *_session;
    NSURLSessionDataTask *_task;
    NSURL                *_url;
    std::unique_ptr<loader::HotReloadStream> _stream;
    loader::HotReloadBackoff                 _backoff;
    BOOL                  _running;
    uint64_t              _generation;
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
        HotReload *shared = [HotReload shared];

        [[NSNotificationCenter defaultCenter] addObserver:shared
                                                 selector:@selector(sync)
                                                     name:SettingsDidChangeNotification
                                                   object:nil];

        [shared sync];
    });
}

+ (void)sync
{
    [[HotReload shared] sync];
}

- (instancetype)init
{
    if ((self = [super init]))
    {
        _queue          = dispatch_queue_create("app.unbound.hotreload", DISPATCH_QUEUE_SERIAL);
        _stream = std::make_unique<loader::HotReloadStream>(UnboundUpdaterSettings());
    }

    return self;
}

- (void)sync
{
    BOOL enabled = [CoreBridge preferenceEnabled:@"hot-reload"];

    dispatch_async(_queue, ^{
        if (enabled && !self->_running)
        {
            [self start];
        }
        else if (!enabled && self->_running)
        {
            [self stop];
        }
    });
}

- (void)start
{
    if (_running)
    {
        return;
    }

    _url = [self resolveHotURL];
    if (!_url)
    {
        [Logger info:LOG_CATEGORY_UPDATER
              format:@"Hot-reload: no dev server origin resolved; live reload not started."];
        return;
    }

    _running = YES;
    _backoff.reset();

    NSURLSessionConfiguration *config = [NSURLSessionConfiguration defaultSessionConfiguration];

    config.timeoutIntervalForRequest  = 86400.0;
    config.timeoutIntervalForResource = DBL_MAX;
    config.HTTPAdditionalHeaders      = @{
        @"Accept" : @"text/event-stream",
        @"Cache-Control" : @"no-cache",
    };

    NSOperationQueue *delegateQueue           = [[NSOperationQueue alloc] init];
    delegateQueue.underlyingQueue             = _queue;
    delegateQueue.maxConcurrentOperationCount = 1;

    _session = [NSURLSession sessionWithConfiguration:config
                                             delegate:self
                                        delegateQueue:delegateQueue];

    [Logger info:LOG_CATEGORY_UPDATER format:@"Hot-reload: enabled."];
    [self connect];
}

- (void)stop
{
    if (!_running)
    {
        return;
    }

    _running = NO;
    _generation++;

    [_task cancel];
    _task = nil;

    [_session invalidateAndCancel];
    _session = nil;

    _stream->reset();

    [Logger info:LOG_CATEGORY_UPDATER format:@"Hot-reload: disabled; stream stopped."];
}

- (NSURL *)resolveHotURL
{
    NSString *base = [Updater resolveUpdateURL];
    if (base.length == 0)
    {
        return nil;
    }

    std::optional<std::string> url = loader::hotReloadURL(base.UTF8String ?: "");
    return url ? [NSURL URLWithString:[NSString stringWithUTF8String:url->c_str()]] : nil;
}

- (void)connect
{
    if (!_running || !_session)
    {
        return;
    }

    _stream->reset();

    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:_url];
    request.cachePolicy          = NSURLRequestReloadIgnoringCacheData;

    [Logger info:LOG_CATEGORY_UPDATER format:@"Hot-reload: connecting SSE to %@", _url];

    _task = [_session dataTaskWithRequest:request];
    [_task resume];
}

- (void)scheduleReconnect
{
    if (!_running)
    {
        return;
    }

    NSTimeInterval delay      = _backoff.next();
    uint64_t       generation = _generation;

    [Logger info:LOG_CATEGORY_UPDATER format:@"Hot-reload: reconnecting in %.0fs.", delay];

    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t) (delay * NSEC_PER_SEC)), _queue, ^{
        if (!self->_running || self->_generation != generation)
        {
            return;
        }
        [self connect];
    });
}

#pragma mark - NSURLSessionDataDelegate

- (void)URLSession:(NSURLSession *)session
              dataTask:(NSURLSessionDataTask *)dataTask
    didReceiveResponse:(NSURLResponse *)response
     completionHandler:(void (^)(NSURLSessionResponseDisposition))completionHandler
{
    NSInteger status = [(NSHTTPURLResponse *) response statusCode];

    if (status == 200)
    {
        _backoff.reset();
        [Logger info:LOG_CATEGORY_UPDATER format:@"Hot-reload: SSE connected."];
        completionHandler(NSURLSessionResponseAllow);
    }
    else
    {
        completionHandler(NSURLSessionResponseCancel);
    }
}

- (void)URLSession:(NSURLSession *)session
          dataTask:(NSURLSessionDataTask *)dataTask
    didReceiveData:(NSData *)data
{
    std::string_view chunk(static_cast<const char *>(data.bytes), data.length);
    if (_stream->feed(chunk))
    {
        [Utilities reloadApp];
    }
}

- (void)URLSession:(NSURLSession *)session
                    task:(NSURLSessionTask *)task
    didCompleteWithError:(NSError *)error
{
    if (!_running)
    {
        return;
    }

    if (error)
    {
        [Logger info:LOG_CATEGORY_UPDATER
              format:@"Hot-reload: SSE disconnected (%@).", error.localizedDescription];
    }
    else
    {
        [Logger info:LOG_CATEGORY_UPDATER format:@"Hot-reload: SSE stream closed."];
    }

    [self scheduleReconnect];
}

@end
