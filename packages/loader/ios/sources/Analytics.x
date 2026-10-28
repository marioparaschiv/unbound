#import "Analytics.h"

%hook SentrySDKInternal
+ (void)startWithOptions:(id)options
{
    [Logger info:LOG_CATEGORY_DEFAULT format:@"Blocked SentrySDK."];
    return;
}

+ (void)startWithConfigureOptions:(id)callback
{
    [Logger info:LOG_CATEGORY_DEFAULT format:@"Blocked SentrySDK."];
    return;
}

+ (BOOL)isEnabled
{
    return NO;
}
%end

%hook AppsFlyerLib
- (BOOL)isStopped
{
    return YES;
}

- (void)setIsStopped:(BOOL)stopped
{
    %orig(YES);
}

- (void)setAppsFlyerDevKey:(NSString *)key {}

- (void)start
{
    [Logger info:LOG_CATEGORY_DEFAULT format:@"Blocked AppsFlyer."];
}

- (void)startWithCompletionHandler:(void (^)(NSDictionary *, NSError *))completionHandler
{
    [Logger info:LOG_CATEGORY_DEFAULT format:@"Blocked AppsFlyer."];
    if (completionHandler)
    {
        completionHandler(nil, nil);
    }
}
%end

%ctor
{
    %init();
}
