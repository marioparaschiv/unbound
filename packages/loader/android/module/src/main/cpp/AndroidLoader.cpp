#include "AndroidLoader.h"

#include <algorithm>
#include <chrono>
#include <thread>

#include "AndroidHotReload.h"
#include "JniEnvironment.h"
#include "LoaderFiles.h"
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

static bool verifiedBuild(const JavaCallbacks &callbacks)
{
    JNIEnv *env = currentEnvironment();
    if (!env)
    {
        return false;
    }
    jboolean verified =
        env->CallStaticBooleanMethod(callbacks.bridgeClass, callbacks.isVerifiedBuild);
    return !clearPendingException(env) && verified == JNI_TRUE;
}

static std::optional<std::string> installerCall(const JavaCallbacks &callbacks,
                                                const std::string   &action,
                                                const std::string   &argument)
{
    JNIEnv *env = currentEnvironment();
    if (!env)
    {
        return std::nullopt;
    }
    jstring javaAction   = toJavaString(env, action);
    jstring javaArgument = toJavaString(env, argument);
    auto    result       = static_cast<jstring>(env->CallStaticObjectMethod(
        callbacks.bridgeClass, callbacks.installer, javaAction, javaArgument));
    env->DeleteLocalRef(javaAction);
    env->DeleteLocalRef(javaArgument);
    if (clearPendingException(env) || !result)
    {
        return std::nullopt;
    }
    std::string text = toStdString(env, result);
    env->DeleteLocalRef(result);
    return text;
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

    auto provider             = std::make_shared<loader::NativePlatformProvider>();
    provider->platform        = "android";
    provider->deviceModel     = text("deviceModel");
    provider->osVersion       = text("osVersion");
    provider->isRooted        = flag("isRooted");
    provider->isSystemApp     = flag("isSystemApp");
    provider->appSource       = text("appSource");
    provider->framework       = text("framework");
    provider->isVerifiedBuild = [callbacks]() {
        return verifiedBuild(callbacks);
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
        return installerCall(callbacks, action, argument);
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
    JNIEnv *env = currentEnvironment();
    if (!env)
    {
        runtimeQueue_.retryScheduling();
        return;
    }
    env->CallStaticVoidMethod(callbacks_.bridgeClass, callbacks_.scheduleRuntime,
                              static_cast<jboolean>(throughScheduler));
    clearPendingException(env);
}

bool AndroidLoader::isMainThread()
{
    JNIEnv *env = currentEnvironment();
    if (!env)
    {
        return false;
    }

    jboolean result = env->CallStaticBooleanMethod(callbacks_.bridgeClass, callbacks_.isMainThread);
    return !clearPendingException(env) && result;
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

    JNIEnv *env = currentEnvironment();
    if (!env)
    {
        std::lock_guard<std::mutex> lock(mainQueueMutex_);
        mainDrainScheduled_ = false;
        return;
    }
    env->CallStaticVoidMethod(callbacks_.bridgeClass, callbacks_.scheduleMain);
    clearPendingException(env);
}

bool AndroidLoader::runOnMainNextFrame(std::function<void()> work)
{
    if (!frameQueue_.enqueue(std::move(work)))
    {
        return true;
    }

    JNIEnv *env = currentEnvironment();
    if (!env || !callbacks_.scheduleMainFrame)
    {
        frameQueue_.clear();
        loader::log(loader::LogLevel::Error, LOG_CATEGORY_PLUGINS,
                    "Failed to schedule frame-batched native work.");
        return false;
    }
    env->CallStaticVoidMethod(callbacks_.bridgeClass, callbacks_.scheduleMainFrame);
    if (clearPendingException(env))
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
    JNIEnv *env = currentEnvironment();
    if (!env)
    {
        return std::nullopt;
    }

    auto host = static_cast<jstring>(
        env->CallStaticObjectMethod(callbacks_.bridgeClass, callbacks_.devServerHost));
    if (clearPendingException(env) || !host)
    {
        return std::nullopt;
    }

    std::string value = toStdString(env, host);
    env->DeleteLocalRef(host);
    return value;
}

bool AndroidLoader::isServing(const std::string &url, double timeoutSeconds)
{
    JNIEnv *env = currentEnvironment();
    if (!env)
    {
        return false;
    }

    jstring  javaURL = toJavaString(env, url);
    jboolean serving = env->CallStaticBooleanMethod(callbacks_.bridgeClass, callbacks_.isServing,
                                                    javaURL, milliseconds(timeoutSeconds));
    env->DeleteLocalRef(javaURL);
    return !clearPendingException(env) && serving == JNI_TRUE;
}

bool AndroidLoader::installHomeScreenIcon(const std::string &name, const std::string &imagePath)
{
    JNIEnv *env = currentEnvironment();
    if (!env)
    {
        return false;
    }

    jstring  javaName      = toJavaString(env, name);
    jstring  javaImagePath = toJavaString(env, imagePath);
    jboolean installed     = env->CallStaticBooleanMethod(
        callbacks_.bridgeClass, callbacks_.installHomeScreenIcon, javaName, javaImagePath);
    env->DeleteLocalRef(javaImagePath);
    env->DeleteLocalRef(javaName);
    return !clearPendingException(env) && installed == JNI_TRUE;
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
    JNIEnv *env = currentEnvironment();
    if (!env)
    {
        return;
    }
    env->CallStaticVoidMethod(callbacks_.bridgeClass, callbacks_.onBundleExecuted);
    clearPendingException(env);
}

void AndroidLoader::reload()
{
    reloadApp();
}

void AndroidLoader::showUpdateProgress(bool showing)
{
    JNIEnv *env = currentEnvironment();
    if (!env)
    {
        return;
    }
    env->CallStaticVoidMethod(callbacks_.bridgeClass, callbacks_.updateProgress,
                              showing ? JNI_TRUE : JNI_FALSE);
    clearPendingException(env);
}

void AndroidLoader::alert(const std::string &message)
{
    JNIEnv *env = currentEnvironment();
    if (!env)
    {
        return;
    }
    jstring text = toJavaString(env, message);
    env->CallStaticVoidMethod(callbacks_.bridgeClass, callbacks_.alert, text);
    clearPendingException(env);
    env->DeleteLocalRef(text);
}

void AndroidLoader::crashAlert(const std::string &message)
{
    JNIEnv *env = currentEnvironment();
    if (!env)
    {
        return;
    }
    jstring text = toJavaString(env, message);
    env->CallStaticVoidMethod(callbacks_.bridgeClass, callbacks_.crashAlert, text);
    clearPendingException(env);
    env->DeleteLocalRef(text);
}

std::optional<std::string> AndroidLoader::fetchText(const std::string &url, double timeoutSeconds)
{
    JNIEnv *env = currentEnvironment();
    if (!env)
    {
        return std::nullopt;
    }

    jstring javaURL = toJavaString(env, url);
    auto    result  = static_cast<jstring>(env->CallStaticObjectMethod(
        callbacks_.bridgeClass, callbacks_.fetchText, javaURL, milliseconds(timeoutSeconds)));
    env->DeleteLocalRef(javaURL);
    if (clearPendingException(env) || !result)
    {
        return std::nullopt;
    }

    std::string text = toStdString(env, result);
    env->DeleteLocalRef(result);
    return text;
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

    env->DeleteLocalRef(status);
    env->DeleteLocalRef(etag);
    env->DeleteLocalRef(response);
    return result;
}

}
