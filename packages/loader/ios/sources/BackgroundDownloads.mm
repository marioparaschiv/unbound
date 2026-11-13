#import "BackgroundDownloads.h"

#import <UIKit/UIKit.h>
#include <objc/runtime.h>

#import "CoreConversions.h"
#include "LoaderBackgroundDownload.h"
#import "Logger.h"

using unbound::ios::toStdString;

static NSString *const kSessionIdentifier = @"app.unbound.bundle-download";

typedef void (*BackgroundEventsIMP)(id, SEL, UIApplication *, NSString *, void (^)(void));

static BackgroundEventsIMP originalBackgroundEvents = nullptr;

@interface                                  BackgroundDownloads () <NSURLSessionDownloadDelegate>
@property (nonatomic, strong) NSURLSession *session;
@property (nonatomic, copy) void (^eventsFinished)(void);
@end

static NSString *homeRelative(NSString *path)
{
    return [path stringByAbbreviatingWithTildeInPath];
}

static NSString *homeAbsolute(NSString *relative)
{
    return [relative stringByExpandingTildeInPath];
}

static NSData *resumeDataFor(NSURL *url, NSString *destination)
{
    NSString *resumePath = [destination stringByAppendingString:@".resume"];
    NSData   *data       = [NSData dataWithContentsOfFile:resumePath];
    [[NSFileManager defaultManager] removeItemAtPath:resumePath error:nil];
    if (!data)
    {
        return nil;
    }
    NSDictionary *saved = [NSPropertyListSerialization propertyListWithData:data
                                                                    options:0
                                                                     format:nil
                                                                      error:nil];
    id            savedURL =
        [saved isKindOfClass:NSDictionary.class] ? saved[@"NSURLSessionDownloadURL"] : nil;
    return [savedURL isKindOfClass:NSString.class] && [savedURL isEqualToString:url.absoluteString]
               ? data
               : nil;
}

static void handleBackgroundEvents(id delegate, SEL selector, UIApplication *application,
                                   NSString *identifier, void (^completion)(void))
{
    if ([identifier isEqualToString:kSessionIdentifier])
    {
        BackgroundDownloads.shared.eventsFinished = completion;
        return;
    }
    if (originalBackgroundEvents)
    {
        originalBackgroundEvents(delegate, selector, application, identifier, completion);
        return;
    }
    if (completion)
    {
        completion();
    }
}

@implementation BackgroundDownloads

+ (instancetype)shared
{
    static BackgroundDownloads *shared;
    static dispatch_once_t      once;
    dispatch_once(&once, ^{ shared = [BackgroundDownloads new]; });
    return shared;
}

+ (void)handleAppEvents
{
    Class delegateClass = objc_getClass("AppDelegate");
    if (!delegateClass)
    {
        [Logger warning:LOG_CATEGORY_UPDATER
                 format:@"Failed to find AppDelegate for background downloads"];
        return;
    }
    SEL selector = @selector(application:handleEventsForBackgroundURLSession:completionHandler:);
    const char *types = "v@:@@@?";
    if (!class_addMethod(delegateClass, selector, (IMP) handleBackgroundEvents, types))
    {
        Method method = class_getInstanceMethod(delegateClass, selector);
        originalBackgroundEvents =
            (BackgroundEventsIMP) method_setImplementation(method, (IMP) handleBackgroundEvents);
    }
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0),
                   ^{ [BackgroundDownloads shared]; });
}

- (instancetype)init
{
    if ((self = [super init]))
    {
        NSURLSessionConfiguration *configuration = [NSURLSessionConfiguration
            backgroundSessionConfigurationWithIdentifier:kSessionIdentifier];
        configuration.sessionSendsLaunchEvents   = YES;
        configuration.discretionary              = NO;
        configuration.requestCachePolicy         = NSURLRequestReloadIgnoringCacheData;
        NSOperationQueue *queue                  = [NSOperationQueue new];
        queue.maxConcurrentOperationCount        = 1;
        _session = [NSURLSession sessionWithConfiguration:configuration
                                                 delegate:self
                                            delegateQueue:queue];
    }
    return self;
}

- (void)continueDownload:(NSURL *)url
                      to:(NSString *)destination
                 headers:(NSDictionary<NSString *, NSString *> *)headers
{
    NSString *description = homeRelative(destination);
    NSData   *resumeData  = resumeDataFor(url, destination);
    [self.session getAllTasksWithCompletionHandler:^(NSArray<NSURLSessionTask *> *tasks) {
        for (NSURLSessionTask *task in tasks)
        {
            if (![task.taskDescription isEqualToString:description])
            {
                continue;
            }
            if ([task.originalRequest.URL isEqual:url] &&
                task.state == NSURLSessionTaskStateRunning)
            {
                return;
            }
            [task cancel];
        }
        NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
        request.cachePolicy          = NSURLRequestReloadIgnoringCacheData;
        for (NSString *header in headers)
        {
            [request setValue:headers[header] forHTTPHeaderField:header];
        }
        NSURLSessionDownloadTask *task = resumeData
                                             ? [self.session downloadTaskWithResumeData:resumeData]
                                             : [self.session downloadTaskWithRequest:request];
        task.taskDescription           = description;
        [task resume];
        [Logger info:LOG_CATEGORY_UPDATER
              format:@"Continuing the download of %@ in the background%@", url,
                     resumeData ? @" (resumed)" : @""];
    }];
}

- (void)URLSession:(NSURLSession *)session
                 downloadTask:(NSURLSessionDownloadTask *)task
    didFinishDownloadingToURL:(NSURL *)location
{
    NSInteger status = [(NSHTTPURLResponse *) task.response statusCode];
    NSString *url =
        task.originalRequest.URL.absoluteString ?: task.currentRequest.URL.absoluteString;
    if (!task.taskDescription || !url || (status != 200 && status != 206))
    {
        [Logger info:LOG_CATEGORY_UPDATER
              format:@"Background download of %@ ended with HTTP %ld", url, (long) status];
        return;
    }
    loader::finishBackgroundDownload(toStdString(url),
                                     toStdString(homeAbsolute(task.taskDescription)),
                                     toStdString(location.path));
}

- (void)URLSession:(NSURLSession *)session
                    task:(NSURLSessionTask *)task
    didCompleteWithError:(NSError *)error
{
    if (!error || error.code == NSURLErrorCancelled)
    {
        return;
    }
    [Logger warning:LOG_CATEGORY_UPDATER
             format:@"Failed to download %@ in the background: %@ %ld", task.originalRequest.URL,
                    error.domain, (long) error.code];
    NSData *partial = error.userInfo[NSURLSessionDownloadTaskResumeData];
    if (partial && task.taskDescription)
    {
        [partial writeToFile:[homeAbsolute(task.taskDescription) stringByAppendingString:@".resume"]
                  atomically:YES];
    }
}

- (void)URLSessionDidFinishEventsForBackgroundURLSession:(NSURLSession *)session
{
    void (^completion)(void) = self.eventsFinished;
    self.eventsFinished      = nil;
    if (completion)
    {
        dispatch_async(dispatch_get_main_queue(), completion);
    }
}

@end
