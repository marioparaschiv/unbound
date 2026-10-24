#import "HotReload.h"

static const NSTimeInterval kReconnectMinDelay = 1.0;
static const NSTimeInterval kReconnectMaxDelay = 30.0;

@implementation HotReload
{
    dispatch_queue_t      _queue;
    NSURLSession         *_session;
    NSURLSessionDataTask *_task;
    NSURL                *_url;
    NSMutableData        *_buffer;
    NSTimeInterval        _reconnectDelay;
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
        _buffer         = [NSMutableData data];
        _reconnectDelay = kReconnectMinDelay;
    }

    return self;
}

- (void)sync
{
    BOOL enabled = [Settings getBoolean:@"unbound" key:@"loader.update.hmr" def:NO];

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

    _running        = YES;
    _reconnectDelay = kReconnectMinDelay;

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

    [_buffer setLength:0];

    [Logger info:LOG_CATEGORY_UPDATER format:@"Hot-reload: disabled; stream stopped."];
}

- (NSURL *)resolveHotURL
{
    NSString *base = [Updater resolveUpdateURL];
    if (base.length == 0)
    {
        return nil;
    }

    NSURLComponents *components = [NSURLComponents componentsWithString:base];
    if (!components.scheme || !components.host)
    {
        return nil;
    }

    NSURLComponents *origin = [[NSURLComponents alloc] init];
    origin.scheme           = components.scheme;
    origin.host             = components.host;
    origin.port             = components.port;
    origin.path             = @"/__hot";

    return origin.URL;
}

- (void)connect
{
    if (!_running || !_session)
    {
        return;
    }

    [_buffer setLength:0];

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

    NSTimeInterval delay = _reconnectDelay;
    _reconnectDelay      = MIN(_reconnectDelay * 2.0, kReconnectMaxDelay);
    uint64_t generation  = _generation;

    [Logger info:LOG_CATEGORY_UPDATER format:@"Hot-reload: reconnecting in %.0fs.", delay];

    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t) (delay * NSEC_PER_SEC)), _queue, ^{
        if (!self->_running || self->_generation != generation)
        {
            return;
        }
        [self connect];
    });
}

#pragma mark - SSE parsing

- (void)drainBuffer
{
    NSData *separator = [@"\n\n" dataUsingEncoding:NSUTF8StringEncoding];

    while (YES)
    {
        NSRange range = [_buffer rangeOfData:separator
                                     options:0
                                       range:NSMakeRange(0, _buffer.length)];
        if (range.location == NSNotFound)
        {
            break;
        }

        NSData   *eventData = [_buffer subdataWithRange:NSMakeRange(0, range.location)];
        NSString *event = [[NSString alloc] initWithData:eventData encoding:NSUTF8StringEncoding];

        [_buffer replaceBytesInRange:NSMakeRange(0, range.location + range.length)
                           withBytes:NULL
                              length:0];

        if (event.length)
        {
            [self handleEvent:event];
        }
    }
}

- (void)handleEvent:(NSString *)event
{
    NSString *eventName = nil;
    NSString *eventData = nil;

    for (NSString *line in [event componentsSeparatedByString:@"\n"])
    {
        if (line.length == 0 || [line hasPrefix:@":"])
        {
            continue;
        }

        if ([line hasPrefix:@"event:"])
        {
            eventName = [[line substringFromIndex:6]
                stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]];
        }
        else if ([line hasPrefix:@"data:"])
        {
            eventData = [[line substringFromIndex:5]
                stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]];
        }
    }

    if (![eventName isEqualToString:@"reload"] || eventData.length == 0)
    {
        return;
    }

    NSData *json    = [eventData dataUsingEncoding:NSUTF8StringEncoding];
    id      payload = [Utilities parseJSON:json];

    if (![payload isKindOfClass:[NSDictionary class]])
    {
        return;
    }

    NSString *incoming = payload[@"etag"];
    if (![incoming isKindOfClass:[NSString class]])
    {
        return;
    }

    [self handleReloadEtag:incoming];
}

static NSString *normalizedEtag(NSString *etag)
{
    NSString *value = [etag hasPrefix:@"W/"] ? [etag substringFromIndex:2] : etag;
    return [value stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"\""]];
}

- (void)handleReloadEtag:(NSString *)incoming
{
    NSString *stored = [Settings getString:@"unbound" key:@"loader.update.etag" def:@""];

    if (stored.length > 0 && [normalizedEtag(stored) isEqualToString:normalizedEtag(incoming)])
    {
        [Logger info:LOG_CATEGORY_UPDATER
              format:@"Hot-reload: etag unchanged (%@); skipping reload.", incoming];
        return;
    }

    [Logger info:LOG_CATEGORY_UPDATER
          format:@"Hot-reload: etag mismatch (stored %@, incoming %@) -> reloadApp.",
                 stored.length ? stored : @"<none>", incoming];

    [Utilities reloadApp];
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
        _reconnectDelay = kReconnectMinDelay;
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
    [_buffer appendData:data];
    [self drainBuffer];
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
