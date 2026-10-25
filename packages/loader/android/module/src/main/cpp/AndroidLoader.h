#pragma once

#include <deque>
#include <functional>
#include <jni.h>
#include <jsi/jsi.h>
#include <memory>
#include <mutex>
#include <optional>
#include <string>

#include "LoaderAddons.h"
#include "LoaderHotReload.h"
#include "LoaderPipeline.h"
#include "LoaderSettings.h"
#include "LoaderUpdater.h"
#include "NativePluginRuntime.h"

namespace unbound::android {
struct JavaCallbacks {
    jclass    bridgeClass              = nullptr;
    jmethodID scheduleRuntime          = nullptr;
    jmethodID scheduleMain             = nullptr;
    jmethodID isMainThread             = nullptr;
    jmethodID lookupViews              = nullptr;
    jmethodID snapshotViews            = nullptr;
    jmethodID measureView              = nullptr;
    jmethodID setViewFrame             = nullptr;
    jmethodID mountView                = nullptr;
    jmethodID updateView               = nullptr;
    jmethodID unmountView              = nullptr;
    jmethodID javaGetClass             = nullptr;
    jmethodID javaClassName            = nullptr;
    jmethodID javaConstruct            = nullptr;
    jmethodID javaRespondsTo           = nullptr;
    jmethodID javaInvoke               = nullptr;
    jmethodID javaGetField             = nullptr;
    jmethodID javaSetField             = nullptr;
    jmethodID javaRelease              = nullptr;
    jmethodID hooksInstall             = nullptr;
    jmethodID hooksRemove              = nullptr;
    jmethodID runtimeReplaced          = nullptr;
    jmethodID javaBatch                = nullptr;
    jmethodID javaCreateAssociationKey = nullptr;
    jmethodID javaGetAssociatedObject  = nullptr;
    jmethodID javaSetAssociatedObject  = nullptr;
    jmethodID fabricMount              = nullptr;
    jmethodID fabricUpdate             = nullptr;
    jmethodID fabricUnmount            = nullptr;
    jmethodID fabricSetSize            = nullptr;
    jmethodID fabricSetFrame           = nullptr;
    jmethodID fabricMeasure            = nullptr;
    jmethodID fetchText                = nullptr;
    jmethodID download                 = nullptr;
    jmethodID devServerHost            = nullptr;
    jmethodID isServing                = nullptr;
    jmethodID availableFonts           = nullptr;
    jmethodID appFonts                 = nullptr;
    jmethodID appFontBytes             = nullptr;
    jmethodID alert                    = nullptr;
    jmethodID onBundleExecuted         = nullptr;
};

struct LoaderConfiguration {
    std::string    documents;
    nlohmann::json bootstrapScripts = nlohmann::json::object();
    std::string    origin;
    uint32_t       bytecodeVersion = 0;
    nlohmann::json platformInfo    = nlohmann::json::object();
};

class AndroidLoader : public loader::LoaderHost,
                      public loader::native::NativePluginExecutor,
                      public std::enable_shared_from_this<AndroidLoader>
{
public:
    AndroidLoader(LoaderConfiguration configuration, JavaCallbacks callbacks);

    void start();
    void onLoadJSBundle();
    void onJSBundleLoaded();
    void onRuntimeCreated(facebook::jsi::Runtime &runtime);
    void drainMainWork();
    void drainRuntimeWork(facebook::jsi::Runtime &runtime);

    loader::SettingsStore &settings();
    std::string            toolbox(const std::string &action, const std::string &argument);
    std::string            resolveFont(const std::string &family);
    std::string            themeColorsJSON(const std::string &themeId);
    std::shared_ptr<loader::HotReloadController> hotReload();

    void runOnRuntime(std::function<void(facebook::jsi::Runtime &)> work) override;
    bool isMainThread() override;
    void runOnMain(std::function<void()> work) override;
    void runAfter(double seconds, std::function<void()> work) override;
    void runInBackground(std::function<void()> work) override;
    std::optional<std::string> resource(const std::string &name) override;
    std::optional<std::string> resolveUpdateURL() override;
    uint32_t                   runtimeBytecodeVersion() override;
    loader::PreloadPayload     preloadPayload() override;
    void                       installNativeModules(facebook::jsi::Runtime &runtime) override;
    void                       onAddonsPrepared() override;
    void                       onBundleExecuted() override;
    void                       alert(const std::string &message) override;

private:
    std::optional<std::string> fetchText(const std::string &url, double timeoutSeconds);
    std::optional<loader::DownloadResult>
                               download(const std::string &url, const std::string &destination,
                                        const std::map<std::string, std::string> &headers,
                                        const loader::DownloadPolicy             &policy);
    nlohmann::json             availableFonts();
    const nlohmann::json      &systemFonts();
    nlohmann::json             appFonts();
    nlohmann::json             fontCatalog();
    std::optional<std::string> devServerHost();
    bool                       isServing(const std::string &url, double timeoutSeconds);

    LoaderConfiguration                                       configuration_;
    JavaCallbacks                                             callbacks_;
    loader::SettingsStore                                     settings_;
    std::unique_ptr<loader::BundleUpdater>                    updater_;
    std::unique_ptr<loader::LoaderPipeline>                   pipeline_;
    std::shared_ptr<loader::HotReloadController>              hotReload_;
    std::mutex                                                queueMutex_;
    std::deque<std::function<void(facebook::jsi::Runtime &)>> queue_;
    std::mutex                                                mainQueueMutex_;
    std::deque<std::function<void()>>                         mainQueue_;
    loader::AddonState                                        addons_;
    std::mutex                                                systemFontsMutex_;
    std::optional<nlohmann::json>                             systemFonts_;
};

std::shared_ptr<AndroidLoader> currentLoader();
void                           setCurrentLoader(std::shared_ptr<AndroidLoader> loader);
}
