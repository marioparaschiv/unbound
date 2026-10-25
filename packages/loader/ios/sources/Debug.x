#import "Debug.h"

#ifdef DEBUG

static BOOL shouldIgnoreError(NSString *domain, NSInteger code, NSDictionary *info)
{
    static NSDictionary<NSString *, NSSet<NSNumber *> *> *ignored = nil;
    static dispatch_once_t                                onceToken;
    dispatch_once(&onceToken, ^{
        ignored = @{
            @"com.firebase.dynamicLinks" : [NSSet setWithObjects:@1, nil],
            @"com.apple.AppSSO.AuthorizationError" : [NSSet setWithObjects:@(-1000), nil],
            @"RCTJavaScriptLoaderErrorDomain" : [NSSet setWithObjects:@1000, nil],
            @"NSPOSIXErrorDomain" : [NSSet setWithObjects:@2, @17, @57, nil],
            @"kCFErrorDomainCFNetwork" : [NSSet setWithObjects:@(-1005), @(-1004), nil],
            @"BSActionErrorDomain" : [NSSet setWithObjects:@1, nil],
            @"BSServiceConnectionErrorDomain" : [NSSet setWithObjects:@1, nil],
            @"NSOSStatusErrorDomain" : [NSSet setWithObjects:@(-10813), nil],
            @"NSCocoaErrorDomain" : [NSSet setWithObjects:@258, @260, @516, @4864, @4, @4099, @3840, nil],
            @"com.appsflyer.sdk.network" : [NSSet setWithObjects:@50, nil],
            @"AVFoundationErrorDomain" : [NSSet setWithObjects:@(-11800), nil],
            @"kAFAssistantErrorDomain" : [NSSet setWithObjects:@400, @401, nil],
            @"com.apple.CoreHaptics" : [NSSet setWithObjects:@4099, nil],
            @"com.apple.Gestures" : [NSSet setWithObjects:@2, @4, nil],
            @"SDWebImageErrorDomain" : [NSSet setWithObjects:@1000, @2002, nil],
            @"LLVideoPlayerCacheTask" : [NSSet setWithObjects:@(-999), nil],
            @"NSURLErrorDomain" : [NSSet setWithObjects:@(-999), nil],
        };
    });

    NSSet<NSNumber *> *codes = ignored[domain];
    if (codes && [codes containsObject:@(code)])
    {
        return YES;
    }

    if ([domain isEqualToString:@"NSPOSIXErrorDomain"])
    {
        if (code == 22 && (!info || info.count == 0))
            return YES;
    }

    if ([domain isEqualToString:@"NSCocoaErrorDomain"])
    {
        if (code == 256)
        {
            id   underlying = info[@"NSUnderlyingError"];
            BOOL isPOSIX22  = NO;
            if ([underlying isKindOfClass:[NSError class]])
            {
                NSError *e = (NSError *) underlying;
                isPOSIX22  = [e.domain isEqualToString:@"NSPOSIXErrorDomain"] && e.code == 22;
            }
            else if ([underlying isKindOfClass:[NSString class]])
            {
                NSString *s = (NSString *) underlying;
                isPOSIX22 =
                    ([s containsString:@"NSPOSIXErrorDomain"] && [s containsString:@"Code=22"]);
            }

            NSString *path = [info objectForKey:@"NSFilePath"];
            NSURL    *url  = [info objectForKey:@"NSURL"];
            BOOL      isAppsFlyerPath =
                ([path isKindOfClass:NSString.class] && [path containsString:@"appsflyer-v1"]);
            BOOL isAppsFlyerURL = ([url isKindOfClass:NSURL.class] &&
                                   [[url absoluteString] containsString:@"appsflyer-v1"]);

            if (isPOSIX22 || isAppsFlyerPath || isAppsFlyerURL)
                return YES;
        }
    }

    if ([domain isEqualToString:@"com.apple.Gestures"])
    {
        NSString *desc = info[NSLocalizedDescriptionKey];
        if ((code == 7 && [desc isEqualToString:@"Custom"]) ||
            (code == 0 && [desc isEqualToString:@"Excluded"]))
            return YES;
    }

    if ([domain isEqualToString:@"_UIViewServiceErrorDomain"] && code == 1)
    {
        NSString *message = [info objectForKey:@"Message"];
        if ((message && [message containsString:@"StoreKitUIService"]) || info[@"Terminated"])
        {
            return YES;
        }
    }

    return NO;
}

%hook NSError
- (id)initWithDomain:(id)domain code:(int)code userInfo:(id)userInfo
{
    if (!shouldIgnoreError(domain, code, userInfo))
    {
        [Logger error:LOG_CATEGORY_DEFAULT format:@"NSError %@ (%d) %@", domain, code, userInfo];
    }
    return %orig;
}

+ (id)errorWithDomain:(id)domain code:(int)code userInfo:(id)userInfo
{
    if (!shouldIgnoreError(domain, code, userInfo))
    {
        [Logger error:LOG_CATEGORY_DEFAULT format:@"NSError %@ (%d) %@", domain, code, userInfo];
    }
    return %orig;
}
%end

static BOOL shouldIgnoreException(NSString *name)
{
    static NSSet<NSString *> *ignoredNames = nil;
    static dispatch_once_t    onceToken;
    dispatch_once(&onceToken, ^{
        ignoredNames = [NSSet setWithObjects:@"CHHapticErrorCodeServerInitFailedException", nil];
    });
    return [ignoredNames containsObject:name];
}

%hook NSException
- (id)initWithName:(id)name reason:(id)reason userInfo:(id)userInfo
{
    if (!shouldIgnoreException(name))
    {
        [Logger error:LOG_CATEGORY_DEFAULT format:@"NSException %@: %@ %@", name, reason, userInfo];
    }
    return %orig;
}

+ (id)exceptionWithName:(id)name reason:(id)reason userInfo:(id)userInfo
{
    if (!shouldIgnoreException(name))
    {
        [Logger error:LOG_CATEGORY_DEFAULT format:@"NSException %@: %@ %@", name, reason, userInfo];
    }
    return %orig;
}
%end

%ctor
{
    %init();
}

#endif
