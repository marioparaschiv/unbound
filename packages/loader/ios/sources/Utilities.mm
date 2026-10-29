#import "Utilities.h"

#import <arpa/inet.h>
#import <dlfcn.h>
#import <mach-o/dyld.h>
#import <netinet/in.h>
#import <sys/socket.h>
#import <sys/sysctl.h>

#import "CoreBridge.h"

#if __has_include(<net/route.h>)
#import <net/route.h>
#else
#define RTF_GATEWAY 0x2
#endif

#include <memory>

#import "CoreConversions.h"
#include "LoaderAlertCountdown.h"
#include "LoaderEnvironment.h"

using unbound::ios::toNSString;
using unbound::ios::toStdString;

static void loaderImageAnchor(void) {}

@implementation Utilities
static NSString *bundle = nil;

+ (void)runOnMainThread:(dispatch_block_t)block
{
    if ([NSThread isMainThread])
    {
        block();
    }
    else
    {
        dispatch_sync(dispatch_get_main_queue(), block);
    }
}

+ (NSString *)getBundlePath
{
    if (bundle)
    {
        [Logger info:LOG_CATEGORY_UTILITIES format:@"Using cached bundle URL."];
        return bundle;
    }

    NSString *bundlePath = ROOT_PATH_NS(@"/Library/Application Support/UnboundResources.bundle");

    if ([FileSystem exists:bundlePath])
    {
        bundle = bundlePath;
        return bundlePath;
    }

    NSURL    *url      = [[NSBundle mainBundle] bundleURL];
    NSString *relative = [NSString stringWithFormat:@"%@/UnboundResources.bundle", [url path]];
    if ([FileSystem exists:relative])
    {
        bundle = relative;
        return relative;
    }

    return nil;
}

+ (NSString *)getResource:(NSString *)file
{
    return [Utilities getResource:file ext:@"js"];
}

+ (NSData *)getResource:(NSString *)file data:(BOOL)data ext:(NSString *)ext
{
    NSBundle *bundle = [NSBundle bundleWithPath:[Utilities getBundlePath]];
    if (bundle == nil)
    {
        return nil;
    }

    NSString *path = [bundle pathForResource:file ofType:ext];

    return [NSData dataWithContentsOfFile:path options:0 error:nil];
}

+ (NSString *)getResource:(NSString *)file ext:(NSString *)ext
{
    NSData *data = [Utilities getResource:file data:true ext:ext];

    return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
}

+ (void)alert:(NSString *)message
{
    [self presentAlert:message title:@"Unbound" buttons:nil timeout:0 warning:NO tts:NO];
}

+ (void)alert:(NSString *)message title:(NSString *)title
{
    [self presentAlert:message title:title buttons:nil timeout:0 warning:NO tts:NO];
}

+ (void)alert:(NSString *)message
        title:(NSString *)title
      buttons:(NSArray<UIAlertAction *> *)buttons
{
    [self presentAlert:message title:title buttons:buttons timeout:0 warning:NO tts:NO];
}

+ (void)alert:(NSString *)message
        title:(NSString *)title
      buttons:(NSArray<UIAlertAction *> *)buttons
      timeout:(NSInteger)timeout
{
    [self presentAlert:message title:title buttons:buttons timeout:timeout warning:NO tts:NO];
}

+ (void)alert:(NSString *)message title:(NSString *)title timeout:(NSInteger)timeout
{
    [self presentAlert:message title:title buttons:nil timeout:timeout warning:NO tts:NO];
}

+ (void)alert:(NSString *)message
        title:(NSString *)title
      buttons:(NSArray<UIAlertAction *> *)buttons
      timeout:(NSInteger)timeout
      warning:(BOOL)warning
{
    [self presentAlert:message title:title buttons:buttons timeout:timeout warning:warning tts:NO];
}

+ (void)alert:(NSString *)message
        title:(NSString *)title
      timeout:(NSInteger)timeout
      warning:(BOOL)warning
{
    [self presentAlert:message title:title buttons:nil timeout:timeout warning:warning tts:NO];
}

+ (void)alert:(NSString *)message
        title:(NSString *)title
      timeout:(NSInteger)timeout
      warning:(BOOL)warning
          tts:(BOOL)tts
{
    [self presentAlert:message title:title buttons:nil timeout:timeout warning:warning tts:tts];
}

+ (void)alert:(NSString *)message title:(NSString *)title warning:(BOOL)warning
{
    [self presentAlert:message title:title buttons:nil timeout:0 warning:warning tts:NO];
}

+ (void)alert:(NSString *)message
        title:(NSString *)title
      buttons:(NSArray<UIAlertAction *> *)buttons
      warning:(BOOL)warning
{
    [self presentAlert:message title:title buttons:buttons timeout:0 warning:warning tts:NO];
}

+ (void)alert:(NSString *)message title:(NSString *)title tts:(BOOL)tts
{
    [self presentAlert:message title:title buttons:nil timeout:0 warning:NO tts:tts];
}

+ (void)alert:(NSString *)message
        title:(NSString *)title
      buttons:(NSArray<UIAlertAction *> *)buttons
          tts:(BOOL)tts
{
    [self presentAlert:message title:title buttons:buttons timeout:0 warning:NO tts:tts];
}

+ (void)alert:(NSString *)message title:(NSString *)title warning:(BOOL)warning tts:(BOOL)tts
{
    [self presentAlert:message title:title buttons:nil timeout:0 warning:warning tts:tts];
}

+ (void)alert:(NSString *)message
        title:(NSString *)title
      buttons:(NSArray<UIAlertAction *> *)buttons
      warning:(BOOL)warning
          tts:(BOOL)tts
{
    [self presentAlert:message title:title buttons:buttons timeout:0 warning:warning tts:tts];
}

+ (void)alert:(NSString *)message
        title:(NSString *)title
      buttons:(NSArray<UIAlertAction *> *)buttons
      timeout:(NSInteger)timeout
      warning:(BOOL)warning
          tts:(BOOL)tts
{
    [self presentAlert:message title:title buttons:buttons timeout:timeout warning:warning tts:tts];
}

+ (void)applyCountdownFrame:(const loader::alerts::CountdownFrame &)frame
                    toAlert:(UIAlertController *)alert
                      title:(NSString *)title
{
    alert.title = frame.running ? toNSString(frame.title) : title;
    for (UIAlertAction *action in alert.actions)
    {
        action.enabled = frame.buttonsEnabled;
    }
}

+ (void)presentAlert:(NSString *)message
               title:(NSString *)title
             buttons:(NSArray<UIAlertAction *> *)buttons
             timeout:(NSInteger)timeout
             warning:(BOOL)warning
                 tts:(BOOL)tts
{
    NSArray<UIAlertAction *> *alertButtons = buttons;
    if (!alertButtons || alertButtons.count == 0)
    {
        alertButtons = @[
            [UIAlertAction actionWithTitle:@"Okay" style:UIAlertActionStyleDefault handler:nil],
            [self createDiscordInviteButton]
        ];
    }

    UIAlertController *alert =
        [UIAlertController alertControllerWithTitle:title
                                            message:message
                                     preferredStyle:UIAlertControllerStyleAlert];

    for (UIAlertAction *button in alertButtons)
    {
        [alert addAction:button];
    }

    auto countdown = std::make_shared<loader::alerts::Countdown>(toStdString(title), timeout);
    if (countdown->frame().running)
    {
        [self applyCountdownFrame:countdown->frame() toAlert:alert title:title];
    }

    dispatch_async(dispatch_get_main_queue(), ^{
        UIViewController *controller = nil;

        for (UIScene *scene in [UIApplication sharedApplication].connectedScenes)
        {
            if (scene.activationState == UISceneActivationStateForegroundActive)
            {
                UIWindowScene *windowScene = (UIWindowScene *) scene;
                UIWindow      *keyWindow   = windowScene.windows.firstObject;
                for (UIWindow *window in windowScene.windows)
                {
                    if (window.isKeyWindow)
                    {
                        keyWindow = window;
                        break;
                    }
                }
                controller = keyWindow.rootViewController;
                break;
            }
        }

        if (!controller)
        {
            controller = [[[[UIApplication sharedApplication] delegate] window] rootViewController];
        }

        while (controller.presentedViewController)
        {
            controller = controller.presentedViewController;
        }

        if (!controller)
        {
            [Logger error:LOG_CATEGORY_UTILITIES
                   format:@"Failed to find view controller to present alert"];
            return;
        }

        [controller
            presentViewController:alert
                         animated:YES
                       completion:^{
                           if (warning)
                           {
                               dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 0.1 * NSEC_PER_SEC),
                                              dispatch_get_main_queue(),
                                              ^{ [self applyRedPulsatingBorderToAlert:alert]; });
                           }

                           if (tts)
                           {
                               dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 0.5 * NSEC_PER_SEC),
                                              dispatch_get_main_queue(),
                                              ^{ [self speakAlertContent:title message:message]; });
                           }

                           if (countdown->frame().running)
                           {
                               dispatch_source_t timer = dispatch_source_create(
                                   DISPATCH_SOURCE_TYPE_TIMER, 0, 0, dispatch_get_main_queue());

                               dispatch_source_set_timer(
                                   timer,
                                   dispatch_time(DISPATCH_TIME_NOW,
                                                 loader::alerts::kCountdownTickSeconds *
                                                     NSEC_PER_SEC),
                                   loader::alerts::kCountdownTickSeconds * NSEC_PER_SEC,
                                   loader::alerts::kCountdownLeewaySeconds * NSEC_PER_SEC);

                               dispatch_source_set_event_handler(timer, ^{
                                   BOOL presented = alert.presentingViewController != nil;
                                   loader::alerts::CountdownFrame frame =
                                       countdown->tick(presented);
                                   if (presented)
                                   {
                                       [self applyCountdownFrame:frame toAlert:alert title:title];
                                   }
                                   if (!frame.running)
                                   {
                                       dispatch_source_cancel(timer);
                                   }
                               });

                               dispatch_resume(timer);
                           }
                       }];
    });
}

+ (void)speakAlertContent:(NSString *)title message:(NSString *)message
{
    if (UIAccessibilityIsVoiceOverRunning())
    {
        NSString *announcement = [NSString stringWithFormat:@"%@. %@", title, message];
        UIAccessibilityPostNotification(UIAccessibilityAnnouncementNotification, announcement);
        return;
    }

    static AVSpeechSynthesizer *synthesizer = nil;
    if (!synthesizer)
    {
        synthesizer = [[AVSpeechSynthesizer alloc] init];
    }

    if ([synthesizer isSpeaking])
    {
        [synthesizer stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
    }

    NSString *cleanTitle = [title stringByReplacingOccurrencesOfString:@"⚠️" withString:@"Warning:"];

    NSString *speechText = [NSString stringWithFormat:@"%@. %@", cleanTitle, message];

    AVSpeechUtterance *utterance = [AVSpeechUtterance speechUtteranceWithString:speechText];
    utterance.rate               = AVSpeechUtteranceDefaultSpeechRate;
    utterance.volume             = 1.0;

    AVSpeechSynthesisVoice *voice = [AVSpeechSynthesisVoice voiceWithLanguage:@"en-GB"];
    if (voice)
    {
        utterance.voice = voice;
    }

    [Logger info:LOG_CATEGORY_UTILITIES format:@"Speaking alert content via TTS"];
    [synthesizer speakUtterance:utterance];
}

+ (void)applyRedPulsatingBorderToAlert:(UIAlertController *)alert
{
    UIView *alertView = alert.view;

    [alertView.layer removeAllAnimations];

    alertView.layer.shadowColor   = [UIColor systemRedColor].CGColor;
    alertView.layer.shadowRadius  = 15.0;
    alertView.layer.shadowOpacity = 0.8;
    alertView.layer.shadowOffset  = CGSizeZero;
    alertView.layer.cornerRadius  = 14.0;

    alertView.layer.borderColor = [UIColor systemRedColor].CGColor;
    alertView.layer.borderWidth = 1.5;

    CABasicAnimation *glowAnimation = [CABasicAnimation animationWithKeyPath:@"shadowRadius"];
    glowAnimation.fromValue         = @(8.0);
    glowAnimation.toValue           = @(25.0);
    glowAnimation.duration          = 1.5;
    glowAnimation.autoreverses      = YES;
    glowAnimation.repeatCount       = HUGE_VALF;
    glowAnimation.timingFunction =
        [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseInEaseOut];

    CABasicAnimation *opacityAnimation = [CABasicAnimation animationWithKeyPath:@"shadowOpacity"];
    opacityAnimation.fromValue         = @(0.4);
    opacityAnimation.toValue           = @(1.0);
    opacityAnimation.duration          = 1.5;
    opacityAnimation.autoreverses      = YES;
    opacityAnimation.repeatCount       = HUGE_VALF;
    opacityAnimation.timingFunction =
        [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseInEaseOut];

    CABasicAnimation *borderAnimation = [CABasicAnimation animationWithKeyPath:@"borderWidth"];
    borderAnimation.fromValue         = @(1.0);
    borderAnimation.toValue           = @(2.5);
    borderAnimation.duration          = 1.5;
    borderAnimation.autoreverses      = YES;
    borderAnimation.repeatCount       = HUGE_VALF;
    borderAnimation.timingFunction =
        [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseInEaseOut];

    CAAnimationGroup *animationGroup = [CAAnimationGroup animation];
    animationGroup.animations        = @[ glowAnimation, opacityAnimation, borderAnimation ];
    animationGroup.duration          = 1.5;
    animationGroup.autoreverses      = YES;
    animationGroup.repeatCount       = HUGE_VALF;

    [alertView.layer addAnimation:animationGroup forKey:@"redLightsaberGlow"];
}

+ (NSData *)fetchDataWithTimeout:(NSURL *)url timeout:(NSTimeInterval)timeout
{
    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);

    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
    request.cachePolicy          = NSURLRequestReloadIgnoringCacheData;
    request.timeoutInterval      = timeout;

    __block NSData *resultData = nil;

    NSURLSessionTask *task = [[NSURLSession sharedSession]
        dataTaskWithRequest:request
          completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
              if (!error && [(NSHTTPURLResponse *) response statusCode] == 200)
              {
                  resultData = data;
              }
              dispatch_semaphore_signal(semaphore);
          }];

    [task resume];
    if (dispatch_semaphore_wait(
            semaphore,
            dispatch_time(DISPATCH_TIME_NOW, (int64_t) ((timeout + 1) * NSEC_PER_SEC))) != 0)
    {
        [task cancel];
        return nil;
    }

    return resultData;
}

+ (BOOL)isRNNewArchEnabled
{
    NSBundle *bundle         = [NSBundle mainBundle];
    NSNumber *newArchEnabled = [bundle objectForInfoDictionaryKey:@"RCTNewArchEnabled"];
    if (newArchEnabled)
    {
        return [newArchEnabled boolValue];
    }

    void *symbol = dlsym(RTLD_DEFAULT, "RCTIsNewArchEnabled");
    if (!symbol)
    {
        return NO;
    }

    typedef BOOL (*RCTIsNewArchEnabledFn)(void);
    RCTIsNewArchEnabledFn isNewArchEnabled = (RCTIsNewArchEnabledFn) symbol;

    return isNewArchEnabled ? isNewArchEnabled() : NO;
}

+ (NSString *)getAppStoreReceiptName
{
    NSURL *appStoreReceiptURL = [[NSBundle mainBundle] appStoreReceiptURL];
    if (!appStoreReceiptURL)
    {
        return nil;
    }
    return appStoreReceiptURL.lastPathComponent;
}

+ (loader::environment::Receipt)receipt
{
    NSString *receiptName = [self getAppStoreReceiptName];
    if (!receiptName)
    {
        return loader::environment::Receipt::None;
    }
    NSURL *appStoreReceiptURL = [[NSBundle mainBundle] appStoreReceiptURL];
    return loader::environment::receiptKind(
        toStdString(receiptName),
        [[NSFileManager defaultManager] fileExistsAtPath:appStoreReceiptURL.path]);
}

+ (BOOL)isAppStoreApp
{
    return [self receipt] == loader::environment::Receipt::AppStore;
}

+ (BOOL)isTestFlightApp
{
    return [self receipt] == loader::environment::Receipt::TestFlight;
}

+ (NSDictionary *)checkTrollStorePaths:(NSString *)bundlePath
{
    NSString *trollStorePath =
        [bundlePath stringByAppendingPathComponent:@(loader::environment::kTrollStoreMarker)];
    NSString *trollStoreLitePath =
        [bundlePath stringByAppendingPathComponent:@(loader::environment::kTrollStoreLiteMarker)];

    BOOL isTrollStore     = (access([trollStorePath UTF8String], F_OK) == 0);
    BOOL isTrollStoreLite = (access([trollStoreLitePath UTF8String], F_OK) == 0);

    return @{@"isTrollStore" : @(isTrollStore), @"isTrollStoreLite" : @(isTrollStoreLite)};
}

+ (BOOL)isTrollStoreApp
{
    loader::environment::Receipt receipt = [self receipt];
    if (receipt != loader::environment::Receipt::None)
    {
        return NO;
    }

    NSString     *bundlePath      = [[NSBundle mainBundle] bundlePath];
    NSDictionary *trollStorePaths = [self checkTrollStorePaths:bundlePath];

    BOOL isTrollStore     = [trollStorePaths[@"isTrollStore"] boolValue];
    BOOL isTrollStoreLite = [trollStorePaths[@"isTrollStoreLite"] boolValue];
    BOOL isTrollStoreApp =
        loader::environment::isTrollStoreInstall(receipt, isTrollStore, isTrollStoreLite);

    [Logger debug:LOG_CATEGORY_UTILITIES
           format:@"TrollStore detection - Regular: %@, Lite: %@, isTrollStore: %@",
                  isTrollStore ? @"YES" : @"NO", isTrollStoreLite ? @"YES" : @"NO",
                  isTrollStore ? @"YES" : @"NO"];

    return isTrollStoreApp;
}

+ (BOOL)isSystemApp
{
    NSString *bundleID = [[NSBundle mainBundle] bundleIdentifier];
    if (!bundleID)
    {
        [Logger debug:LOG_CATEGORY_UTILITIES format:@"No bundle identifier found"];
        return NO;
    }

    Class LSApplicationProxyClass = NSClassFromString(@"LSApplicationProxy");
    if (!LSApplicationProxyClass)
    {
        [Logger debug:LOG_CATEGORY_UTILITIES format:@"LSApplicationProxy class not found"];
        return NO;
    }

    SEL applicationProxySelector = @selector(applicationProxyForIdentifier:);
    if (![LSApplicationProxyClass respondsToSelector:applicationProxySelector])
    {
        [Logger debug:LOG_CATEGORY_UTILITIES
               format:@"LSApplicationProxy doesn't respond to applicationProxyForIdentifier:"];
        return NO;
    }

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Warc-performSelector-leaks"
    id proxy = [LSApplicationProxyClass performSelector:applicationProxySelector
                                             withObject:bundleID];
#pragma clang diagnostic pop

    if (!proxy)
    {
        [Logger debug:LOG_CATEGORY_UTILITIES
               format:@"Failed to get application proxy for %@", bundleID];
        return NO;
    }

    SEL applicationTypeSelector = @selector(applicationType);
    if (![proxy respondsToSelector:applicationTypeSelector])
    {
        [Logger debug:LOG_CATEGORY_UTILITIES
               format:@"Application proxy doesn't respond to applicationType"];
        return NO;
    }

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Warc-performSelector-leaks"
    NSString *appType = [proxy performSelector:applicationTypeSelector];
#pragma clang diagnostic pop

    if (!appType)
    {
        [Logger debug:LOG_CATEGORY_UTILITIES format:@"Failed to get application type"];
        return NO;
    }

    BOOL isSystem = [appType isEqualToString:@"System"];

    [Logger debug:LOG_CATEGORY_UTILITIES
           format:@"Application type: %@, isSystemApp: %@", appType, isSystem ? @"YES" : @"NO"];

    return isSystem;
}

+ (BOOL)isJailbroken
{
    if (access("/var/mobile", R_OK) == 0 || access("/var/jb", F_OK) == 0)
    {
        return YES;
    }

    Dl_info info;
    if (dladdr((const void *) &loaderImageAnchor, &info) && info.dli_fname)
    {
        NSString *image = @(info.dli_fname);
        for (NSString *root in
             @[ @"/var/jb/", @"/Library/MobileSubstrate/", @"/usr/lib/TweakInject/" ])
        {
            if ([image hasPrefix:root] || [image containsString:@"/.jbroot-"])
            {
                return YES;
            }
        }
    }

    return NO;
}

+ (NSString *)getDeviceModel
{
    MobileGestalt *mg                         = [MobileGestalt sharedInstance];
    NSString      *physicalHardwareNameString = [mg getPhysicalHardwareNameString];

    if (physicalHardwareNameString)
    {
        return physicalHardwareNameString;
    }

    struct utsname systemInfo;
    uname(&systemInfo);
    return [NSString stringWithCString:systemInfo.machine encoding:NSUTF8StringEncoding];
}

+ (BOOL)isVPhone
{
    static BOOL            result;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        char   machine[64] = {0};
        size_t size        = sizeof(machine);

        result = sysctlbyname("hw.machine", machine, &size, NULL, 0) == 0 &&
                 loader::environment::isVirtualDeviceMachine(machine);
    });
    return result;
}

static NSString *defaultGatewayAddress(void)
{
    int    mib[]  = {CTL_NET, PF_ROUTE, 0, AF_INET, NET_RT_FLAGS, RTF_GATEWAY};
    size_t length = 0;

    if (sysctl(mib, 6, NULL, &length, NULL, 0) != 0 || length == 0)
    {
        [Logger error:LOG_CATEGORY_UTILITIES
               format:@"Failed to size the routing table: %s", strerror(errno)];
        return nil;
    }

    NSMutableData *table = [NSMutableData dataWithLength:length];
    if (sysctl(mib, 6, table.mutableBytes, &length, NULL, 0) != 0)
    {
        [Logger error:LOG_CATEGORY_UTILITIES
               format:@"Failed to read the routing table: %s", strerror(errno)];
        return nil;
    }

    std::optional<std::string> gateway =
        loader::environment::defaultIPv4Gateway(static_cast<const uint8_t *>(table.bytes), length);
    return gateway ? toNSString(*gateway) : nil;
}

+ (NSString *)getVirtualDeviceHostAddress
{
    static NSString       *result;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        if (![Utilities isVPhone])
        {
            return;
        }

        result = defaultGatewayAddress();
        [Logger info:LOG_CATEGORY_UTILITIES
              format:@"Virtual device host address: %@", result ?: @"not found"];
    });
    return result;
}

+ (NSString *)getiOSVersionString
{
    UIDevice *device = [UIDevice currentDevice];

    MobileGestalt *mg              = [MobileGestalt sharedInstance];
    NSString      *iosBuildVersion = [mg getBuildVersion];

    return toNSString(loader::environment::osVersionLabel(
        toStdString(device.systemVersion),
        iosBuildVersion ? std::optional<std::string>(toStdString(iosBuildVersion)) : std::nullopt));
}

+ (BOOL)isLoadedWithElleKit
{
    void *EKEnableThreadSafetyPtr = dlsym(RTLD_DEFAULT, "EKEnableThreadSafety");
    if (EKEnableThreadSafetyPtr != NULL)
    {
        return YES;
    }

    return NO;
}

+ (BOOL)hasAppExtension:(NSString *)extensionName
{
    NSString *plugInsPath =
        [[[NSBundle mainBundle] bundlePath] stringByAppendingPathComponent:@"PlugIns"];
    NSString *extensionPath = [plugInsPath
        stringByAppendingPathComponent:[NSString stringWithFormat:@"%@.appex", extensionName]];

    BOOL exists = [[NSFileManager defaultManager] fileExistsAtPath:extensionPath];
    [Logger debug:LOG_CATEGORY_UTILITIES
           format:@"App extension '%@' %@", extensionName, exists ? @"found" : @"not found"];

    return exists;
}

+ (NSString *)getCurrentDylibName
{
    Dl_info info;
    memset(&info, 0, sizeof(info));

    IMP implementation = [self methodForSelector:@selector(getCurrentDylibName)];

    if (dladdr((const void *) implementation, &info) && info.dli_fname)
    {
        NSString *fullPath = [NSString stringWithUTF8String:info.dli_fname];
        return [fullPath lastPathComponent];
    }

    return nil;
}

+ (BOOL)isJITAvailable
{
#if TARGET_OS_MACCATALYST || TARGET_OS_SIMULATOR
    [Logger debug:LOG_CATEGORY_UTILITIES format:@"JIT available: Catalyst/Simulator environment"];
    return YES;
#else

    if ([self isJailbroken])
    {
        [Logger debug:LOG_CATEGORY_UTILITIES format:@"JIT available: Jailbroken device"];
        return YES;
    }

    if (@available(iOS 26.0, *))
    {
        [Logger debug:LOG_CATEGORY_UTILITIES format:@"JIT not available: iOS 26.0+"];
        return NO;
    }

    int flags;
    int result = csops(getpid(), 0, &flags, sizeof(flags));
    if (result != 0)
    {
        [Logger error:LOG_CATEGORY_UTILITIES format:@"Failed to get CS flags: %s", strerror(errno)];
        return NO;
    }

    BOOL hasDebugFlag = (flags & CS_DEBUGGED) != 0;

    [Logger debug:LOG_CATEGORY_UTILITIES
           format:@"CS flags: 0x%x, CS_DEBUGGED: %@, JIT available: %@", flags,
                  hasDebugFlag ? @"YES" : @"NO", hasDebugFlag ? @"YES" : @"NO"];

    return hasDebugFlag;
#endif
}

+ (BOOL)isLiveContainerApp
{
    Class LCSharedUtilsClass = NSClassFromString(@"LCSharedUtils");
    BOOL  isLiveContainer    = (LCSharedUtilsClass != nil);

    [Logger debug:LOG_CATEGORY_UTILITIES
           format:@"LiveContainer detection - LCSharedUtils class: %@, isLiveContainer: %@",
                  LCSharedUtilsClass ? @"Found" : @"Not found", isLiveContainer ? @"YES" : @"NO"];

    return isLiveContainer;
}

+ (BOOL)isRunningInSimulator
{
#if TARGET_OS_SIMULATOR
    return YES;
#else
    return NO;
#endif
}

+ (NSString *)getInjectionFramework
{
    NSDictionary<NSString *, NSString *> *frameworks = @{
        @"libellekit" : @"ElleKit",
        @"CydiaSubstrate" : @"Substrate",
        @"libsubstrate" : @"Substrate",
        @"libhooker" : @"libhooker",
    };

    for (uint32_t index = 0; index < _dyld_image_count(); index++)
    {
        const char *name = _dyld_get_image_name(index);
        if (!name)
        {
            continue;
        }

        NSString *image = @(name);
        for (NSString *marker in frameworks)
        {
            if ([image containsString:marker])
            {
                return frameworks[marker];
            }
        }
    }

    return @"";
}

+ (NSString *)getAppSource
{
    loader::environment::InstallFacts facts;
    facts.simulator = [self isRunningInSimulator];
    if (!facts.simulator)
    {
        NSDictionary *trollStorePaths = [self checkTrollStorePaths:NSBundle.mainBundle.bundlePath];
        facts.receipt                 = [self receipt];
        facts.trollStore              = [trollStorePaths[@"isTrollStore"] boolValue];
        facts.trollStoreLite          = [trollStorePaths[@"isTrollStoreLite"] boolValue];
        facts.liveContainer           = [self isLiveContainerApp];
        facts.jitAvailable            = [] {
            return static_cast<bool>([Utilities isJITAvailable]);
        };
    }
    return toNSString(loader::environment::appSource(facts));
}

+ (UIAlertAction *)createDiscordInviteButton
{
    return [UIAlertAction
        actionWithTitle:@"Join Server"
                  style:UIAlertActionStyleDefault
                handler:^(UIAlertAction *action) {
                    UIApplication *application = [UIApplication sharedApplication];
                    NSURL         *discordURL =
                        [NSURL URLWithString:@"discord://discord.com/invite/rMdzhWUaGT"];
                    NSURL *webURL = [NSURL URLWithString:@"https://discord.com/invite/rMdzhWUaGT"];

                    if ([application canOpenURL:discordURL])
                    {
                        [application openURL:discordURL options:@{} completionHandler:nil];
                    }
                    else
                    {
                        [application openURL:webURL options:@{} completionHandler:nil];
                    }
                }];
}

+ (UIWindow *)keyWindow
{
    for (UIScene *scene in [UIApplication sharedApplication].connectedScenes)
    {
        if (scene.activationState == UISceneActivationStateForegroundActive &&
            [scene isKindOfClass:[UIWindowScene class]])
        {
            UIWindowScene *windowScene = (UIWindowScene *) scene;
            for (UIWindow *window in windowScene.windows)
            {
                if (window.isKeyWindow)
                {
                    return window;
                }
            }
        }
    }

    return nil;
}

+ (UIViewController *)topViewController
{
    UIViewController *controller = [self keyWindow].rootViewController;

    while (controller.presentedViewController)
    {
        controller = controller.presentedViewController;
    }

    return controller;
}

static __weak DCDBundleUpdaterManager *gBundleUpdater = nil;

+ (void)setBundleUpdater:(id)bundleUpdater
{
    gBundleUpdater = bundleUpdater;
}

+ (void)reloadApp
{
    DCDBundleUpdaterManager *updater = gBundleUpdater;
    if (![updater respondsToSelector:@selector(reload)])
    {
        [Logger error:LOG_CATEGORY_UTILITIES
               format:@"BundleUpdaterManager not captured; cannot reload."];
        return;
    }

    dispatch_async(dispatch_get_main_queue(), ^{ [updater reload]; });
}

@end
