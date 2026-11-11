#pragma once

#include <atomic>
#include <deque>
#include <functional>
#include <jni.h>
#include <jsi/jsi.h>
#include <memory>
#include <mutex>
#include <optional>
#include <string>

#include "DeadlineTimer.h"
#include "Loader.h"
#include "LoaderHost.h"
#include "NativeFrameWorkQueue.h"
#include "NativePlatformBridge.h"
#include "NativePluginRuntime.h"
#include "NativeWorkQueue.h"

namespace unbound::android {
struct JavaCallbacks {
    jclass    bridgeClass              = nullptr;
    jmethodID scheduleRuntime          = nullptr;
    jmethodID scheduleMain             = nullptr;
    jmethodID scheduleMainFrame        = nullptr;
    jmethodID isMainThread             = nullptr;
    jmethodID isVerifiedBuild          = nullptr;
    jmethodID installer                = nullptr;
    jmethodID javaGetClass             = nullptr;
    jmethodID javaClassName            = nullptr;
    jmethodID javaDescribe             = nullptr;
    jmethodID javaConstruct            = nullptr;
    jmethodID javaRespondsTo           = nullptr;
    jmethodID javaInvoke               = nullptr;
    jmethodID javaPrepare              = nullptr;
    jmethodID javaInvokePrepared       = nullptr;
    jmethodID javaDisposePlan          = nullptr;
    jmethodID javaGetField             = nullptr;
    jmethodID javaSetField             = nullptr;
    jmethodID javaRelease              = nullptr;
    jmethodID javaLiveHandles          = nullptr;
    jmethodID hooksInstall             = nullptr;
    jmethodID hooksRemove              = nullptr;
    jmethodID runtimeReplaced          = nullptr;
    jmethodID javaBatch                = nullptr;
    jmethodID javaFindViews            = nullptr;
    jmethodID javaCreateAssociationKey = nullptr;
    jmethodID javaGetAssociatedObject  = nullptr;
    jmethodID javaSetAssociatedObject  = nullptr;
    jmethodID fabricMount              = nullptr;
    jmethodID fabricUpdate             = nullptr;
    jmethodID fabricUnmount            = nullptr;
    jmethodID fabricDetach             = nullptr;
    jmethodID fabricAttach             = nullptr;
    jmethodID fabricSetSize            = nullptr;
    jmethodID fabricSetFrame           = nullptr;
    jmethodID fabricMeasure            = nullptr;
    jmethodID fetchText                = nullptr;
    jmethodID download                 = nullptr;
    jmethodID devServerHost            = nullptr;
    jmethodID isServing                = nullptr;
    jmethodID installHomeScreenIcon    = nullptr;
    jmethodID availableFonts           = nullptr;
    jmethodID appFonts                 = nullptr;
    jmethodID appFontBytes             = nullptr;
    jmethodID alert                    = nullptr;
    jmethodID crashAlert               = nullptr;
    jmethodID updateProgress           = nullptr;
    jmethodID onBundleExecuted         = nullptr;
    jmethodID fontsChanged             = nullptr;
};

struct LoaderConfiguration {
    std::string    documents;
    nlohmann::json bootstrapScripts = nlohmann::json::object();
    std::string    origin;
    uint32_t       bytecodeVersion = 0;
    nlohmann::json platformInfo    = nlohmann::json::object();
};

// Android's half of the loader: the JNI transport, scheduling and UI the core `loader::Loader`
// runs over, and the runtime and main-thread queues native plugins use.
class AndroidLoader : public loader::LoaderHost,
                      public loader::native::NativePluginExecutor,
                      public std::enable_shared_from_this<AndroidLoader>
{
public:
    AndroidLoader(LoaderConfiguration configuration, JavaCallbacks callbacks);

    // The device facts `NativePlatform` and issue reports read.
    std::shared_ptr<loader::NativePlatformProvider> platformProvider() const;

    void onRuntimeCreated();
    void drainMainWork();
    void drainMainFrameWork();
    void drainRuntimeWork(facebook::jsi::Runtime &runtime);
    bool installSchedulerDrain(facebook::jsi::Runtime &runtime);

    void runOnRuntime(std::function<void(facebook::jsi::Runtime &)> work) override;
    void runOnRuntimeCoalesced(std::string                                   key,
                               std::function<void(facebook::jsi::Runtime &)> work) override;
    void runOnRuntimeCritical(std::function<void(facebook::jsi::Runtime &)> work) override;
    bool isMainThread() override;
    void runOnMain(std::function<void()> work) override;
    bool runOnMainNextFrame(std::function<void()> work) override;
    void runAfter(double seconds, std::function<void()> work) override;
    void runInBackground(std::function<void()> work) override;

    std::optional<std::string> resource(const std::string &name) override;
    uint32_t                   runtimeBytecodeVersion() override;
    std::optional<std::string> fetchText(const std::string &url, double timeoutSeconds) override;
    std::optional<loader::DownloadResult>
                               download(const std::string &url, const std::string &destination,
                                        const std::map<std::string, std::string> &headers,
                                        const loader::DownloadPolicy             &policy) override;
    bool                       isServing(const std::string &url, double timeoutSeconds) override;
    std::optional<std::string> devServerHost() override;
    std::shared_ptr<loader::HotReloadTransport> hotReloadTransport() override;
    nlohmann::json                              systemFonts() override;
    void                                        onFontsChanged() override;
    void installNativeModules(facebook::jsi::Runtime &runtime) override;
    void extendNativeProvider(loader::UnboundNativeProvider &provider) override;
    void onBundleExecuted() override;
    void alert(const std::string &message) override;
    void crashAlert(const std::string &message) override;
    void showUpdateProgress(bool showing) override;
    void reload() override;

private:
    void           enqueueRuntime(std::function<void(facebook::jsi::Runtime &)> work,
                                  loader::native::NativeWorkPriority            priority);
    void           scheduleRuntimeDrain();
    void           requestRuntimeDrain(bool throughScheduler);
    void           drainScheduledRuntimeWork(facebook::jsi::Runtime &runtime);
    bool           drainQueuedRuntimeWork(facebook::jsi::Runtime &runtime);
    nlohmann::json appFonts();
    bool           installHomeScreenIcon(const std::string &name, const std::string &imagePath);

    LoaderConfiguration                                                            configuration_;
    JavaCallbacks                                                                  callbacks_;
    loader::native::NativeWorkQueue<std::function<void(facebook::jsi::Runtime &)>> runtimeQueue_;
    std::mutex                                                                     mainQueueMutex_;
    std::deque<std::function<void()>>                                              mainQueue_;
    bool                                 mainDrainScheduled_ = false;
    loader::native::NativeFrameWorkQueue frameQueue_;
    std::atomic<bool>                    schedulerDrainLive_ = false;
    DeadlineTimer                        timer_;
};

// The running loader and its Android host; both empty before `nativeInitialize`.
std::shared_ptr<loader::Loader> currentLoader();
std::shared_ptr<AndroidLoader>  currentHost();
void setCurrentLoader(std::shared_ptr<loader::Loader> loader, std::shared_ptr<AndroidLoader> host);
}
