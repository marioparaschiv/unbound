#import "Unbound.h"

#import <jsi/jsi.h>
#import <substrate.h>

#import "AddonsCore.h"
#import "CoreBridge.h"
#import "CoreConversions.h"
#import "Discord.h"
#import "HotReload.h"
#include "LoaderBootstrap.h"
#include "LoaderBrowserLogin.h"
#include "LoaderDiagnostics.h"
#include "LoaderFonts.h"
#import "LoaderJSI.h"
#import "LoaderPipeline.h"
#import "LoaderShared.h"
#import "NativePlatform.h"
#import "NativePluginBridge.h"
#import "RCTHost.h"
#import "SettingsCore.h"
#import "UpdaterCore.h"

using unbound::ios::toNSString;
using unbound::ios::toStdString;

using namespace facebook;

@interface NSObject (RuntimeExecutor)
- (void)callFunctionOnBufferedRuntimeExecutor:
    (std::function<void(facebook::jsi::Runtime &)> &&)executor;
@end

#pragma mark - Pre/post bundle injection

static jsi::Runtime *gRuntime  = nullptr;
static __weak id     gInstance = nil;

static loader::browserlogin::PendingLogin &pendingBrowserLogin(void)
{
    static loader::browserlogin::PendingLogin pending;
    return pending;
}

static loader::LoaderPipeline &pipeline(void);

BOOL UnboundBundleIsReady(void)
{
    return pipeline().isBundleReady();
}

static void applyPendingBrowserLogin(void)
{
    id                         instance = gInstance;
    std::optional<std::string> pending =
        pendingBrowserLogin().begin(instance && UnboundBundleIsReady());
    if (!pending)
    {
        return;
    }

    std::string tokenValue = *pending;

    [instance callFunctionOnBufferedRuntimeExecutor:[tokenValue](jsi::Runtime &runtime) {
        BOOL applied = NO;
        if (auto login = loader::bootstrap::function(runtime, loader::bootstrap::kBrowserLogin))
        {
            try
            {
                login->call(runtime, jsi::String::createFromUtf8(runtime, tokenValue));
                applied = YES;
            }
            catch (const std::exception &error)
            {
                [Logger error:LOG_CATEGORY_DEFAULT
                       format:@"Browser login failed. (%s)", error.what()];
            }
        }
        dispatch_async(dispatch_get_main_queue(), ^{
            switch (pendingBrowserLogin().finish(tokenValue, applied))
            {
                case loader::browserlogin::ApplyResult::Applied:
                    [Logger info:LOG_CATEGORY_DEFAULT
                          format:@"Browser login token application scheduled."];
                    return;
                case loader::browserlogin::ApplyResult::Retry:
                    [Logger error:LOG_CATEGORY_DEFAULT
                           format:@"Browser login JavaScript application failed (attempt %u).",
                                  pendingBrowserLogin().failures()];
                    dispatch_after(dispatch_time(DISPATCH_TIME_NOW,
                                                 (int64_t) (loader::browserlogin::kRetrySeconds *
                                                            NSEC_PER_SEC)),
                                   dispatch_get_main_queue(), ^{ applyPendingBrowserLogin(); });
                    return;
                case loader::browserlogin::ApplyResult::GaveUp:
                    [Logger error:LOG_CATEGORY_DEFAULT
                           format:@"Browser login JavaScript application failed (attempt %u).",
                                  pendingBrowserLogin().failures()];
                    [Utilities alert:@(loader::browserlogin::kRetryFailedMessage)
                               title:@(loader::browserlogin::kFailedTitle)];
                    return;
            }
        });
    }];
}

void CompleteBrowserLogin(NSString *token)
{
    if (pendingBrowserLogin().submit(toStdString(token)))
    {
        applyPendingBrowserLogin();
    }
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
        nlohmann::json availableFonts = loader::fontNamesOf(UnboundPlatformFonts());
        return loader::makePreloadPayload(UnboundSettingsStore(), UnboundAddonState(),
                                          availableFonts,
                                          toStdString([Utilities getCurrentDylibName]));
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
        [HotReload observe];
        dispatch_async(dispatch_get_main_queue(), ^{ applyPendingBrowserLogin(); });
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
        shared = new loader::LoaderPipeline(std::make_shared<IOSLoaderHost>(),
                                            UnboundUpdaterSettings(), UnboundBundleUpdater());
    });
    return *shared;
}

static void prepareLoading(id instance)
{
    if (!instance)
    {
        return;
    }

    gInstance = instance;
    dispatch_async(dispatch_get_main_queue(), ^{ [DevOverlay refreshOverlay]; });
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
static BOOL                    gRCTInstanceHooksInstalled    = NO;

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

    MSHookMessageEx(instanceClass, @selector(_loadJSBundle:), (IMP) loadJSBundle,
                    (IMP *) &gOriginalLoadJSBundle);
    MSHookMessageEx(instanceClass, @selector(_loadScriptFromSource:), (IMP) loadScriptFromSource,
                    (IMP *) &gOriginalLoadScriptFromSource);
    gRCTInstanceHooksInstalled =
        gOriginalLoadJSBundle != NULL && gOriginalLoadScriptFromSource != NULL;
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

    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 0.1 * NSEC_PER_SEC), dispatch_get_main_queue(),
                   ^{ retryRCTInstanceHooks(attempt + 1); });
}

%ctor
{
    [CoreBridge installLogging];
    [FileSystem init];
    [Settings init];
    loader::registerNativePlatformProvider();

    if (![Utilities isRNNewArchEnabled])
    {
        dispatch_async(dispatch_get_main_queue(),
                       ^{ [Utilities alert:[CoreBridge incompatibleHostMessage]]; });
        return;
    }

#if ATTESTATION_ENABLED
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        BOOL verified = [Utilities isVerifiedBuild];
        dispatch_async(dispatch_get_main_queue(), ^{
            if (!verified)
            {
                [Logger error:LOG_CATEGORY_DEFAULT
                       format:@"Embedded tweak attestation verification failed"];
                [Utilities alert:@(loader::diagnostics::kAttestationWarningMessage)
                           title:@(loader::diagnostics::kAttestationWarningTitle)
                         timeout:loader::diagnostics::kAttestationWarningSeconds
                         warning:YES];
                return;
            }
            retryRCTInstanceHooks(0);
        });
    });
#else
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 0.1 * NSEC_PER_SEC), dispatch_get_main_queue(),
                   ^{ retryRCTInstanceHooks(0); });
#endif

    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 1.0 * NSEC_PER_SEC), dispatch_get_main_queue(),
                   ^{
                       if (![Utilities isLoadedWithElleKit])
                       {
                           [Utilities alert:@(loader::diagnostics::kElleKitWarningMessage)
                                      title:@(loader::diagnostics::kElleKitWarningTitle)];
                       }
                   });

    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, 1.5 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
            if (!loader::diagnostics::needsExtensionCheck([Utilities isAppStoreApp],
                                                          [Utilities isTestFlightApp],
                                                          [Utilities isTrollStoreApp]))
            {
                return;
            }

            [Logger info:LOG_CATEGORY_DEFAULT
                  format:@"App is sideloaded, checking for critical extensions"];

            BOOL hasOpenInDiscord =
                [Utilities hasAppExtension:@(loader::diagnostics::kSafariExtensionName)];
            BOOL hasShare = [Utilities hasAppExtension:@(loader::diagnostics::kShareExtensionName)];

            for (const auto &warning :
                 loader::diagnostics::missingExtensionWarnings(hasOpenInDiscord, hasShare))
            {
                [Logger info:LOG_CATEGORY_DEFAULT format:@"%@", toNSString(warning.logMessage)];
                [Utilities alert:toNSString(warning.message) title:toNSString(warning.title)];
            }

            if (hasOpenInDiscord && hasShare)
            {
                [Logger info:LOG_CATEGORY_DEFAULT format:@"All critical extensions present"];
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
