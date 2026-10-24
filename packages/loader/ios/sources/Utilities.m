#import "Utilities.h"

#import <arpa/inet.h>
#import <netinet/in.h>
#import <sys/socket.h>
#import <sys/sysctl.h>

#if __has_include(<net/route.h>)
#import <net/route.h>
#else
// The iOS SDK omits <net/route.h>; these mirror the stable XNU routing-socket ABI.
#define RTF_GATEWAY 0x2
#define RTAX_DST     0
#define RTAX_GATEWAY 1
#define RTAX_MAX     8

struct rt_metrics
{
    u_int32_t rmx_locks;
    u_int32_t rmx_mtu;
    u_int32_t rmx_hopcount;
    int32_t   rmx_expire;
    u_int32_t rmx_recvpipe;
    u_int32_t rmx_sendpipe;
    u_int32_t rmx_ssthresh;
    u_int32_t rmx_rtt;
    u_int32_t rmx_rttvar;
    u_int32_t rmx_pksent;
    u_int32_t rmx_filler[4];
};

struct rt_msghdr
{
    u_short           rtm_msglen;
    u_char            rtm_version;
    u_char            rtm_type;
    u_short           rtm_index;
    int               rtm_flags;
    int               rtm_addrs;
    pid_t             rtm_pid;
    int               rtm_seq;
    int               rtm_errno;
    int               rtm_use;
    u_int32_t         rtm_inits;
    struct rt_metrics rtm_rmx;
};
#endif

static NSString *const kVirtualDeviceMachine = @"iPhone99,11";

NSString *const TROLL_STORE_PATH      = @"../_TrollStore";
NSString *const TROLL_STORE_LITE_PATH = @"../_TrollStoreLite";

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

+ (void)alertWarning:(NSString *)message title:(NSString *)title timeout:(NSInteger)timeout
{
    [self presentAlert:message title:title buttons:nil timeout:timeout warning:YES tts:YES];
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

    if (timeout > 0)
    {
        for (UIAlertAction *action in alert.actions)
        {
            action.enabled = NO;
        }

        NSString *originalTitle = title;
        alert.title = [NSString stringWithFormat:@"%@ (%ld)", originalTitle, (long) timeout];
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

                           if (timeout > 0)
                           {
                               __block NSInteger countdown = timeout;
                               dispatch_source_t timer     = dispatch_source_create(
                                   DISPATCH_SOURCE_TYPE_TIMER, 0, 0, dispatch_get_main_queue());

                               dispatch_source_set_timer(
                                   timer, dispatch_time(DISPATCH_TIME_NOW, 1.0 * NSEC_PER_SEC),
                                   1.0 * NSEC_PER_SEC, 0.1 * NSEC_PER_SEC);

                               dispatch_source_set_event_handler(timer, ^{
                                   if (!alert.presentingViewController)
                                   {
                                       dispatch_source_cancel(timer);
                                       return;
                                   }

                                   countdown--;

                                   if (countdown > 0)
                                   {
                                       alert.title = [NSString
                                           stringWithFormat:@"%@ (%ld)", title, (long) countdown];
                                   }
                                   else
                                   {
                                       alert.title = title;
                                       for (UIAlertAction *action in alert.actions)
                                       {
                                           action.enabled = YES;
                                       }
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

+ (id)parseJSON:(NSData *)data
{
    NSError *error = nil;

    id object = [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];

    if (error)
    {
        @throw error;
    }

    return object;
}

+ (NSData *)fetchDataWithTimeout:(NSURL *)url timeout:(NSTimeInterval)timeout
{
    static NSURLSession   *bundleUrlSession = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        NSURLSessionConfiguration *config = [NSURLSessionConfiguration defaultSessionConfiguration];
        config.timeoutIntervalForRequest  = timeout;
        bundleUrlSession                  = [NSURLSession sessionWithConfiguration:config];
    });

    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);

    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
    request.cachePolicy          = NSURLRequestReloadIgnoringCacheData;

    __block NSData *resultData = nil;

    NSURLSessionTask *task = [bundleUrlSession
        dataTaskWithRequest:request
          completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
              if (!error && [(NSHTTPURLResponse *) response statusCode] == 200)
              {
                  resultData = data;
              }
              dispatch_semaphore_signal(semaphore);
          }];

    [task resume];
    dispatch_semaphore_wait(semaphore, DISPATCH_TIME_FOREVER);

    return resultData;
}

+ (dispatch_source_t)createDebounceTimer:(double)delay
                                   queue:(dispatch_queue_t)queue
                                   block:(dispatch_block_t)block
{
    dispatch_source_t timer = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0, queue);

    if (timer)
    {
        dispatch_source_set_timer(timer, dispatch_time(DISPATCH_TIME_NOW, delay * NSEC_PER_SEC),
                                  DISPATCH_TIME_FOREVER, (1ull * NSEC_PER_SEC) / 10);
        dispatch_source_set_event_handler(timer, block);
        dispatch_resume(timer);
    }

    return timer;
}

+ (uint32_t)getHermesBytecodeVersion
{
    NSString *bundlePath   = [[NSBundle mainBundle] bundlePath];
    NSString *jsBundlePath = [bundlePath stringByAppendingPathComponent:@"main.jsbundle"];

    NSFileHandle *handle = [NSFileHandle fileHandleForReadingAtPath:jsBundlePath];
    if (!handle)
    {
        [Logger error:LOG_CATEGORY_UTILITIES
               format:@"Could not open %@ to read Hermes bytecode version", jsBundlePath];
        return 0;
    }

    NSData *prefix = [handle readDataOfLength:sizeof(HermesBytecodeFileHeaderPrefix)];
    [handle closeFile];

    uint32_t version = HermesDataBytecodeVersion([prefix bytes], [prefix length]);
    if (version == 0)
    {
        [Logger error:LOG_CATEGORY_UTILITIES
               format:@"%@ is not a Hermes bytecode bundle (read %lu bytes)", jsBundlePath,
                      (unsigned long) [prefix length]];
        return 0;
    }

    [Logger info:LOG_CATEGORY_UTILITIES format:@"Hermes bytecode version: %u", version];
    return version;
}

+ (BOOL)isHermesBytecode:(NSData *)data
{
    return HermesDataIsBytecode([data bytes], [data length]);
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

+ (BOOL)isAppStoreApp
{
    NSString *receiptName = [self getAppStoreReceiptName];
    if (!receiptName || [receiptName isEqualToString:@"sandboxReceipt"])
    {
        return NO;
    }
    NSURL *appStoreReceiptURL = [[NSBundle mainBundle] appStoreReceiptURL];
    return [[NSFileManager defaultManager] fileExistsAtPath:appStoreReceiptURL.path];
}

+ (BOOL)isTestFlightApp
{
    NSString *receiptName = [self getAppStoreReceiptName];
    if (!receiptName)
    {
        return NO;
    }
    return [receiptName isEqualToString:@"sandboxReceipt"];
}

+ (NSDictionary *)checkTrollStorePaths:(NSString *)bundlePath
{
    NSString *trollStorePath = [bundlePath stringByAppendingPathComponent:TROLL_STORE_PATH];
    NSString *trollStoreLitePath =
        [bundlePath stringByAppendingPathComponent:TROLL_STORE_LITE_PATH];

    BOOL isTrollStore     = (access([trollStorePath UTF8String], F_OK) == 0);
    BOOL isTrollStoreLite = (access([trollStoreLitePath UTF8String], F_OK) == 0);

    return @{@"isTrollStore" : @(isTrollStore), @"isTrollStoreLite" : @(isTrollStoreLite)};
}

+ (BOOL)isTrollStoreApp
{
    if ([self isAppStoreApp] || [self isTestFlightApp])
    {
        return NO;
    }

    NSString     *bundlePath      = [[NSBundle mainBundle] bundlePath];
    NSDictionary *trollStorePaths = [self checkTrollStorePaths:bundlePath];

    BOOL isTrollStore     = [trollStorePaths[@"isTrollStore"] boolValue];
    BOOL isTrollStoreLite = [trollStorePaths[@"isTrollStoreLite"] boolValue];
    BOOL isTrollStoreApp  = isTrollStore || isTrollStoreLite;

    [Logger debug:LOG_CATEGORY_UTILITIES
           format:@"TrollStore detection - Regular: %@, Lite: %@, isTrollStore: %@",
                  isTrollStore ? @"YES" : @"NO", isTrollStoreLite ? @"YES" : @"NO",
                  isTrollStore ? @"YES" : @"NO"];

    return isTrollStoreApp;
}

+ (NSString *)getTrollStoreVariant
{
    NSString     *bundlePath      = [[NSBundle mainBundle] bundlePath];
    NSDictionary *trollStorePaths = [self checkTrollStorePaths:bundlePath];

    if ([trollStorePaths[@"isTrollStore"] boolValue])
    {
        return @"TrollStore";
    }
    else if ([trollStorePaths[@"isTrollStoreLite"] boolValue])
    {
        return @"TrollStore Lite";
    }

    return @"Unknown";
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
    if (access("/var/mobile", R_OK) == 0)
    {
        return YES;
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
                 [@(machine) isEqualToString:kVirtualDeviceMachine];
    });
    return result;
}

// Returns the IPv4 gateway of the default route described by one routing message, if it is one.
static NSString *defaultRouteGateway(const struct rt_msghdr *message, const uint8_t *end)
{
    const struct sockaddr *addresses[RTAX_MAX] = {NULL};
    const uint8_t         *cursor              = (const uint8_t *) (message + 1);

    for (int index = 0; index < RTAX_MAX; index++)
    {
        if (!(message->rtm_addrs & (1 << index)))
        {
            continue;
        }

        if (cursor >= end)
        {
            return nil;
        }

        const struct sockaddr *address = (const struct sockaddr *) cursor;
        size_t                 length  = address->sa_len > 0
                                             ? 1 + ((address->sa_len - 1) | (sizeof(uint32_t) - 1))
                                             : sizeof(uint32_t);
        if (cursor + length > end)
        {
            return nil;
        }

        addresses[index] = address;
        cursor += length;
    }

    const struct sockaddr *destination = addresses[RTAX_DST];
    const struct sockaddr *gateway     = addresses[RTAX_GATEWAY];
    if (!destination || !gateway || destination->sa_family != AF_INET ||
        gateway->sa_family != AF_INET || destination->sa_len < sizeof(struct sockaddr_in) ||
        gateway->sa_len < sizeof(struct sockaddr_in))
    {
        return nil;
    }

    if (((const struct sockaddr_in *) destination)->sin_addr.s_addr != INADDR_ANY)
    {
        return nil;
    }

    char text[INET_ADDRSTRLEN] = {0};
    if (!inet_ntop(AF_INET, &((const struct sockaddr_in *) gateway)->sin_addr, text, sizeof(text)))
    {
        return nil;
    }

    return @(text);
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

    const uint8_t *cursor = (const uint8_t *) table.bytes;
    const uint8_t *end    = cursor + length;

    while (cursor + sizeof(struct rt_msghdr) <= end)
    {
        const struct rt_msghdr *message = (const struct rt_msghdr *) cursor;
        const uint8_t          *next    = cursor + message->rtm_msglen;
        if (message->rtm_msglen < sizeof(struct rt_msghdr) || next > end)
        {
            break;
        }

        NSString *gateway = defaultRouteGateway(message, next);
        if (gateway)
        {
            return gateway;
        }

        cursor = next;
    }

    return nil;
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

    return iosBuildVersion
               ? [NSString stringWithFormat:@"%@ (%@)", device.systemVersion, iosBuildVersion]
               : device.systemVersion;
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

+ (NSString *)getAppSource
{
    if ([self isRunningInSimulator])
    {
        return @"iOS Simulator";
    }

    if ([self isTrollStoreApp])
    {
        return [self getTrollStoreVariant];
    }
    else if ([self isLiveContainerApp])
    {
        if ([self isJITAvailable])
        {
            return @"LiveContainer (JIT)";
        }
        else
        {
            return @"LiveContainer (Signed)";
        }
    }
    else if ([self isAppStoreApp])
    {
        return @"App Store";
    }
    else if ([self isTestFlightApp])
    {
        return @"TestFlight";
    }
    else
    {
        return @"Sideloaded";
    }
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

+ (NSString *)JSONString:(NSString *)str
{
    if (!str)
        return @"null";
    NSString *escaped = [str stringByReplacingOccurrencesOfString:@"\"" withString:@"\\\""];
    return [NSString stringWithFormat:@"\"%@\"", escaped];
}

+ (NSString *)JSONStringFromObject:(id)object
                           options:(NSJSONWritingOptions)opts
                          fallback:(NSString *)fallback
{
    NSError *error = nil;
    NSData  *data  = [NSJSONSerialization dataWithJSONObject:object options:opts error:&error];

    if (error != nil || data == nil)
    {
        return fallback;
    }

    return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
}

+ (BOOL)isRecoveryModeEnabled
{
    return [Settings getBoolean:@"unbound" key:@"recovery" def:NO];
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

static NSRegularExpression *colorArgsRegex(void)
{
    static NSRegularExpression *regex = nil;
    static dispatch_once_t      onceToken;
    dispatch_once(&onceToken, ^{
        regex = [NSRegularExpression regularExpressionWithPattern:@"\\((.*)\\)"
                                                            options:NSRegularExpressionCaseInsensitive
                                                              error:nil];
    });
    return regex;
}

+ (UIColor *)parseColor:(NSString *)color
{
    if ([color hasPrefix:@"#"])
    {
        if (color.length == 7)
        {
            color = [color stringByAppendingString:@"FF"];
        }

        NSScanner *scanner = [NSScanner scannerWithString:color];
        unsigned   res     = 0;

        [scanner setScanLocation:1];
        [scanner scanHexInt:&res];

        CGFloat r = ((res & 0xFF000000) >> 24) / 255.0;
        CGFloat g = ((res & 0x00FF0000) >> 16) / 255.0;
        CGFloat b = ((res & 0x0000FF00) >> 8) / 255.0;
        CGFloat a = (res & 0x000000FF) / 255.0;

        return [UIColor colorWithRed:r green:g blue:b alpha:a];
    }

    if ([color hasPrefix:@"rgba"])
    {
        NSRegularExpression *regex = colorArgsRegex();

        NSArray  *matches = [regex matchesInString:color
                                           options:0
                                             range:NSMakeRange(0, [color length])];
        NSString *value   = [[NSString alloc] init];

        for (NSTextCheckingResult *match in matches)
        {
            NSRange range = [match rangeAtIndex:1];
            value         = [color substringWithRange:range];
        }

        NSCharacterSet *whitespaces = [NSCharacterSet whitespaceCharacterSet];
        NSArray        *values      = [value componentsSeparatedByString:@","];
        NSMutableArray *res         = [[NSMutableArray alloc] init];

        for (NSString *value in values)
        {
            NSString *trimmed = [value stringByTrimmingCharactersInSet:whitespaces];
            NSNumber *payload = [NSNumber numberWithFloat:[trimmed floatValue]];

            [res addObject:payload];
        }

        if (res.count < 4)
        {
            return nil;
        }

        CGFloat r = [[res objectAtIndex:0] floatValue] / 255.0f;
        CGFloat g = [[res objectAtIndex:1] floatValue] / 255.0f;
        CGFloat b = [[res objectAtIndex:2] floatValue] / 255.0f;
        CGFloat a = [[res objectAtIndex:3] floatValue];

        return [UIColor colorWithRed:r green:g blue:b alpha:a];
    }

    if ([color hasPrefix:@"rgb"])
    {
        NSRegularExpression *regex = colorArgsRegex();

        NSArray  *matches = [regex matchesInString:color
                                           options:0
                                             range:NSMakeRange(0, [color length])];
        NSString *value   = [[NSString alloc] init];

        for (NSTextCheckingResult *match in matches)
        {
            NSRange range = [match rangeAtIndex:1];
            value         = [color substringWithRange:range];
        }

        NSCharacterSet *whitespaces = [NSCharacterSet whitespaceCharacterSet];
        NSArray        *values      = [value componentsSeparatedByString:@","];
        NSMutableArray *res         = [[NSMutableArray alloc] init];

        for (NSString *value in values)
        {
            NSString *trimmed = [value stringByTrimmingCharactersInSet:whitespaces];
            NSNumber *payload = [NSNumber numberWithFloat:[trimmed floatValue]];

            [res addObject:payload];
        }

        if (res.count < 3)
        {
            return nil;
        }

        CGFloat r = [[res objectAtIndex:0] floatValue] / 255.0f;
        CGFloat g = [[res objectAtIndex:1] floatValue] / 255.0f;
        CGFloat b = [[res objectAtIndex:2] floatValue] / 255.0f;

        return [UIColor colorWithRed:r green:g blue:b alpha:1.0f];
    }

    return nil;
}

@end
