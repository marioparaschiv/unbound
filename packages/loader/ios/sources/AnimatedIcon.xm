#import "AnimatedIcon.h"

#import <notify.h>

#import "AnimatedIconPlayer.h"
#include "LoaderAppIcon.h"
#import "SingleCopy.h"

NSString *const UBAnimatedIconId = @"UnboundAnimated";

static NSString *const kIconErrorDomain    = @"app.unbound.icon";
static const char *kChangedNotification    = "app.unbound.animated-icon.changed";
static const int64_t kQueuedPickTimeoutSec = 30;

static loader::appicon::IconChangeQueue gQueue;
static uint64_t gNextPick;
static int gStartingPicks;
static NSString *gLastError;
static NSMutableDictionary<NSNumber *, dispatch_block_t> *gQueuedStarts;
static NSMutableDictionary<NSNumber *, UBIconCompletion> *gQueuedCompletions;

static void rememberError(NSError *error)
{
    NSString *message = error.localizedDescription;
    @synchronized(kIconErrorDomain)
    {
        gLastError = [message hasPrefix:@"Unbound: "] ? [message substringFromIndex:9] : message;
    }
}

static NSError *iconError(NSInteger code, NSString *description, NSError *underlying)
{
    NSMutableDictionary *info = [@{NSLocalizedDescriptionKey : description} mutableCopy];
    if (underlying)
    {
        info[NSUnderlyingErrorKey] = underlying;
    }

    return [NSError errorWithDomain:kIconErrorDomain code:code userInfo:info];
}

static NSError *busyError(NSError *underlying)
{
    return iconError(
        EAGAIN,
        @"Unbound: iOS is still waiting for you to confirm an earlier icon change. Tap "
        @"OK on that notice, or restart your iPhone if none is showing, then pick the "
        @"icon again.",
        underlying);
}

static NSError *describedError(NSError *error, NSString *iconName)
{
    if (!UBIconChangeIsBusy(error))
    {
        return error;
    }

    [Logger warning:LOG_CATEGORY_DEFAULT
             format:@"iOS refused the icon change %@: an earlier change is still waiting for "
                    @"confirmation.",
                    iconName ?: @"<primary>"];
    return busyError(error);
}

static void performIconChange(NSString *iconName, UBIconCompletion completion, UBIconSetter setIcon)
{
    if (UBAnimatedIconInfo() && [iconName isEqualToString:UBAnimatedIconId])
    {
        UBSetAnimatedIconEnabled(YES);
        UBShowAnimatedIconRest(^(NSError *error) {
            if (error)
            {
                UBSetAnimatedIconEnabled(NO);
            }

            notify_post(kChangedNotification);
            completion(error);
        });
        return;
    }

    if (UBAnimatedIconEnabled())
    {
        UBSetAnimatedIconEnabled(NO);
        UBStopAnimatedIcon();
        UBIconCompletion original = completion;
        completion                = ^(NSError *error) {
            notify_post(kChangedNotification);
            original(error);
        };
    }

    setIcon(iconName, completion);
}

static void startNextQueuedPick(void)
{
    std::optional<uint64_t> next = gQueue.finish();
    if (!next)
    {
        return;
    }

    NSNumber *key          = @(*next);
    dispatch_block_t start = gQueuedStarts[key];
    [gQueuedStarts removeObjectForKey:key];
    [gQueuedCompletions removeObjectForKey:key];
    if (start)
    {
        start();
    }
}

NSString *UBTakeAppIconError(void)
{
    @synchronized(kIconErrorDomain)
    {
        NSString *error = gLastError;
        gLastError      = nil;
        return error;
    }
}

static void failQueuedPick(uint64_t pick, NSError *error)
{
    rememberError(error);
    NSNumber *key               = @(pick);
    UBIconCompletion completion = gQueuedCompletions[key];
    [gQueuedStarts removeObjectForKey:key];
    [gQueuedCompletions removeObjectForKey:key];
    if (completion)
    {
        completion(error);
    }
}

void UBSetAppIcon(NSString *iconName, UBIconCompletion requested, UBIconSetter setIcon)
{
    if (gStartingPicks > 0)
    {
        setIcon(iconName, requested);
        return;
    }

    gQueuedStarts      = gQueuedStarts ?: [NSMutableDictionary dictionary];
    gQueuedCompletions = gQueuedCompletions ?: [NSMutableDictionary dictionary];

    uint64_t pick               = ++gNextPick;
    UBIconCompletion completion = ^(NSError *error) {
        NSError *described = describedError(error, iconName);
        if ([described.domain isEqualToString:kIconErrorDomain])
        {
            rememberError(described);
        }

        if (requested)
        {
            requested(described);
        }

        startNextQueuedPick();
    };
    dispatch_block_t start = ^{
        gStartingPicks++;
        performIconChange(iconName, completion, setIcon);
        gStartingPicks--;
    };

    loader::appicon::IconRequest request = gQueue.request(pick);
    if (request.superseded)
    {
        failQueuedPick(*request.superseded,
                       iconError(ECANCELED,
                                 @"Unbound: You picked another icon before this one was applied.",
                                 nil));
    }

    if (request.startNow)
    {
        start();
        return;
    }

    [Logger info:LOG_CATEGORY_DEFAULT
          format:@"Queued the icon change %@ behind one iOS is still applying.",
                 iconName ?: @"<primary>"];
    gQueuedStarts[@(pick)]      = start;
    gQueuedCompletions[@(pick)] = requested ?: ^(NSError *error) {};
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, kQueuedPickTimeoutSec * NSEC_PER_SEC),
                   dispatch_get_main_queue(), ^{
                       if (gQueue.cancel(pick))
                       {
                           failQueuedPick(pick, busyError(nil));
                       }
                   });
}

%hook UIApplication

- (void)setAlternateIconName:(NSString *)iconName completionHandler:(void (^)(NSError *))completion
{
    UBSetAppIcon(iconName, completion,
                 ^(NSString *name, UBIconCompletion done) { %orig(name, done); });
}

- (NSString *)alternateIconName
{
    return UBAnimatedIconEnabled() ? UBAnimatedIconId : %orig;
}

%end

%ctor
{
    if (UnboundIsDuplicateCopy())
    {
        return;
    }

    %init();
}
