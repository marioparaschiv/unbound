#import "Unbound.h"

#import <jsi/jsi.h>

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
#include "LoaderToolbox.h"
#import "NativePlatform.h"
#import "NativePluginBridge.h"
#import "RCTHost.h"
#import "SettingsCore.h"
#import "UpdateBanner.h"
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

BOOL UnboundBundleIsReady(void)
{
    return UnboundLoader()->isBundleReady();
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

    void runAfter(double seconds, std::function<void()> work) override
    {
        auto task = std::make_shared<std::function<void()>>(std::move(work));
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t) (seconds * NSEC_PER_SEC)),
                       dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{ (*task)(); });
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

    uint32_t runtimeBytecodeVersion() override
    {
        return [CoreBridge mainBundleBytecodeVersion];
    }

    std::optional<std::string> fetchText(const std::string &url, double timeoutSeconds) override
    {
        return UnboundFetchText(url, timeoutSeconds);
    }

    std::optional<loader::DownloadResult>
    download(const std::string &url, const std::string &destination,
             const std::map<std::string, std::string> &headers,
             const loader::DownloadPolicy             &policy) override
    {
        return UnboundDownload(url, destination, headers, policy);
    }

    bool isServing(const std::string &url, double timeoutSeconds) override
    {
        return UnboundIsServing(url, timeoutSeconds);
    }

    std::optional<std::string> devServerHost() override
    {
        NSString *host = [Utilities getVirtualDeviceHostAddress];
        return host ? std::optional<std::string>(toStdString(host)) : std::nullopt;
    }

    std::shared_ptr<loader::HotReloadTransport> hotReloadTransport() override
    {
        return UnboundHotReloadTransport();
    }

    nlohmann::json systemFonts() override
    {
        return UnboundPlatformFontEntries();
    }

    // Text laid out from now on, such as after the restart the client offers, uses the new table.
    void onFontsChanged() override
    {
        dispatch_async(dispatch_get_main_queue(), ^{ [Fonts apply]; });
    }

    // The rescan finishes before the call returns; recolouring runs on main.
    void onThemesRescanned() override
    {
        dispatch_async(dispatch_get_main_queue(), ^{ [Themes refreshThemes]; });
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

    void extendNativeProvider(loader::UnboundNativeProvider &provider) override
    {
        provider.getAppIcons = [] {
            return declaredUnboundIcons();
        };
        provider.installHomeScreenIcon = [](const std::string &name, const std::string &imagePath) {
            return UBInstallHomeScreenIcon(toNSString(name), toNSString(imagePath)) == YES;
        };
        provider.buildIconIPA = [] {
            NSString *documents =
                NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES)
                    .firstObject;
            return toStdString(UBBuildIconIPA(documents) ?: @"");
        };
    }

    void installNativeModules(jsi::Runtime &runtime) override
    {
        loader::setNativePluginRuntimeExecutor(gInstance);
        loader::registerNativePluginBridge(runtime);
    }

    void onAddonsPrepared() override
    {
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

    void crashAlert(const std::string &message) override
    {
        NSString *text = toNSString(message);
        dispatch_async(dispatch_get_main_queue(), ^{
            NSString *appVersion =
                [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
            NSString *buildNumber =
                [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"];
            NSString *discordVersion = toNSString(loader::toolbox::discordVersionLabel(
                appVersion ? std::optional<std::string>(toStdString(appVersion)) : std::nullopt,
                toStdString(buildNumber)));

            UIAlertAction *report = [UIAlertAction
                actionWithTitle:@"Report"
                          style:UIAlertActionStyleDefault
                        handler:^(UIAlertAction *action) {
                            NSString *link = [CoreBridge toolbox:@"crash-report-url"
                                                        argument:discordVersion];
                            NSURL    *url  = link.length ? [NSURL URLWithString:link] : nil;
                            if (url)
                            {
                                [[UIApplication sharedApplication] openURL:url
                                                                   options:@{}
                                                         completionHandler:nil];
                            }
                        }];
            UIAlertAction *okay   = [UIAlertAction actionWithTitle:@"Okay"
                                                             style:UIAlertActionStyleCancel
                                                           handler:nil];
            [Utilities alert:text title:@"Unbound" buttons:@[ okay, report ]];
        });
    }

    void reload() override
    {
        [Utilities reloadApp];
    }

    void showUpdateProgress(bool showing) override
    {
        if (showing)
        {
            [UpdateBanner show];
        }
        else
        {
            [UpdateBanner hide];
        }
    }
};

std::shared_ptr<loader::Loader> UnboundLoader()
{
    static std::shared_ptr<loader::Loader> shared;
    static dispatch_once_t                 onceToken;
    dispatch_once(&onceToken, ^{
        [FileSystem init];
        shared = std::make_shared<loader::Loader>(
            loader::LoaderOptions{toStdString(FileSystem.documents), "iOS",
                                  toStdString([Utilities getCurrentDylibName])},
            std::make_shared<IOSLoaderHost>(), loader::makeNativePlatformProvider());
        shared->start();
    });
    return shared;
}

static void prepareLoading(id instance)
{
    if (!instance)
    {
        return;
    }

    gInstance = instance;
    dispatch_async(dispatch_get_main_queue(), ^{ [DevOverlay refreshOverlay]; });
    UnboundLoader()->prepare();
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
    UnboundLoader()->onRuntimeCreated(runtime);
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

    if (![Utilities isRNNewArchEnabled])
    {
        dispatch_async(dispatch_get_main_queue(),
                       ^{ [Utilities alert:[CoreBridge incompatibleHostMessage]]; });
        return;
    }

    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0),
                   ^{ [CoreBridge prescanAddons]; });

    // Leaving the foreground without crashing counts the launch as healthy; a suspended app's
    // health timer would otherwise never fire before iOS ends it.
    [[NSNotificationCenter defaultCenter]
        addObserverForName:UIApplicationDidEnterBackgroundNotification
                    object:nil
                     queue:nil
                usingBlock:^(NSNotification *) {
                    dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0),
                                   ^{ UnboundLoader()->markHealthy(); });
                }];

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
