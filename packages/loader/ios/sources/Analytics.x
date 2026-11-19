#import "Analytics.h"

#import "MetricKitReports.h"
#import "SingleCopy.h"

// ATTrackingManagerAuthorizationStatusDenied: Discord and its SDKs see a user who declined.
static const NSUInteger kTrackingDenied = 2;

static NSError *attributionUnavailableError(void)
{
    return [NSError errorWithDomain:@"app.unbound.analytics"
                               code:1
                           userInfo:@{NSLocalizedDescriptionKey : @"Blocked by Unbound"}];
}

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

// App tracking transparency: never prompts, always reports tracking as denied.
%group TrackingTransparency

%hook ATTrackingManager

+ (NSUInteger)trackingAuthorizationStatus
{
    return kTrackingDenied;
}

+ (void)requestTrackingAuthorizationWithCompletionHandler:(void (^)(NSUInteger status))completion
{
    [Logger info:LOG_CATEGORY_DEFAULT format:@"Blocked the tracking prompt."];
    if (completion)
    {
        dispatch_async(dispatch_get_main_queue(), ^{ completion(kTrackingDenied); });
    }
}

%end

%end

// The advertising identifier: zeroed, as iOS does once tracking is denied.
%group AdvertisingIdentifier

%hook ASIdentifierManager

- (NSUUID *)advertisingIdentifier
{
    return [[NSUUID alloc] initWithUUIDString:@"00000000-0000-0000-0000-000000000000"];
}

- (BOOL)isAdvertisingTrackingEnabled
{
    return NO;
}

%end

%end

// Apple Search Ads attribution token.
%group SearchAdsAttribution

%hook AAAttribution

+ (NSString *)attributionTokenWithError:(NSError **)error
{
    [Logger info:LOG_CATEGORY_DEFAULT format:@"Blocked the ad attribution token."];
    if (error)
    {
        *error = attributionUnavailableError();
    }

    return nil;
}

%end

%end

// SKAdNetwork install attribution: nothing is registered or reported.
%group AdNetworkAttribution

%hook SKAdNetwork

+ (void)registerAppForAdNetworkAttribution {}

+ (void)updateConversionValue:(NSInteger)conversionValue {}

+ (void)updatePostbackConversionValue:(NSInteger)fineValue
                    completionHandler:(void (^)(NSError *error))completion
{
    if (completion)
    {
        completion(nil);
    }
}

+ (void)updatePostbackConversionValue:(NSInteger)fineValue
                          coarseValue:(NSString *)coarseValue
                    completionHandler:(void (^)(NSError *error))completion
{
    if (completion)
    {
        completion(nil);
    }
}

+ (void)updatePostbackConversionValue:(NSInteger)fineValue
                          coarseValue:(NSString *)coarseValue
                           lockWindow:(BOOL)lockWindow
                    completionHandler:(void (^)(NSError *error))completion
{
    if (completion)
    {
        completion(nil);
    }
}

%end

%end

// MetricKit: Discord's subscriber uploads payloads; only Unbound's local crash reports subscribe.
%group MetricKitSubscribers

%hook MXMetricManager

- (void)addSubscriber:(id)subscriber
{
    if (![subscriber isKindOfClass:MetricKitReports.class])
    {
        [Logger info:LOG_CATEGORY_DEFAULT format:@"Blocked a MetricKit subscriber."];
        return;
    }

    %orig;
}

%end

%end

%ctor
{
    if (UnboundIsDuplicateCopy())
    {
        return;
    }

    %init();

    // A group hooks a system class only once its framework is loaded; Discord links each of these.
    if (objc_getClass("ATTrackingManager"))
    {
        %init(TrackingTransparency);
    }

    if (objc_getClass("ASIdentifierManager"))
    {
        %init(AdvertisingIdentifier);
    }

    if (objc_getClass("AAAttribution"))
    {
        %init(SearchAdsAttribution);
    }

    if (objc_getClass("SKAdNetwork"))
    {
        %init(AdNetworkAttribution);
    }

    if (objc_getClass("MXMetricManager"))
    {
        %init(MetricKitSubscribers);
    }
}
