#import <AVFoundation/AVFoundation.h>
#import <CommonCrypto/CommonCrypto.h>
#import <Security/Security.h>
#import <dlfcn.h>
#import <mach-o/dyld.h>
#import <mach-o/fat.h>
#import <mach-o/loader.h>
#import <rootless.h>
#import <sys/utsname.h>

#import "Discord.h"
#import "FileSystem.h"
#import "Settings.h"
#import "Unbound.h"
#import "HermesBytecode.h"

#define CS_DEBUGGED 0x10000000
int csops(pid_t pid, unsigned int ops, void *useraddr, size_t usersize);

extern NSString *const TROLL_STORE_PATH;
extern NSString *const TROLL_STORE_LITE_PATH;

@interface Utilities : NSObject
{
    NSString *bundle;
}

+ (NSString *)getBundlePath;

+ (NSData *)getResource:(NSString *)file data:(BOOL)data ext:(NSString *)ext;
+ (NSString *)getResource:(NSString *)file ext:(NSString *)ext;

+ (NSString *)getResource:(NSString *)file;

+ (void)alert:(NSString *)message
        title:(NSString *)title
      buttons:(NSArray<UIAlertAction *> *)buttons;
+ (void)alert:(NSString *)message title:(NSString *)title;
+ (void)alert:(NSString *)message;

+ (void)alert:(NSString *)message
        title:(NSString *)title
      buttons:(NSArray<UIAlertAction *> *)buttons
      timeout:(NSInteger)timeout;

+ (void)alert:(NSString *)message title:(NSString *)title timeout:(NSInteger)timeout;

+ (void)alert:(NSString *)message
        title:(NSString *)title
      buttons:(NSArray<UIAlertAction *> *)buttons
      warning:(BOOL)warning;

+ (void)alert:(NSString *)message title:(NSString *)title warning:(BOOL)warning;

+ (void)alert:(NSString *)message
        title:(NSString *)title
      buttons:(NSArray<UIAlertAction *> *)buttons
          tts:(BOOL)tts;

+ (void)alert:(NSString *)message title:(NSString *)title tts:(BOOL)tts;

+ (void)alert:(NSString *)message
        title:(NSString *)title
      buttons:(NSArray<UIAlertAction *> *)buttons
      warning:(BOOL)warning
          tts:(BOOL)tts;

+ (void)alert:(NSString *)message title:(NSString *)title warning:(BOOL)warning tts:(BOOL)tts;

+ (void)alert:(NSString *)message
        title:(NSString *)title
      buttons:(NSArray<UIAlertAction *> *)buttons
      timeout:(NSInteger)timeout
      warning:(BOOL)warning;

+ (void)alert:(NSString *)message
        title:(NSString *)title
      timeout:(NSInteger)timeout
      warning:(BOOL)warning;

+ (void)alert:(NSString *)message
        title:(NSString *)title
      buttons:(NSArray<UIAlertAction *> *)buttons
      timeout:(NSInteger)timeout
      warning:(BOOL)warning
          tts:(BOOL)tts;

+ (void)alert:(NSString *)message
        title:(NSString *)title
      timeout:(NSInteger)timeout
      warning:(BOOL)warning
          tts:(BOOL)tts;

+ (void)alertWarning:(NSString *)message title:(NSString *)title timeout:(NSInteger)timeout;

+ (void)speakAlertContent:(NSString *)title message:(NSString *)message;

+ (UIAlertAction *)createDiscordInviteButton;

+ (void)presentAlert:(NSString *)message
               title:(NSString *)title
             buttons:(NSArray<UIAlertAction *> *)buttons
             timeout:(NSInteger)timeout
             warning:(BOOL)warning
                 tts:(BOOL)tts;

+ (id)parseJSON:(NSData *)data;

+ (NSData *)fetchDataWithTimeout:(NSURL *)url timeout:(NSTimeInterval)timeout;

+ (dispatch_source_t)createDebounceTimer:(double)delay
                                   queue:(dispatch_queue_t)queue
                                   block:(dispatch_block_t)block;
+ (void)runOnMainThread:(dispatch_block_t)block;

+ (uint32_t)getHermesBytecodeVersion;
+ (BOOL)isHermesBytecode:(NSData *)data;
+ (BOOL)isAppStoreApp;
+ (BOOL)isTestFlightApp;
+ (BOOL)isTrollStoreApp;
+ (NSString *)getTrollStoreVariant;
+ (BOOL)isLiveContainerApp;
+ (BOOL)isSystemApp;
+ (BOOL)isJailbroken;

+ (NSString *)getAppSource;

+ (NSString *)getDeviceModel;
+ (NSString *)getiOSVersionString;
+ (BOOL)isVPhone;
+ (NSString *)getVirtualDeviceHostAddress;

+ (BOOL)isLoadedWithElleKit;

+ (BOOL)hasAppExtension:(NSString *)extensionName;

+ (NSString *)getCurrentDylibName;

+ (BOOL)isJITAvailable;

+ (BOOL)isRNNewArchEnabled;

+ (NSString *)JSONString:(NSString *)str;

+ (NSString *)JSONStringFromObject:(id)object
                           options:(NSJSONWritingOptions)opts
                          fallback:(NSString *)fallback;

+ (UIColor *)parseColor:(NSString *)color;

+ (UIWindow *)keyWindow;
+ (UIViewController *)topViewController;

+ (BOOL)isRecoveryModeEnabled;

+ (void)setBundleUpdater:(id)bundleUpdater;
+ (void)reloadApp;

@end

#import "Utilities+CodeSignature.h"
#import "Utilities+DynamicIsland.h"
