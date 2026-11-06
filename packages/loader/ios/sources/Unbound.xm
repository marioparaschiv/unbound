#import "Unbound.h"

#import <jsi/jsi.h>
#import <notify.h>

#import "AddonsCore.h"
#import "CoreBridge.h"
#import "CoreConversions.h"
#import "Discord.h"
#import "HomeScreenIcon.h"
#import "HotReload.h"
#import "IconIPA.h"
#include "LoaderBootstrap.h"
#include "LoaderBrowserLogin.h"
#include "LoaderDiagnostics.h"
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

    bool scheduled = loader::runOnNativePluginRuntime([tokenValue](jsi::Runtime &runtime) {
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
    });
    if (!scheduled)
    {
        // The instance is reloading; onBundleExecuted retries once the next runtime is up.
        pendingBrowserLogin().finish(tokenValue, NO);
    }
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

    static std::string iconImageURL(NSArray<NSString *> *files)
    {
        NSBundle *bundle = NSBundle.mainBundle;
        for (NSString *file in files)
        {
            for (NSString *suffix in @[ @"@3x.png", @"@2x.png", @".png" ])
            {
                NSString *path = [bundle.bundlePath
                    stringByAppendingPathComponent:[file stringByAppendingString:suffix]];
                if ([NSFileManager.defaultManager fileExistsAtPath:path])
                {
                    return toStdString([NSURL fileURLWithPath:path].absoluteString);
                }
            }
        }
        return "";
    }

    static NSDictionary *installedInfo()
    {
        NSString *path =
            [NSBundle.mainBundle.bundlePath stringByAppendingPathComponent:@"Info.plist"];
        return [NSDictionary dictionaryWithContentsOfFile:path]
                   ?: NSBundle.mainBundle.infoDictionary;
    }

    static NSString *iconName(NSString *iconId, NSDictionary *names)
    {
        if ([iconId isEqualToString:@"UnboundIcon"])
        {
            return @"Unbound";
        }
        NSString *name = names[iconId];
        return [name isKindOfClass:NSString.class] && name.length ? name : iconId;
    }

    static nlohmann::json declaredUnboundIcons()
    {
        nlohmann::json icons     = nlohmann::json::array();
        NSDictionary  *info      = installedInfo();
        NSDictionary  *alternate = info[@"CFBundleIcons"][@"CFBundleAlternateIcons"];
        NSDictionary  *names     = info[@"UnboundIconNames"];
        for (NSString *iconId in [alternate.allKeys sortedArrayUsingSelector:@selector(compare:)])
        {
            if (![iconId hasPrefix:@"Unbound"])
            {
                continue;
            }
            std::string image = iconImageURL(alternate[iconId][@"CFBundleIconFiles"]);
            if (image.empty())
            {
                continue;
            }
            icons.push_back({{"id", toStdString(iconId)},
                             {"name", toStdString(iconName(iconId, names))},
                             {"image", image}});
        }
        return icons;
    }

    static BOOL canPatchBundle()
    {
        return
            [NSFileManager.defaultManager fileExistsAtPath:@"/var/jb/usr/libexec/unbound-bundle"];
    }

    loader::UnboundNativeProvider unboundNativeProvider() override
    {
        loader::UnboundNativeProvider provider = loader::makeUnboundNativeProvider(
            UnboundAddonState(), UnboundFonts(), toStdString([Utilities getCurrentDylibName]),
            runtimeBytecodeVersion(), toStdString(FileSystem.documents), UnboundDownload);
        // The scan finishes before the call returns, so the client's next `getThemes` lists the
        // theme; recolouring runs on main.
        provider.getAppIcons = [] {
            return declaredUnboundIcons();
        };
        if (canPatchBundle())
        {
            provider.syncAppIcons = [] {
                notify_post("app.unbound.bundle.sync");
            };
        }
        provider.installHomeScreenIcon = [](const std::string &name, const std::string &imagePath) {
            return UBInstallHomeScreenIcon(toNSString(name), toNSString(imagePath)) == YES;
        };
        provider.buildIconIPA = [] {
            NSString *documents =
                NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES)
                    .firstObject;
            return toStdString(UBBuildIconIPA(documents) ?: @"");
        };
        provider.rescanThemes = [] {
            [CoreBridge rescanThemes];
            dispatch_async(dispatch_get_main_queue(), ^{ [Themes refreshThemes]; });
        };
        return provider;
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

    void reload() override
    {
        [Utilities reloadApp];
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

#pragma mark - Hooks

%hook RCTHost

- (void)instance:(id)instance didInitializeRuntime:(facebook::jsi::Runtime &)runtime
{
    gRuntime = &runtime;
    [Logger info:LOG_CATEGORY_DEFAULT format:@"RCTHost didInitializeRuntime reached."];
    loader::setNativePluginFabricHost(self);
    prepareLoading(instance);
    // The last point before Discord's bundle is read, so Unbound's bundle runs first.
    pipeline().onRuntimeCreated(runtime);
    %orig;
}

%end

%hook RCTInstance

- (void)invalidate
{
    // Before %orig: it queues the JS-thread block that resets the ReactInstance.
    loader::retireNativePluginRuntimeExecutor(self);
    %orig;
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

%ctor
{
    [CoreBridge installLogging];
    [FileSystem init];
    [CoreBridge openLogFile];
    [Settings init];
    loader::registerNativePlatformProvider();

    if (![Utilities isRNNewArchEnabled])
    {
        dispatch_async(dispatch_get_main_queue(),
                       ^{ [Utilities alert:[CoreBridge incompatibleHostMessage]]; });
        return;
    }

    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0),
                   ^{ [CoreBridge prescanAddons]; });

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
            }
        });
    });
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
