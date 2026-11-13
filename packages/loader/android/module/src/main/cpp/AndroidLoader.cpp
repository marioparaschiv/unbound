#include "AndroidLoader.h"

#include <algorithm>
#include <atomic>
#include <chrono>
#include <thread>

#include "AndroidHotReload.h"
#include "JniCall.h"
#include "JniEnvironment.h"
#include "LoaderFiles.h"
#include "LoaderInjectedLibraries.h"
#include "LoaderJSON.h"
#include "LoaderLog.h"
#include "NativePluginBridge.h"

namespace unbound::android {
namespace jsi = facebook::jsi;

static constexpr const char *kCallableModuleRegistrar = "RN$registerCallableModule";
static constexpr const char *kSchedulerDrainModule    = "UnboundNativeWork";
static constexpr const char *kSchedulerDrainMethod    = "drain";

static constexpr const char *kAppIconDirectory = "AppIcons";
static constexpr const char *kCustomIconPrefix = "UnboundCustom";

static std::string stringField(const nlohmann::json &entry, const char *key)
{
    const auto field = entry.is_object() ? entry.find(key) : entry.end();
    return field != entry.end() && field->is_string() ? field->get<std::string>() : std::string();
}

static nlohmann::json customAppIcons(const std::string &documents)
{
    const std::string directory = loader::joinPath(documents, kAppIconDirectory);
    const auto        manifest  = loader::readTextFile(loader::joinPath(directory, "custom.json"));
    nlohmann::json    icons     = nlohmann::json::array();
    if (!manifest)
    {
        return icons;
    }

    const nlohmann::json entries = loader::parseBoundedJSON(*manifest);
    if (!entries.is_array())
    {
        return icons;
    }

    for (const auto &entry : entries)
    {
        const std::string id   = stringField(entry, "id");
        const std::string name = stringField(entry, "name");
        const std::string file = stringField(entry, "file");
        const auto        path = loader::resolveInsideDirectory(directory, file);
        if (id.rfind(kCustomIconPrefix, 0) != 0 || name.empty() || !path ||
            !loader::fileExists(*path))
        {
            continue;
        }
        icons.push_back({{"id", id}, {"name", name}, {"image", "file://" + *path}});
    }
    return icons;
}

static std::string ownPackage()
{
    const std::string command = loader::readTextFile("/proc/self/cmdline").value_or("");
    const std::string process = command.substr(0, command.find('\0'));
    return process.substr(0, process.find(':'));
}

static std::vector<std::string> injectedModules()
{
    return loader::injectedAndroidModules(loader::readTextFile("/proc/self/maps").value_or(""),
                                          ownPackage());
}

static jint milliseconds(double seconds)
{
    return static_cast<jint>(seconds * 1000);
}

static std::mutex                      gLoaderMutex;
static std::shared_ptr<loader::Loader> gLoader;
static std::shared_ptr<AndroidLoader>  gHost;

std::shared_ptr<loader::Loader> currentLoader()
{
    std::lock_guard<std::mutex> lock(gLoaderMutex);
    return gLoader;
}

static std::atomic_bool gDiscordVisible{false};

void setDiscordVisible(bool visible)
{
    gDiscordVisible.store(visible);
}

bool AndroidLoader::visibleNow()
{
    return gDiscordVisible.load();
}

std::shared_ptr<AndroidLoader> currentHost()
{
    std::lock_guard<std::mutex> lock(gLoaderMutex);
    return gHost;
}

void setCurrentLoader(std::shared_ptr<loader::Loader> loader, std::shared_ptr<AndroidLoader> host)
{
    std::lock_guard<std::mutex> lock(gLoaderMutex);
    gLoader = std::move(loader);
    gHost   = std::move(host);
}

AndroidLoader::AndroidLoader(LoaderConfiguration configuration, JavaCallbacks callbacks)
    : configuration_(std::move(configuration)), callbacks_(callbacks)
{
}

std::shared_ptr<loader::NativePlatformProvider> AndroidLoader::platformProvider() const
{
    const nlohmann::json info      = configuration_.platformInfo;
    const JavaCallbacks  callbacks = callbacks_;
    auto                 text      = [info](const char *key) {
        return [info, key]() {
            return info.value(key, std::string());
        };
    };
    auto flag = [info](const char *key) {
        return [info, key]() {
            return info.value(key, false);
        };
    };

    auto provider         = std::make_shared<loader::NativePlatformProvider>();
    provider->platform    = "android";
    provider->deviceModel = text("deviceModel");
    provider->osVersion   = text("osVersion");
    provider->isRooted    = flag("isRooted");
    provider->isSystemApp = flag("isSystemApp");
    provider->appSource   = text("appSource");
    provider->framework   = text("framework");
    provider->jailbreak   = text("jailbreak");
    provider->deviceState = [callbacks]() {
        nlohmann::json state = nlohmann::json::parse(
            callStaticString(callbacks.bridgeClass, callbacks.deviceState).value_or("{}"), nullptr,
            false);
        if (!state.is_object())
        {
            state = nlohmann::json::object();
        }
        state["injected"] = injectedModules();
        return state;
    };
    provider->isVerifiedBuild = [callbacks]() {
        return callStaticBoolean(callbacks.bridgeClass, callbacks.isVerifiedBuild);
    };
    provider->isVirtualDevice   = flag("isVirtualDevice");
    provider->virtualDeviceHost = [info]() -> std::optional<std::string> {
        const auto host = info.find("virtualDeviceHost");
        return host != info.end() && host->is_string()
                   ? std::optional<std::string>(host->get<std::string>())
                   : std::nullopt;
    };
    provider->androidInstaller = [callbacks](const std::string &action,
                                             const std::string &argument) {
        return callStaticString(callbacks.bridgeClass, callbacks.installer, action, argument);
    };
    return provider;
}

void AndroidLoader::onRuntimeCreated()
{
    runtimeQueue_.retryScheduling();
}

bool AndroidLoader::installSchedulerDrain(jsi::Runtime &runtime)
{
    schedulerDrainLive_.store(false);
    try
    {
        jsi::Value registrar = runtime.global().getProperty(runtime, kCallableModuleRegistrar);
        if (!registrar.isObject() || !registrar.getObject(runtime).isFunction(runtime))
        {
            loader::log(loader::LogLevel::Warning, LOG_CATEGORY_RUNTIME,
                        "RuntimeScheduler drains are unavailable, runtime work drains on the JS "
                        "queue with explicit microtask checkpoints.");
            return false;
        }

        std::weak_ptr<AndroidLoader> weak    = weak_from_this();
        jsi::Function                factory = loader::native::makeFunction(
            runtime, kSchedulerDrainModule, 0,
            [weak](jsi::Runtime &moduleRuntime, const jsi::Value &, const jsi::Value *,
                   size_t) -> jsi::Value {
                jsi::Object module(moduleRuntime);
                module.setProperty(moduleRuntime, kSchedulerDrainMethod,
                                   loader::native::makeFunction(
                                       moduleRuntime, kSchedulerDrainMethod, 0,
                                       [weak](jsi::Runtime &drainRuntime, const jsi::Value &,
                                              const jsi::Value *, size_t) -> jsi::Value {
                                           if (auto loader = weak.lock())
                                           {
                                               loader->drainScheduledRuntimeWork(drainRuntime);
                                           }
                                           return jsi::Value::undefined();
                                       }));
                return jsi::Value(std::move(module));
            });
        registrar.getObject(runtime).getFunction(runtime).call(
            runtime, jsi::String::createFromAscii(runtime, kSchedulerDrainModule), factory);
        return true;
    }
    catch (const std::exception &error)
    {
        loader::log(loader::LogLevel::Warning, LOG_CATEGORY_RUNTIME,
                    std::string("RuntimeScheduler drains could not be registered: ") +
                        error.what());
        return false;
    }
}

void AndroidLoader::drainScheduledRuntimeWork(jsi::Runtime &runtime)
{
    if (!schedulerDrainLive_.exchange(true))
    {
        loader::log(loader::LogLevel::Info, LOG_CATEGORY_RUNTIME,
                    "Runtime work now drains through React Native's RuntimeScheduler.");
    }
    if (drainQueuedRuntimeWork(runtime))
    {
        requestRuntimeDrain(false);
    }
}

void AndroidLoader::drainRuntimeWork(jsi::Runtime &runtime)
{
    const bool remaining = drainQueuedRuntimeWork(runtime);
    try
    {
        runtime.drainMicrotasks();
    }
    catch (const std::exception &error)
    {
        loader::log(loader::LogLevel::Error, LOG_CATEGORY_RUNTIME,
                    std::string("Microtasks after runtime work failed: ") + error.what());
    }
    if (remaining)
    {
        scheduleRuntimeDrain();
    }
}

bool AndroidLoader::drainQueuedRuntimeWork(jsi::Runtime &runtime)
{
    loader::native::registerRuntime(runtime);
    return runtimeQueue_.drain(
        [&](auto item) {
            try
            {
                item(runtime);
            }
            catch (const std::exception &error)
            {
                loader::log(loader::LogLevel::Error, LOG_CATEGORY_DEFAULT,
                            std::string("Runtime work failed: ") + error.what());
            }
            catch (...)
            {
                loader::log(loader::LogLevel::Error, LOG_CATEGORY_DEFAULT, "Runtime work failed.");
            }
        },
        [] {
            return std::chrono::steady_clock::now();
        });
}

void AndroidLoader::drainMainWork()
{
    std::deque<std::function<void()>> work;
    {
        std::lock_guard<std::mutex> lock(mainQueueMutex_);
        work.swap(mainQueue_);
        mainDrainScheduled_ = false;
    }
    if (work.empty())
    {
        return;
    }

    const auto startedAt = std::chrono::steady_clock::now();
    for (auto &item : work)
    {
        try
        {
            item();
        }
        catch (const std::exception &error)
        {
            loader::log(loader::LogLevel::Error, LOG_CATEGORY_PLUGINS,
                        std::string("Main-thread native work failed: ") + error.what());
        }
        catch (...)
        {
            loader::log(loader::LogLevel::Error, LOG_CATEGORY_PLUGINS,
                        "Main-thread native work failed.");
        }
    }
    loader::native::recordMainDrain(work.size(), std::chrono::steady_clock::now() - startedAt);
}

void AndroidLoader::drainMainFrameWork()
{
    frameQueue_.drain();
}

void AndroidLoader::runOnRuntime(std::function<void(jsi::Runtime &)> work)
{
    enqueueRuntime(std::move(work), loader::native::NativeWorkPriority::Deferred);
}

void AndroidLoader::runOnRuntimeCoalesced(std::string key, std::function<void(jsi::Runtime &)> work)
{
    if (runtimeQueue_.enqueueCoalesced(std::move(key), std::move(work)))
    {
        scheduleRuntimeDrain();
    }
}

void AndroidLoader::runOnRuntimeCritical(std::function<void(jsi::Runtime &)> work)
{
    enqueueRuntime(std::move(work), loader::native::NativeWorkPriority::Critical);
}

void AndroidLoader::enqueueRuntime(std::function<void(jsi::Runtime &)> work,
                                   loader::native::NativeWorkPriority  priority)
{
    if (runtimeQueue_.enqueue(std::move(work), priority))
    {
        scheduleRuntimeDrain();
    }
}

void AndroidLoader::scheduleRuntimeDrain()
{
    requestRuntimeDrain(schedulerDrainLive_.load());
}

void AndroidLoader::requestRuntimeDrain(bool throughScheduler)
{
    if (!currentEnvironment())
    {
        runtimeQueue_.retryScheduling();
        return;
    }
    callStaticVoid(callbacks_.bridgeClass, callbacks_.scheduleRuntime,
                   static_cast<jboolean>(throughScheduler));
}

bool AndroidLoader::isMainThread()
{
    return callStaticBoolean(callbacks_.bridgeClass, callbacks_.isMainThread);
}

void AndroidLoader::runOnMain(std::function<void()> work)
{
    {
        std::lock_guard<std::mutex> lock(mainQueueMutex_);
        mainQueue_.push_back(std::move(work));
        if (mainDrainScheduled_)
        {
            return;
        }
        mainDrainScheduled_ = true;
    }

    if (!currentEnvironment())
    {
        std::lock_guard<std::mutex> lock(mainQueueMutex_);
        mainDrainScheduled_ = false;
        return;
    }
    callStaticVoid(callbacks_.bridgeClass, callbacks_.scheduleMain);
}

bool AndroidLoader::runOnMainNextFrame(std::function<void()> work)
{
    if (!frameQueue_.enqueue(std::move(work)))
    {
        return true;
    }

    if (!callStaticVoid(callbacks_.bridgeClass, callbacks_.scheduleMainFrame))
    {
        frameQueue_.clear();
        loader::log(loader::LogLevel::Error, LOG_CATEGORY_PLUGINS,
                    "Failed to schedule frame-batched native work.");
        return false;
    }
    return true;
}

void AndroidLoader::runAfter(double seconds, std::function<void()> work)
{
    timer_.schedule(std::chrono::duration_cast<DeadlineTimer::Clock::duration>(
                        std::chrono::duration<double>(std::max(seconds, 0.0))),
                    [work = std::move(work)]() {
                        try
                        {
                            work();
                        }
                        catch (const std::exception &error)
                        {
                            loader::log(loader::LogLevel::Error, LOG_CATEGORY_DEFAULT,
                                        std::string("Delayed native work failed: ") + error.what());
                        }
                        catch (...)
                        {
                            loader::log(loader::LogLevel::Error, LOG_CATEGORY_DEFAULT,
                                        "Delayed native work failed.");
                        }
                    });
}

void AndroidLoader::runInBackground(std::function<void()> work)
{
    std::thread(std::move(work)).detach();
}

std::optional<std::string> AndroidLoader::resource(const std::string &name)
{
    const auto script = configuration_.bootstrapScripts.find(name);
    if (script == configuration_.bootstrapScripts.end() || !script->is_string())
    {
        return std::nullopt;
    }
    return script->get<std::string>();
}

std::optional<std::string> AndroidLoader::devServerHost()
{
    return callStaticString(callbacks_.bridgeClass, callbacks_.devServerHost);
}

bool AndroidLoader::isServing(const std::string &url, double timeoutSeconds)
{
    return callStaticBoolean(callbacks_.bridgeClass, callbacks_.isServing, url,
                             milliseconds(timeoutSeconds));
}

bool AndroidLoader::installHomeScreenIcon(const std::string &name, const std::string &imagePath)
{
    return callStaticBoolean(callbacks_.bridgeClass, callbacks_.installHomeScreenIcon, name,
                             imagePath);
}

std::shared_ptr<loader::HotReloadTransport> AndroidLoader::hotReloadTransport()
{
    return createHotReloadTransport();
}

uint32_t AndroidLoader::runtimeBytecodeVersion()
{
    return configuration_.bytecodeVersion;
}

void AndroidLoader::extendNativeProvider(loader::UnboundNativeProvider &provider)
{
    const auto     appIcons = configuration_.platformInfo.find("appIcons");
    nlohmann::json packaged = appIcons != configuration_.platformInfo.end() && appIcons->is_array()
                                  ? *appIcons
                                  : nlohmann::json::array();
    if (configuration_.platformInfo.value("launcherIcons", false))
    {
        provider.getAppIcons = [packaged, documents = configuration_.documents] {
            nlohmann::json icons = packaged;
            for (auto &icon : customAppIcons(documents))
            {
                icons.push_back(std::move(icon));
            }
            return icons;
        };
        provider.syncAppIcons = [] {};
    }
    else if (!packaged.empty())
    {
        provider.getAppIcons = [packaged] {
            return packaged;
        };
    }
    provider.installHomeScreenIcon = [self = shared_from_this()](const std::string &name,
                                                                 const std::string &imagePath) {
        return self->installHomeScreenIcon(name, imagePath);
    };
}

void AndroidLoader::installNativeModules(jsi::Runtime &runtime)
{
    loader::native::setExecutor(
        std::static_pointer_cast<loader::native::NativePluginExecutor>(shared_from_this()));
    loader::native::registerRuntime(runtime);
    registerNativePluginBridge(runtime, callbacks_);
}

void AndroidLoader::onBundleExecuted()
{
    callStaticVoid(callbacks_.bridgeClass, callbacks_.onBundleExecuted);
}

void AndroidLoader::reload()
{
    reloadApp();
}

void AndroidLoader::showUpdateProgress(bool showing)
{
    callStaticVoid(callbacks_.bridgeClass, callbacks_.updateProgress,
                   static_cast<jboolean>(showing ? JNI_TRUE : JNI_FALSE));
}

void AndroidLoader::alert(const std::string &message)
{
    callStaticVoid(callbacks_.bridgeClass, callbacks_.alert, message);
}

void AndroidLoader::crashAlert(const std::string &message)
{
    callStaticVoid(callbacks_.bridgeClass, callbacks_.crashAlert, message);
}

void AndroidLoader::stuckLaunch(const std::string &message)
{
    callStaticVoid(callbacks_.bridgeClass, callbacks_.stuckLaunch, message);
}

loader::PreviousExit AndroidLoader::previousExit()
{
    switch (callStaticInt(callbacks_.bridgeClass, callbacks_.previousExit).value_or(0))
    {
        case 1:
            return loader::PreviousExit::Crashed;
        case 2:
            return loader::PreviousExit::Ended;
        default:
            return loader::PreviousExit::Unknown;
    }
}

bool AndroidLoader::onMeteredNetwork()
{
    return callStaticBoolean(callbacks_.bridgeClass, callbacks_.isMeteredNetwork);
}

std::optional<std::string> AndroidLoader::fetchText(const std::string &url, double timeoutSeconds)
{
    return callStaticString(callbacks_.bridgeClass, callbacks_.fetchText, url,
                            milliseconds(timeoutSeconds));
}

std::optional<loader::DownloadResult>
AndroidLoader::download(const std::string &url, const std::string &destination,
                        const std::map<std::string, std::string> &headers,
                        const loader::DownloadPolicy             &policy)
{
    JNIEnv *env = currentEnvironment();
    if (!env)
    {
        return std::nullopt;
    }

    std::vector<std::string> keys;
    std::vector<std::string> values;
    for (const auto &[key, value] : headers)
    {
        keys.push_back(key);
        values.push_back(value);
    }

    jstring      javaURL         = toJavaString(env, url);
    jstring      javaDestination = toJavaString(env, destination);
    jobjectArray javaKeys        = toJavaStringArray(env, keys);
    jobjectArray javaValues      = toJavaStringArray(env, values);

    auto response = static_cast<jobjectArray>(env->CallStaticObjectMethod(
        callbacks_.bridgeClass, callbacks_.download, javaURL, javaDestination, javaKeys, javaValues,
        milliseconds(policy.connectTimeoutSeconds), milliseconds(policy.readTimeoutSeconds),
        milliseconds(policy.totalTimeoutSeconds)));

    env->DeleteLocalRef(javaURL);
    env->DeleteLocalRef(javaDestination);
    env->DeleteLocalRef(javaKeys);
    env->DeleteLocalRef(javaValues);

    if (clearPendingException(env) || !response || env->GetArrayLength(response) < 2)
    {
        return std::nullopt;
    }

    auto status = static_cast<jstring>(env->GetObjectArrayElement(response, 0));
    auto etag   = static_cast<jstring>(env->GetObjectArrayElement(response, 1));

    loader::DownloadResult result;
    result.status = std::stoi(toStdString(env, status));
    result.etag   = toStdString(env, etag);
    if (env->GetArrayLength(response) >= 3)
    {
        auto retryAfter   = static_cast<jstring>(env->GetObjectArrayElement(response, 2));
        result.retryAfter = retryAfter ? toStdString(env, retryAfter) : "";
        env->DeleteLocalRef(retryAfter);
    }

    env->DeleteLocalRef(status);
    env->DeleteLocalRef(etag);
    env->DeleteLocalRef(response);
    return result;
}

}
