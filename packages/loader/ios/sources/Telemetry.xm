#import <Foundation/Foundation.h>

#import "CoreConversions.h"
#include "LoaderTelemetry.h"
#import "Logger.h"
#import "SettingsCore.h"

using unbound::ios::toStdString;

// Answers Discord's analytics requests locally with 204, a backstop to the client's tracking
// builtin for calls that run before it or around it.
@interface UBTelemetryProtocol : NSURLProtocol
@end

@implementation UBTelemetryProtocol

+ (BOOL)canInitWithRequest:(NSURLRequest *)request
{
    NSString *url = request.URL.absoluteString;
    return url && loader::isTelemetryURL(toStdString(url)) &&
           UnboundSettingsStore().getBoolean("unbound", loader::kBlockTelemetrySetting, true);
}

+ (NSURLRequest *)canonicalRequestForRequest:(NSURLRequest *)request
{
    return request;
}

- (void)startLoading
{
    [Logger debug:LOG_CATEGORY_DEFAULT format:@"Blocked %@.", self.request.URL.path];
    NSHTTPURLResponse *response = [[NSHTTPURLResponse alloc] initWithURL:self.request.URL
                                                              statusCode:204
                                                             HTTPVersion:@"HTTP/1.1"
                                                            headerFields:@{}];
    [self.client URLProtocol:self
          didReceiveResponse:response
          cacheStoragePolicy:NSURLCacheStorageNotAllowed];
    [self.client URLProtocolDidFinishLoading:self];
}

- (void)stopLoading
{
}

@end

static NSURLSessionConfiguration *withTelemetryProtocol(NSURLSessionConfiguration *configuration)
{
    NSArray *classes = configuration.protocolClasses ?: @[];
    if (![classes containsObject:UBTelemetryProtocol.class])
    {
        configuration.protocolClasses =
            [@[ UBTelemetryProtocol.class ] arrayByAddingObjectsFromArray:classes];
    }
    return configuration;
}

%hook NSURLSessionConfiguration

+ (NSURLSessionConfiguration *)defaultSessionConfiguration
{
    return withTelemetryProtocol(%orig);
}

+ (NSURLSessionConfiguration *)ephemeralSessionConfiguration
{
    return withTelemetryProtocol(%orig);
}

%end

%ctor
{
    [NSURLProtocol registerClass:UBTelemetryProtocol.class];
    %init;
}
