#include "AndroidLoader.h"

#include "JniEnvironment.h"
#include "LoaderAddons.h"
#include "LoaderColor.h"
#include "LoaderFiles.h"
#include "LoaderLog.h"
#include "LoaderThemes.h"
#include "LoaderToolbox.h"
#include "NativePlatformBridge.h"
#include "NativePluginBridge.h"

#include <chrono>
#include <thread>

namespace unbound::android
{
    namespace jsi = facebook::jsi;

    static constexpr auto kRunApplicationBundleWait = std::chrono::milliseconds(1500);

    static std::mutex                     gLoaderMutex;
    static std::shared_ptr<AndroidLoader> gLoader;

    std::shared_ptr<AndroidLoader> currentLoader()
    {
        std::lock_guard<std::mutex> lock(gLoaderMutex);
        return gLoader;
    }

    void setCurrentLoader(std::shared_ptr<AndroidLoader> loader)
    {
        std::lock_guard<std::mutex> lock(gLoaderMutex);
        gLoader = std::move(loader);
    }

    AndroidLoader::AndroidLoader(LoaderConfiguration configuration, JavaCallbacks callbacks)
        : configuration_(std::move(configuration)), callbacks_(callbacks),
          settings_(loader::joinPath(configuration_.documents, "settings.json"))
    {
    }

    void AndroidLoader::start()
    {
        loader::createDirectories(configuration_.documents);
        settings_.load();

        updater_ = std::make_unique<loader::BundleUpdater>(
            configuration_.documents, loader::updaterSettings(settings_),
            [this](const std::string &url, double timeout) { return fetchText(url, timeout); },
            [this](const std::string &url, const std::string &destination,
                   const std::map<std::string, std::string> &headers) {
                return download(url, destination, headers);
            });
        pipeline_ = std::make_unique<loader::LoaderPipeline>(shared_from_this(), loader::updaterSettings(settings_), *updater_);
    }

    std::string AndroidLoader::toolbox(const std::string &action, const std::string &argument)
    {
        loader::toolbox::ToolboxContext context{
            settings_, *updater_, configuration_.documents, "Android", [this] { return resolveUpdateURL(); },
            [this] { return runtimeBytecodeVersion(); }};
        return loader::toolbox::perform(context, action, argument);
    }

    loader::SettingsStore &AndroidLoader::settings()
    {
        return settings_;
    }

    std::string AndroidLoader::fontsJSON()
    {
        std::lock_guard<std::mutex> lock(addonsMutex_);
        return loader::toJSON(fonts_);
    }

    std::string AndroidLoader::themeColorsJSON(const std::string &themeId)
    {
        std::lock_guard<std::mutex> lock(addonsMutex_);
        const nlohmann::json *theme = loader::findTheme(themes_, themeId);
        return loader::toJSON(theme ? loader::themeColorsByAccessor(loader::resolveThemeColors(*theme))
                                    : nlohmann::json::object());
    }

    void AndroidLoader::onLoadJSBundle()
    {
        settings_.load();
        pipeline_->prepare();
    }

    void AndroidLoader::onJSBundleLoaded()
    {
        pipeline_->enqueueBundle();
    }

    void AndroidLoader::executeBundleNow(jsi::Runtime &runtime)
    {
        jsi::Value installed = runtime.global().getProperty(runtime, "__loaderBundleInstalled");
        if (installed.isBool() && installed.getBool())
        {
            return;
        }

        loader::native::registerRuntime(runtime);
        pipeline_->executeNow(runtime, kRunApplicationBundleWait);
    }

    void AndroidLoader::drainRuntimeWork(jsi::Runtime &runtime)
    {
        loader::native::registerRuntime(runtime);
        std::deque<std::function<void(jsi::Runtime &)>> work;
        {
            std::lock_guard<std::mutex> lock(queueMutex_);
            work.swap(queue_);
        }

        for (auto &item : work)
        {
            try
            {
                item(runtime);
            }
            catch (const std::exception &error)
            {
                loader::log(loader::LogLevel::Error, "default",
                            std::string("Runtime work failed: ") + error.what());
            }
            catch (...)
            {
                loader::log(loader::LogLevel::Error, "default", "Runtime work failed.");
            }
        }
    }

    void AndroidLoader::drainMainWork()
    {
        std::deque<std::function<void()>> work;
        {
            std::lock_guard<std::mutex> lock(mainQueueMutex_);
            work.swap(mainQueue_);
        }

        for (auto &item : work)
        {
            try
            {
                item();
            }
            catch (const std::exception &error)
            {
                loader::log(loader::LogLevel::Error, "plugins",
                            std::string("Main-thread native work failed: ") + error.what());
            }
            catch (...)
            {
                loader::log(loader::LogLevel::Error, "plugins", "Main-thread native work failed.");
            }
        }
    }

    void AndroidLoader::runOnRuntime(std::function<void(jsi::Runtime &)> work)
    {
        {
            std::lock_guard<std::mutex> lock(queueMutex_);
            queue_.push_back(std::move(work));
        }

        JNIEnv *env = currentEnvironment();
        if (!env)
        {
            return;
        }
        env->CallStaticVoidMethod(callbacks_.bridgeClass, callbacks_.scheduleRuntime);
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
        }

        JNIEnv *env = currentEnvironment();
        if (!env)
        {
            return;
        }
        env->CallStaticVoidMethod(callbacks_.bridgeClass, callbacks_.scheduleMain);
        clearPendingException(env);
    }

    void AndroidLoader::runAfter(double seconds, std::function<void()> work)
    {
        std::thread([seconds, work = std::move(work)]() {
            std::this_thread::sleep_for(std::chrono::duration<double>(seconds));
            work();
        }).detach();
    }

    void AndroidLoader::runInBackground(std::function<void()> work)
    {
        std::thread(std::move(work)).detach();
    }

    std::optional<std::string> AndroidLoader::resource(const std::string &name)
    {
        if (name == "devtools")
        {
            return configuration_.devtoolsScript;
        }
        return std::nullopt;
    }

    std::optional<std::string> AndroidLoader::resolveUpdateURL()
    {
        return loader::resolveUpdateURL(
            loader::updaterSettings(settings_), devServerHost(),
            [this](const std::string &url, double timeout) { return isServing(url, timeout); });
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
        jboolean serving = env->CallStaticBooleanMethod(callbacks_.bridgeClass, callbacks_.isServing, javaURL,
                                                        static_cast<jint>(timeoutSeconds * 1000));
        env->DeleteLocalRef(javaURL);
        return !clearPendingException(env) && serving == JNI_TRUE;
    }

    std::optional<std::string> AndroidLoader::hotReloadURL()
    {
        std::optional<std::string> base = resolveUpdateURL();
        return base ? loader::hotReloadURL(*base) : std::nullopt;
    }

    void AndroidLoader::hotReloadConnected()
    {
        if (!hotReloadStream_)
        {
            hotReloadStream_ = std::make_unique<loader::HotReloadStream>(loader::updaterSettings(settings_));
        }
        hotReloadStream_->reset();
        hotReloadBackoff_.reset();
    }

    bool AndroidLoader::hotReloadFeed(const std::string &chunk)
    {
        return hotReloadStream_ && hotReloadStream_->feed(chunk);
    }

    double AndroidLoader::hotReloadNextDelay()
    {
        return hotReloadBackoff_.next();
    }

    uint32_t AndroidLoader::runtimeBytecodeVersion()
    {
        return configuration_.bytecodeVersion;
    }

    loader::PreloadPayload AndroidLoader::preloadPayload()
    {
        loader::PreloadPayload payload;
        payload.settings = settings_.serialize();
        {
            std::lock_guard<std::mutex> lock(addonsMutex_);
            payload.plugins = loader::toJSON(plugins_);
            payload.themes  = loader::toJSON(themes_);
            payload.fonts   = loader::toJSON(fonts_);
        }
        payload.availableFonts = loader::toJSON(availableFonts());
        payload.origin         = configuration_.origin;
        payload.version        = UNBOUND_VERSION;
        return payload;
    }

    void AndroidLoader::installNativeModules(jsi::Runtime &runtime)
    {
        loader::native::setExecutor(std::static_pointer_cast<loader::native::NativePluginExecutor>(
            shared_from_this()));
        loader::native::registerRuntime(runtime);
        const nlohmann::json info = configuration_.platformInfo;
        auto                 text = [info](const char *key) {
            return [info, key]() { return info.value(key, std::string()); };
        };
        auto flag = [info](const char *key) { return [info, key]() { return info.value(key, false); }; };

        auto provider                 = std::make_shared<loader::NativePlatformProvider>();
        provider->platform            = "android";
        provider->deviceModel         = text("deviceModel");
        provider->osVersion           = text("osVersion");
        provider->isRooted            = flag("isRooted");
        provider->isSystemApp         = flag("isSystemApp");
        provider->appSource           = text("appSource");
        provider->documents           = configuration_.documents;
        loader::installNativePlatform(runtime, provider);
        registerNativePluginBridge(runtime, callbacks_);
    }

    void AndroidLoader::onAddonsPrepared()
    {
        nlohmann::json plugins = loader::scanPlugins(configuration_.documents);
        nlohmann::json themes  = loader::scanThemes(configuration_.documents);
        nlohmann::json fonts   = loader::scanFonts(configuration_.documents, nullptr);

        std::lock_guard<std::mutex> lock(addonsMutex_);
        plugins_ = std::move(plugins);
        themes_  = std::move(themes);
        fonts_   = std::move(fonts);
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

    std::optional<std::string> AndroidLoader::fetchText(const std::string &url, double timeoutSeconds)
    {
        JNIEnv *env = currentEnvironment();
        if (!env)
        {
            return std::nullopt;
        }

        jstring javaURL = toJavaString(env, url);
        auto    result  = static_cast<jstring>(env->CallStaticObjectMethod(
            callbacks_.bridgeClass, callbacks_.fetchText, javaURL,
            static_cast<jint>(timeoutSeconds * 1000)));
        env->DeleteLocalRef(javaURL);
        if (clearPendingException(env) || !result)
        {
            return std::nullopt;
        }

        std::string text = toStdString(env, result);
        env->DeleteLocalRef(result);
        return text;
    }

    std::optional<loader::DownloadResult> AndroidLoader::download(
        const std::string &url, const std::string &destination,
        const std::map<std::string, std::string> &headers)
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
            callbacks_.bridgeClass, callbacks_.download, javaURL, javaDestination, javaKeys,
            javaValues));

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

    nlohmann::json AndroidLoader::availableFonts()
    {
        nlohmann::json families = nlohmann::json::array();
        JNIEnv        *env      = currentEnvironment();
        if (!env)
        {
            return families;
        }

        auto names = static_cast<jobjectArray>(
            env->CallStaticObjectMethod(callbacks_.bridgeClass, callbacks_.availableFonts));
        if (clearPendingException(env) || !names)
        {
            return families;
        }

        jsize count = env->GetArrayLength(names);
        for (jsize index = 0; index < count; index++)
        {
            auto name = static_cast<jstring>(env->GetObjectArrayElement(names, index));
            families.push_back(toStdString(env, name));
            env->DeleteLocalRef(name);
        }
        env->DeleteLocalRef(names);
        return families;
    }
}
