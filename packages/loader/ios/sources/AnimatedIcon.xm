#import "AnimatedIcon.h"

#import <AVFoundation/AVFoundation.h>
#import <QuartzCore/QuartzCore.h>
#import <notify.h>
#import <unistd.h>

NSString *const UBAnimatedIconId = @"UnboundAnimated";

static NSString *const      kInfoKey             = @"UnboundAnimatedIcon";
static NSString *const      kEnabledKey          = @"UnboundAnimatedIconEnabled";
static const char          *kChangedNotification = "app.unbound.animated-icon.changed";
static const CFTimeInterval kTick                = 0.02;
static const double         kSilenceSeconds      = 1.0;
static const int            kSampleRate          = 8000;

static CFRunLoopTimerRef             gTimer;
static CFTimeInterval                gStart;
static NSInteger                     gShown = -1;
static BOOL                          gInFlight;
static CFTimeInterval                gInFlightSince;
static const CFTimeInterval          kStuckRequest = 1.0;
static BOOL                          gBackgrounded;
static BOOL                          gLocked;
static UIBackgroundTaskIdentifier    gTask = UIBackgroundTaskInvalid;
static AVAudioPlayer                *gSilence;
static NSString                     *gRestoreCategory;
static AVAudioSessionCategoryOptions gRestoreOptions;

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

static BOOL springBoardAnimates(void)
{
    for (NSString *path in @[
             @"/var/jb/Library/MobileSubstrate/DynamicLibraries/UnboundSpringBoard.dylib",
             @"/var/jb/usr/lib/TweakInject/UnboundSpringBoard.dylib",
             @"/Library/MobileSubstrate/DynamicLibraries/UnboundSpringBoard.dylib"
         ])
    {
        if (access(path.fileSystemRepresentation, F_OK) == 0)
        {
            return YES;
        }
    }
    return NO;
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
    gInFlight      = YES;
    gInFlightSince = CACurrentMediaTime();
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
    if (gInFlight && CACurrentMediaTime() - gInFlightSince > kStuckRequest)
    {
        [Logger warning:LOG_CATEGORY_DEFAULT
                 format:@"An animated icon frame got no answer; trying the next one."];
        gInFlight = NO;
    }
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

static NSData *silentWave(void)
{
    uint32_t       samples  = (uint32_t) (kSampleRate * kSilenceSeconds);
    uint32_t       bytes    = samples * 2;
    NSMutableData *data     = [NSMutableData dataWithCapacity:44 + bytes];
    uint32_t       riff     = 36 + bytes;
    uint32_t       fmtSize  = 16;
    uint16_t       format   = 1;
    uint16_t       mono     = 1;
    uint32_t       rate     = kSampleRate;
    uint32_t       byteRate = kSampleRate * 2;
    uint16_t       align    = 2;
    uint16_t       depth    = 16;
    [data appendBytes:"RIFF" length:4];
    [data appendBytes:&riff length:4];
    [data appendBytes:"WAVEfmt " length:8];
    [data appendBytes:&fmtSize length:4];
    [data appendBytes:&format length:2];
    [data appendBytes:&mono length:2];
    [data appendBytes:&rate length:4];
    [data appendBytes:&byteRate length:4];
    [data appendBytes:&align length:2];
    [data appendBytes:&depth length:2];
    [data appendBytes:"data" length:4];
    [data appendBytes:&bytes length:4];
    [data increaseLengthBy:bytes];
    return data;
}

static void startKeepAlive(void)
{
    if (gSilence.isPlaying)
    {
        return;
    }
    AVAudioSession *session = AVAudioSession.sharedInstance;
    if ([session.category isEqualToString:AVAudioSessionCategorySoloAmbient])
    {
        gRestoreCategory = session.category;
        gRestoreOptions  = session.categoryOptions;
        NSError *error;
        if (![session setCategory:AVAudioSessionCategoryPlayback
                      withOptions:AVAudioSessionCategoryOptionMixWithOthers
                            error:&error] ||
            ![session setActive:YES error:&error])
        {
            [Logger error:LOG_CATEGORY_DEFAULT
                   format:@"Failed to start the animated icon's audio session: %@", error];
            return;
        }
    }
    gSilence = gSilence ?: [[AVAudioPlayer alloc] initWithData:silentWave() error:nil];
    gSilence.numberOfLoops = -1;
    [gSilence play];
}

static void stopKeepAlive(void)
{
    [gSilence stop];
    if (!gRestoreCategory)
    {
        return;
    }
    AVAudioSession *session = AVAudioSession.sharedInstance;
    [session setActive:NO
           withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation
                 error:nil];
    [session setCategory:gRestoreCategory withOptions:gRestoreOptions error:nil];
    gRestoreCategory = nil;
}

static void endBackgroundTask(void)
{
    if (gTask != UIBackgroundTaskInvalid)
    {
        [UIApplication.sharedApplication endBackgroundTask:gTask];
        gTask = UIBackgroundTaskInvalid;
    }
}

static void stopFrames(void)
{
    if (gTimer)
    {
        CFRunLoopTimerInvalidate(gTimer);
        CFRelease(gTimer);
        gTimer = NULL;
    }
}

static void stopAnimation(BOOL showRest, BOOL expiring)
{
    stopFrames();
    stopKeepAlive();
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

static void startFrames(void)
{
    if (gTimer || gLocked)
    {
        return;
    }
    gStart = CACurrentMediaTime();
    gShown = -1;
    gTimer = CFRunLoopTimerCreateWithHandler(kCFAllocatorDefault, CFAbsoluteTimeGetCurrent(), kTick,
                                             0, 0, ^(CFRunLoopTimerRef timer) { tick(); });
    CFRunLoopAddTimer(CFRunLoopGetMain(), gTimer, kCFRunLoopCommonModes);
}

static void startAnimation(void)
{
    if (gTimer || !gBackgrounded || !animatedIconEnabled() || springBoardAnimates())
    {
        return;
    }
    if (gTask == UIBackgroundTaskInvalid)
    {
        gTask = [UIApplication.sharedApplication beginBackgroundTaskWithName:@"UnboundAnimatedIcon"
                                                           expirationHandler:^{
                                                               if (gSilence.isPlaying)
                                                               {
                                                                   endBackgroundTask();
                                                                   return;
                                                               }
                                                               stopAnimation(YES, YES);
                                                           }];
    }
    startKeepAlive();
    startFrames();
    [Logger info:LOG_CATEGORY_DEFAULT
          format:@"Animating the app icon while Discord is in the background."];
}

static void observe(NSNotificationName name, void (^handler)(NSNotification *note))
{
    [NSNotificationCenter.defaultCenter addObserverForName:name
                                                    object:nil
                                                     queue:NSOperationQueue.mainQueue
                                                usingBlock:handler];
}

%hook UIApplication

- (void)setAlternateIconName:(NSString *)iconName completionHandler:(void (^)(NSError *))completion
{
    NSDictionary *info = UBAnimatedIconInfo();
    if (info && [iconName isEqualToString:UBAnimatedIconId])
    {
        setAnimatedIconEnabled(YES);
        showFrame(info[@"Rest"], -1, ^{
            notify_post(kChangedNotification);
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
        void (^original)(NSError *) = completion;
        completion                  = ^(NSError *error) {
            notify_post(kChangedNotification);
            if (original)
            {
                original(error);
            }
        };
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
    observe(UIApplicationDidEnterBackgroundNotification, ^(NSNotification *note) {
        gBackgrounded = YES;
        startAnimation();
    });
    observe(UIApplicationWillEnterForegroundNotification, ^(NSNotification *note) {
        gBackgrounded = NO;
        if (gTimer || gSilence.isPlaying)
        {
            stopAnimation(YES, NO);
        }
    });
    observe(UIApplicationProtectedDataWillBecomeUnavailable, ^(NSNotification *note) {
        gLocked            = YES;
        NSDictionary *info = UBAnimatedIconInfo();
        if (gTimer && info)
        {
            stopFrames();
            showFrame(info[@"Rest"], -1, nil);
        }
    });
    observe(UIApplicationProtectedDataDidBecomeAvailable, ^(NSNotification *note) {
        gLocked = NO;
        if (gBackgrounded && gSilence.isPlaying)
        {
            startFrames();
        }
    });
    observe(AVAudioSessionInterruptionNotification, ^(NSNotification *note) {
        NSNumber *type = note.userInfo[AVAudioSessionInterruptionTypeKey];
        if (type.unsignedIntegerValue == AVAudioSessionInterruptionTypeEnded && gBackgrounded &&
            gRestoreCategory)
        {
            [gSilence play];
        }
    });
}
