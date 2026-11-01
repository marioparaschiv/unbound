#import <Foundation/Foundation.h>

#import "Logger.h"
#import "SettingsCore.h"

static BOOL isDiscordUpdateManifest(NSURL *url)
{
    NSString *text = url.absoluteString;
    return [text containsString:@"discord.com/ios/"] && [text hasSuffix:@"/manifest.json"];
}

static BOOL skipsDiscordUpdateCheck(NSURLRequest *request)
{
    return isDiscordUpdateManifest(request.URL) &&
           !UnboundSettingsStore().getBoolean("unbound", "loader.discordUpdateCheck", true);
}

@interface DiscordUpdateCheckSkipper : NSURLProtocol
@end

@implementation DiscordUpdateCheckSkipper

+ (BOOL)canInitWithRequest:(NSURLRequest *)request
{
    return skipsDiscordUpdateCheck(request);
}

+ (NSURLRequest *)canonicalRequestForRequest:(NSURLRequest *)request
{
    return request;
}

- (void)startLoading
{
    [Logger info:LOG_CATEGORY_DEFAULT format:@"Skipped Discord's update check."];
    NSHTTPURLResponse *response =
        [[NSHTTPURLResponse alloc] initWithURL:self.request.URL
                                    statusCode:404
                                   HTTPVersion:@"HTTP/1.1"
                                  headerFields:@{@"Content-Length" : @"0"}];
    [self.client URLProtocol:self
          didReceiveResponse:response
          cacheStoragePolicy:NSURLCacheStorageNotAllowed];
    [self.client URLProtocolDidFinishLoading:self];
}

- (void)stopLoading
{
}

@end

static NSURLSessionConfiguration *withUpdateCheckSkipper(NSURLSessionConfiguration *configuration)
{
    if (!configuration ||
        [configuration.protocolClasses containsObject:[DiscordUpdateCheckSkipper class]])
    {
        return configuration;
    }
    NSURLSessionConfiguration *copy = [configuration copy];
    copy.protocolClasses            = [@[ [DiscordUpdateCheckSkipper class] ]
        arrayByAddingObjectsFromArray:configuration.protocolClasses ?: @[]];
    return copy;
}

%hook NSURLSession

+ (NSURLSession *)sessionWithConfiguration:(NSURLSessionConfiguration *)configuration
{
    return %orig(withUpdateCheckSkipper(configuration));
}

+ (NSURLSession *)sessionWithConfiguration:(NSURLSessionConfiguration *)configuration
                                  delegate:(id<NSURLSessionDelegate>)delegate
                             delegateQueue:(NSOperationQueue *)queue
{
    return %orig(withUpdateCheckSkipper(configuration), delegate, queue);
}

%end

%ctor
{
    [NSURLProtocol registerClass:[DiscordUpdateCheckSkipper class]];
    %init();
}
