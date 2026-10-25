#import "CoreConversions.h"
#import <jsi/jsi.h>

#import "AddonsCore.h"
#import "CoreBridge.h"
#import "Discord.h"
#import "HotReload.h"
#import "JSI.h"
#import "LoaderJSI.h"
#import "LoaderPipeline.h"
#import "LoaderShared.h"
#import "NativePluginBridge.h"
#import "RCTHost.h"
#import "SettingsCore.h"
#import "Unbound.h"
#import "NativePlatform.h"
#import "UpdaterCore.h"

#import <substrate.h>

#include <atomic>

using unbound::ios::toNSString;
using unbound::ios::toStdString;

using namespace facebook;

@interface NSObject (RuntimeExecutor)
- (void)callFunctionOnBufferedRuntimeExecutor:
    (std::function<void(facebook::jsi::Runtime &)> &&)executor;
@end

#pragma mark - Pre/post bundle injection

static jsi::Runtime *gRuntime = nullptr;
static __weak id gInstance = nil;
static NSString *gPendingBrowserLoginToken = nil;
static BOOL      gBrowserLoginIsApplying    = NO;
static BOOL      gBundleIsReady             = NO;
static NSUInteger gBrowserLoginFailureCount = 0;
static std::atomic_bool gLoaderPrepared{false};

static void applyPendingBrowserLogin(void)
{
    id          instance = gInstance;
    NSString    *token    = gPendingBrowserLoginToken;
    if (!instance || token.length == 0 || !gBundleIsReady || gBrowserLoginIsApplying)
    {
        return;
    }

    gBrowserLoginIsApplying = YES;

    NSString *tokenJSON =
        [Utilities JSONStringFromObject:token options:NSJSONWritingFragmentsAllowed fallback:nil];
    if (!tokenJSON)
    {
        gBrowserLoginIsApplying = NO;
        return;
    }

    NSString *source = [NSString stringWithFormat:
                             @"(function(token){const apply=()=>{const metro=globalThis.unbound?.metro;if(!metro||typeof metro.findByProps!=='function')throw new Error('Metro API unavailable');let auth=metro.findByProps('getAnalyticsToken','setToken');if(!auth)auth=metro.findByProps('getToken','setToken');if(!auth||typeof auth.setToken!=='function')throw new Error('Discord authentication store unavailable');auth.setToken(token);const reload=globalThis.unbound?.native?.reload;if(typeof reload!=='function')throw new Error('Reload API unavailable');Promise.resolve(reload()).catch(()=>{});};const ready=globalThis.__runtimeReady;if(ready?.ready)apply();else if(Array.isArray(ready?.callbacks))ready.callbacks.push(apply);else apply();})(%@);",
                         tokenJSON];
    std::string script = source.UTF8String ?: "";

    [instance callFunctionOnBufferedRuntimeExecutor:[script, token](jsi::Runtime &runtime) {
        BOOL applied = loader::evaluateScript(runtime, script, "browser-login");
        dispatch_async(dispatch_get_main_queue(), ^{
            gBrowserLoginIsApplying = NO;
            if (applied)
            {
                if ([gPendingBrowserLoginToken isEqualToString:token])
                {
                    gPendingBrowserLoginToken = nil;
                }
                gBrowserLoginFailureCount = 0;
                [Logger info:LOG_CATEGORY_DEFAULT format:@"Browser login token application scheduled."];
                return;
            }

            gBrowserLoginFailureCount++;
            [Logger error:LOG_CATEGORY_DEFAULT
                   format:@"Browser login JavaScript application failed (attempt %lu).",
                          (unsigned long)gBrowserLoginFailureCount];
            if (gBrowserLoginFailureCount <= 3)
            {
                dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 0.5 * NSEC_PER_SEC),
                               dispatch_get_main_queue(), ^{ applyPendingBrowserLogin(); });
            }
            else
            {
                [Utilities alert:@"Discord could not finish browser login. Please try again."
                           title:@"Could Not Finish Login"];
            }
        });
    }];
}

void CompleteBrowserLogin(NSString *token)
{
    if (token.length == 0)
    {
        return;
    }

    gPendingBrowserLoginToken = [token copy];
    gBrowserLoginFailureCount = 0;
    applyPendingBrowserLogin();
}

class IOSLoaderHost final : public loader::LoaderHost
{
public:
    void runOnRuntime(std::function<void(jsi::Runtime &)> work) override
    {
        id instance = gInstance;
        if (instance)
        {
            [instance callFunctionOnBufferedRuntimeExecutor:std::move(work)];
        }
    }

    void runAfter(double seconds, std::function<void()> work) override
    {
        auto task = std::make_shared<std::function<void()>>(std::move(work));
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t) (seconds * NSEC_PER_SEC)),
                       dispatch_get_main_queue(), ^{ (*task)(); });
    }

    void runInBackground(std::function<void()> work) override
    {
        auto task = std::make_shared<std::function<void()>>(std::move(work));
        dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{ (*task)(); });
    }

    std::optional<std::string> resource(const std::string &name) override
    {
        NSData *data = [Utilities getResource:toNSString(name) data:true ext:@"js"];
        if (data.length == 0)
        {
            return std::nullopt;
        }
        return std::string(static_cast<const char *>(data.bytes), data.length);
    }

    std::optional<std::string> resolveUpdateURL() override
    {
        return UnboundUpdateURL();
    }

    uint32_t runtimeBytecodeVersion() override
    {
        return [CoreBridge mainBundleBytecodeVersion];
    }

    loader::PreloadPayload preloadPayload() override
    {
        nlohmann::json availableFonts = nlohmann::json::array();
        for (NSString *family in [Fonts getAvailableFonts])
        {
            availableFonts.push_back(toStdString(family));
        }
        return loader::makePreloadPayload(UnboundSettingsStore(), UnboundAddonState(), availableFonts,
                                          toStdString([Utilities getCurrentDylibName]), toStdString(PACKAGE_VERSION));
    }

    void installNativeModules(jsi::Runtime &runtime) override
    {
        loader::setNativePluginRuntimeExecutor(gInstance);
        loader::registerNativePluginBridge(runtime);
        loader::registerNativePlatform(runtime);
    }

    void onAddonsPrepared() override
    {
        [CoreBridge scanAddons];
        [Themes init];
        [Fonts init];
    }

    void onBundleExecuted() override
    {
        dispatch_async(dispatch_get_main_queue(), ^{
            gBundleIsReady = YES;
            applyPendingBrowserLogin();
        });
    }

    void alert(const std::string &message) override
    {
        NSString *text = toNSString(message);
        dispatch_async(dispatch_get_main_queue(), ^{ [Utilities alert:text]; });
    }
};

static loader::LoaderPipeline &pipeline(void)
{
    static loader::LoaderPipeline *shared = nullptr;
    static dispatch_once_t         onceToken;
    dispatch_once(&onceToken, ^{
        shared = new loader::LoaderPipeline(std::make_shared<IOSLoaderHost>(), UnboundUpdaterSettings(),
                                            UnboundBundleUpdater());
    });
    return *shared;
}

static void prepareLoading(id instance)
{
    if (!instance)
    {
        return;
    }

    gInstance      = instance;
    gBundleIsReady = NO;
    dispatch_async(dispatch_get_main_queue(), ^{ [DevOverlay refreshOverlay]; });

    if ([CoreBridge preferenceEnabled:@"loader-enabled"] && !gLoaderPrepared.exchange(true))
    {
        [HotReload observe];
    }
    pipeline().prepare();
}

static void enqueueBundle(id instance)
{
    gInstance = instance;
    pipeline().enqueueBundle();
}

#pragma mark - Hooks

%hook RCTHost

- (void)instance:(id)instance didInitializeRuntime:(facebook::jsi::Runtime &)runtime
{
    gRuntime = &runtime;
    [Logger info:LOG_CATEGORY_DEFAULT format:@"RCTHost didInitializeRuntime reached."];
    pipeline().onRuntimeCreated(runtime);
    loader::setNativePluginFabricHost(self);
    id hostInstance = instance;
    prepareLoading(hostInstance);
    %orig;
    if ([hostInstance respondsToSelector:@selector(callFunctionOnBufferedRuntimeExecutor:)])
    {
        [Logger info:LOG_CATEGORY_DEFAULT format:@"RCTHost runtime instance is ready."];
        enqueueBundle(hostInstance);
    }
    else
    {
        [Logger error:LOG_CATEGORY_DEFAULT
               format:@"RCTHost runtime instance has no buffered executor."];
    }
}

%end

%hook DCDBundleUpdaterManager

- (id)init
{
    id instance = %orig;
    if (instance)
    {
        [Utilities setBundleUpdater:instance];
        [Logger info:LOG_CATEGORY_DEFAULT format:@"DCDBundleUpdaterManager captured."];
    }
    return instance;
}

%end

typedef void (*LoadJSBundleIMP)(id, SEL, NSURL *);
typedef void (*LoadScriptFromSourceIMP)(id, SEL, id);

static LoadJSBundleIMP         gOriginalLoadJSBundle         = NULL;
static LoadScriptFromSourceIMP gOriginalLoadScriptFromSource = NULL;
static BOOL                    gRCTInstanceHooksInstalled   = NO;

static void loadJSBundle(id self, SEL selector, NSURL *sourceURL)
{
    prepareLoading(self);
    if (gOriginalLoadJSBundle)
    {
        gOriginalLoadJSBundle(self, selector, sourceURL);
    }
}

static void loadScriptFromSource(id self, SEL selector, id source)
{
    if (gOriginalLoadScriptFromSource)
    {
        gOriginalLoadScriptFromSource(self, selector, source);
    }

    enqueueBundle(self);
}

static BOOL installRCTInstanceHooks(void)
{
    if (gRCTInstanceHooksInstalled)
    {
        return YES;
    }

    Class instanceClass = NSClassFromString(@"RCTInstance");
    if (!instanceClass || !class_getInstanceMethod(instanceClass, @selector(_loadJSBundle:)) ||
        !class_getInstanceMethod(instanceClass, @selector(_loadScriptFromSource:)))
    {
        return NO;
    }

    MSHookMessageEx(instanceClass,
                    @selector(_loadJSBundle:),
                    (IMP)loadJSBundle,
                    (IMP *)&gOriginalLoadJSBundle);
    MSHookMessageEx(instanceClass,
                    @selector(_loadScriptFromSource:),
                    (IMP)loadScriptFromSource,
                    (IMP *)&gOriginalLoadScriptFromSource);
    gRCTInstanceHooksInstalled = gOriginalLoadJSBundle != NULL &&
                                 gOriginalLoadScriptFromSource != NULL;
    return gRCTInstanceHooksInstalled;
}

static void retryRCTInstanceHooks(NSUInteger attempt)
{
    if (installRCTInstanceHooks() || attempt >= 300)
    {
        if (!gRCTInstanceHooksInstalled)
        {
            [Logger error:LOG_CATEGORY_DEFAULT format:@"RCTInstance hooks could not be installed."];
        }
        return;
    }

    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 0.1 * NSEC_PER_SEC),
                   dispatch_get_main_queue(),
                   ^{ retryRCTInstanceHooks(attempt + 1); });
}

%ctor
{
    [CoreBridge installLogging];
    [FileSystem init];
    [Settings init];

    if (![Utilities isRNNewArchEnabled])
    {
        dispatch_async(dispatch_get_main_queue(), ^{
            [Utilities
                alert:@"This version of Discord is incompatible with this version of the Tweak."];
        });
        return;
    }

#if ATTESTATION_ENABLED
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        BOOL verified = [Utilities isVerifiedBuild];
        dispatch_async(dispatch_get_main_queue(), ^{
            if (!verified)
            {
                [Logger error:LOG_CATEGORY_DEFAULT format:@"Embedded tweak attestation verification failed"];
                [Utilities alert:@"The injected tweak failed Unbound's embedded integrity verification. "
                                 @"You cannot be sure that this is free of malware. "
                                 @"If this app was obtained via 'cypwn' or similar sources "
                                 @"we heavily recommend you uninstall it immediately."
                           title:@"⚠️ SECURITY WARNING"
                         timeout:15
                         warning:YES];
                return;
            }
            retryRCTInstanceHooks(0);
        });
    });
#else
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 0.1 * NSEC_PER_SEC),
                   dispatch_get_main_queue(),
                   ^{ retryRCTInstanceHooks(0); });
#endif

    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 1.0 * NSEC_PER_SEC), dispatch_get_main_queue(),
                   ^{
                       if (![Utilities isLoadedWithElleKit])
                       {
                           [Utilities alert:@"Warning: Tweak is not loaded through ElleKit. "
                                            @"Functionality is not guaranteed."
                                      title:@"Runtime Detection"];
                       }
                   });

    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, 1.5 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
            if (![Utilities isAppStoreApp] && ![Utilities isTestFlightApp] &&
                ![Utilities isTrollStoreApp])
            {
                [Logger info:LOG_CATEGORY_DEFAULT
                      format:@"App is sideloaded, checking for critical extensions"];

                BOOL hasOpenInDiscord = [Utilities hasAppExtension:@"OpenInDiscord"];
                BOOL hasShare         = [Utilities hasAppExtension:@"Share"];

                if (!hasOpenInDiscord)
                {
                    [Logger info:LOG_CATEGORY_DEFAULT
                          format:@"OpenInDiscord extension missing, showing alert"];
                    [Utilities alert:@"The Safari extension (OpenInDiscord.appex) is missing. "
                                     @"You won't be able to open Discord links directly in the app."
                               title:@"Missing Safari Extension"];
                }

                if (!hasShare)
                {
                    [Logger info:LOG_CATEGORY_DEFAULT
                          format:@"Share extension missing, showing alert"];
                    [Utilities alert:@"The Share extension (Share.appex) is missing. "
                                     @"You won't be able to receive shared media and files "
                                     @"from other apps through the share sheet."
                               title:@"Missing Share Extension"];
                }

                if (hasOpenInDiscord && hasShare)
                {
                    [Logger info:LOG_CATEGORY_DEFAULT format:@"All critical extensions present"];
                }
            }
        });

    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 2.0 * NSEC_PER_SEC), dispatch_get_main_queue(),
                   ^{
                       [Utilities initializeDynamicIslandOverlay];
#ifdef DEBUG
                       [DevOverlay showDevelopmentBuildBanner];
#endif
                   });
}
