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

%ctor
{
    %init();
}
