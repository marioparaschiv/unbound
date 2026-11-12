#import "AnimatedIcon.h"

#import <QuartzCore/QuartzCore.h>

NSString *const UBAnimatedIconId = @"UnboundAnimated";

static NSString *const      kInfoKey    = @"UnboundAnimatedIcon";
static NSString *const      kEnabledKey = @"UnboundAnimatedIconEnabled";
static const CFTimeInterval kTick       = 0.02;

static CFRunLoopTimerRef          gTimer;
static CFTimeInterval             gStart;
static NSInteger                  gShown = -1;
static BOOL                       gInFlight;
static UIBackgroundTaskIdentifier gTask = UIBackgroundTaskInvalid;

NSDictionary *UBAnimatedIconInfo(void)
{
    static NSDictionary   *info;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        NSString *path =
            [NSBundle.mainBundle.bundlePath stringByAppendingPathComponent:@"Info.plist"];
        NSDictionary *candidate = [NSDictionary dictionaryWithContentsOfFile:path][kInfoKey];
        NSArray      *frames    = candidate[@"Frames"];
        NSArray      *durations = candidate[@"Durations"];
        if ([candidate isKindOfClass:NSDictionary.class] && [frames isKindOfClass:NSArray.class] &&
            [durations isKindOfClass:NSArray.class] && frames.count > 0 &&
            frames.count == durations.count && [candidate[@"Rest"] isKindOfClass:NSString.class])
        {
            info = candidate;
        }
    });
    return info;
}

static BOOL animatedIconEnabled(void)
{
    return UBAnimatedIconInfo() && [NSUserDefaults.standardUserDefaults boolForKey:kEnabledKey];
}

static void setAnimatedIconEnabled(BOOL enabled)
{
    [NSUserDefaults.standardUserDefaults setBool:enabled forKey:kEnabledKey];
}

static NSInteger frameAt(NSArray<NSNumber *> *durations, CFTimeInterval elapsed)
{
    double total = 0;
    for (NSNumber *duration in durations)
    {
        total += duration.doubleValue / 1000.0;
    }
    double position = total > 0 ? fmod(elapsed, total) : 0;
    for (NSUInteger index = 0; index < durations.count; index++)
    {
        position -= durations[index].doubleValue / 1000.0;
        if (position < 0)
        {
            return (NSInteger) index;
        }
    }
    return (NSInteger) durations.count - 1;
}

static void showFrame(NSString *frame, NSInteger index, void (^done)(void))
{
    gInFlight = YES;
    SetAlternateIconName(frame, ^(NSError *error) {
        gInFlight = NO;
        if (!error)
        {
            gShown = index;
        }
        if (done)
        {
            done();
        }
    });
}

static void tick(void)
{
    NSDictionary *info = UBAnimatedIconInfo();
    if (gInFlight || !info)
    {
        return;
    }
    NSInteger index = frameAt(info[@"Durations"], CACurrentMediaTime() - gStart);
    if (index != gShown)
    {
        showFrame(info[@"Frames"][index], index, nil);
    }
}

static void endBackgroundTask(void)
{
    if (gTask != UIBackgroundTaskInvalid)
    {
        [UIApplication.sharedApplication endBackgroundTask:gTask];
        gTask = UIBackgroundTaskInvalid;
    }
}

static void stopAnimation(BOOL showRest, BOOL expiring)
{
    if (gTimer)
    {
        CFRunLoopTimerInvalidate(gTimer);
        CFRelease(gTimer);
        gTimer = NULL;
    }
    NSDictionary *info = UBAnimatedIconInfo();
    if (!showRest || !info)
    {
        endBackgroundTask();
        return;
    }
    gShown = -1;
    if (expiring)
    {
        showFrame(info[@"Rest"], -1, nil);
        endBackgroundTask();
        return;
    }
    showFrame(info[@"Rest"], -1, ^{ endBackgroundTask(); });
}

static void startAnimation(void)
{
    if (gTimer || !animatedIconEnabled())
    {
        return;
    }
    if (gTask == UIBackgroundTaskInvalid)
    {
        gTask = [UIApplication.sharedApplication
            beginBackgroundTaskWithName:@"UnboundAnimatedIcon"
                      expirationHandler:^{ stopAnimation(YES, YES); }];
    }
    gStart = CACurrentMediaTime();
    gShown = -1;
    gTimer = CFRunLoopTimerCreateWithHandler(kCFAllocatorDefault, CFAbsoluteTimeGetCurrent(), kTick,
                                             0, 0, ^(CFRunLoopTimerRef timer) { tick(); });
    CFRunLoopAddTimer(CFRunLoopGetMain(), gTimer, kCFRunLoopCommonModes);
    [Logger info:LOG_CATEGORY_DEFAULT
          format:@"Animating the app icon while Discord is in the background."];
}

%hook UIApplication

- (void)setAlternateIconName:(NSString *)iconName completionHandler:(void (^)(NSError *))completion
{
    NSDictionary *info = UBAnimatedIconInfo();
    if (info && [iconName isEqualToString:UBAnimatedIconId])
    {
        setAnimatedIconEnabled(YES);
        showFrame(info[@"Rest"], -1, ^{
            if (completion)
            {
                completion(nil);
            }
        });
        return;
    }
    if (animatedIconEnabled())
    {
        setAnimatedIconEnabled(NO);
        stopAnimation(NO, NO);
    }
    %orig(iconName, completion);
}

- (NSString *)alternateIconName
{
    return animatedIconEnabled() ? UBAnimatedIconId : %orig;
}

%end

%ctor
{
    %init();
    NSNotificationCenter *center = NSNotificationCenter.defaultCenter;
    [center addObserverForName:UIApplicationDidEnterBackgroundNotification
                        object:nil
                         queue:NSOperationQueue.mainQueue
                    usingBlock:^(NSNotification *note) { startAnimation(); }];
    [center addObserverForName:UIApplicationWillEnterForegroundNotification
                        object:nil
                         queue:NSOperationQueue.mainQueue
                    usingBlock:^(NSNotification *note) {
                        if (gTimer)
                        {
                            stopAnimation(YES, NO);
                        }
                    }];
}
