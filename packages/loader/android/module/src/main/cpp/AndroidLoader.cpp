#include "AndroidLoader.h"

#include "AndroidHotReload.h"
#include "JniEnvironment.h"
#include "LoaderAddons.h"
#include "LoaderColor.h"
#include "LoaderFonts.h"
#include "LoaderPreferences.h"
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

    static constexpr const char *kAssetFontPrefix = "asset:";

    static jint milliseconds(double seconds)
    {
        return static_cast<jint>(seconds * 1000);
    }

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
          settings_(loader::joinPath(configuration_.documents, loader::preferences::kSettingsFile))
    {
    }

    static std::shared_ptr<loader::NativePlatformProvider> platformProvider(const LoaderConfiguration &configuration,
                                                                          loader::SettingsStore &settings)
    {
        const nlohmann::json info = configuration.platformInfo;
        auto                 text = [info](const char *key) {
            return [info, key]() { return info.value(key, std::string()); };
        };
        auto flag = [info](const char *key) { return [info, key]() { return info.value(key, false); }; };

        auto provider               = std::make_shared<loader::NativePlatformProvider>();
        provider->platform          = "android";
        provider->deviceModel       = text("deviceModel");
        provider->osVersion         = text("osVersion");
        provider->isRooted          = flag("isRooted");
        provider->isSystemApp       = flag("isSystemApp");
        provider->appSource         = text("appSource");
        provider->isVirtualDevice   = flag("isVirtualDevice");
        provider->virtualDeviceHost = [info]() -> std::optional<std::string> {
            const auto host = info.find("virtualDeviceHost");
            return host != info.end() && host->is_string() ? std::optional<std::string>(host->get<std::string>())
                                                           : std::nullopt;
        };
        provider->documents = configuration.documents;
        provider->settings  = &settings;
        return provider;
    }

    void AndroidLoader::start()
    {
        auto provider   = platformProvider(configuration_, settings_);
        provider->fonts = [weak = weak_from_this()] {
            auto loader = std::static_pointer_cast<AndroidLoader>(weak.lock());
            return loader ? loader->fontCatalog() : nlohmann::json::array();
        };
        loader::setNativePlatformProvider(provider);
        loader::createDirectories(configuration_.documents);
        settings_.load();

        updater_ = std::make_unique<loader::BundleUpdater>(
            configuration_.documents, loader::updaterSettings(settings_),
            [this](const std::string &url, double timeout) { return fetchText(url, timeout); },
            [this](const std::string &url, const std::string &destination,
                   const std::map<std::string, std::string> &headers, const loader::DownloadPolicy &policy) {
                return download(url, destination, headers, policy);
            });
        pipeline_ = std::make_unique<loader::LoaderPipeline>(shared_from_this(), loader::updaterSettings(settings_), *updater_);
        hotReload_ = createHotReloadController(
            settings_, [this] { return resolveUpdateURL(); },
            [this](double seconds, std::function<void()> work) { runAfter(seconds, std::move(work)); });
    }

    std::string AndroidLoader::toolbox(const std::string &action, const std::string &argument)
    {
        loader::toolbox::ToolboxContext context{
            settings_, *updater_, configuration_.documents, "Android", [this] { return resolveUpdateURL(); },
            [this] { return runtimeBytecodeVersion(); }, [this] { return pipeline_->isBundleReady(); }};
        return loader::toolbox::perform(context, action, argument);
    }

    loader::SettingsStore &AndroidLoader::settings()
    {
        return settings_;
    }

    std::string AndroidLoader::themeColorsJSON(const std::string &themeId)
    {
        std::optional<nlohmann::json> theme = addons_.theme(themeId);
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

    void AndroidLoader::onRuntimeCreated(jsi::Runtime &runtime)
    {
        pipeline_->onRuntimeCreated(runtime);
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
                                                        milliseconds(timeoutSeconds));
        env->DeleteLocalRef(javaURL);
        return !clearPendingException(env) && serving == JNI_TRUE;
    }

    std::shared_ptr<loader::HotReloadController> AndroidLoader::hotReload()
    {
        return hotReload_;
    }

    uint32_t AndroidLoader::runtimeBytecodeVersion()
    {
        return configuration_.bytecodeVersion;
    }

    loader::PreloadPayload AndroidLoader::preloadPayload()
    {
        return loader::makePreloadPayload(settings_, addons_, availableFonts(), configuration_.origin);
    }

    void AndroidLoader::installNativeModules(jsi::Runtime &runtime)
    {
        loader::native::setExecutor(std::static_pointer_cast<loader::native::NativePluginExecutor>(
            shared_from_this()));
        loader::native::registerRuntime(runtime);
        loader::installNativePlatform(runtime, loader::currentNativePlatformProvider());
        registerNativePluginBridge(runtime, callbacks_);
    }

    void AndroidLoader::onAddonsPrepared()
    {
        addons_.scan(configuration_.documents);
    }

    void AndroidLoader::onBundleExecuted()
    {
        hotReload_->sync();
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
            milliseconds(timeoutSeconds)));
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
        const std::map<std::string, std::string> &headers, const loader::DownloadPolicy &policy)
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
            javaValues, milliseconds(policy.connectTimeoutSeconds), milliseconds(policy.readTimeoutSeconds),
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

    static std::vector<std::string> callStringArray(JNIEnv *env, jclass type, jmethodID method)
    {
        std::vector<std::string> values;
        auto array = static_cast<jobjectArray>(env->CallStaticObjectMethod(type, method));
        if (clearPendingException(env) || !array)
        {
            return values;
        }
        jsize count = env->GetArrayLength(array);
        for (jsize index = 0; index < count; index++)
        {
            auto value = static_cast<jstring>(env->GetObjectArrayElement(array, index));
            values.push_back(toStdString(env, value));
            env->DeleteLocalRef(value);
        }
        env->DeleteLocalRef(array);
        return values;
    }

    nlohmann::json AndroidLoader::appFonts()
    {
        nlohmann::json fonts = nlohmann::json::array();
        JNIEnv        *env   = currentEnvironment();
        if (!env)
        {
            return fonts;
        }

        for (const std::string &asset : callStringArray(env, callbacks_.bridgeClass, callbacks_.appFonts))
        {
            jstring javaPath = toJavaString(env, asset);
            auto    bytes    = static_cast<jbyteArray>(
                env->CallStaticObjectMethod(callbacks_.bridgeClass, callbacks_.appFontBytes, javaPath));
            env->DeleteLocalRef(javaPath);
            if (clearPendingException(env) || !bytes)
            {
                continue;
            }

            std::string data(static_cast<size_t>(env->GetArrayLength(bytes)), '\0');
            env->GetByteArrayRegion(bytes, 0, static_cast<jsize>(data.size()), reinterpret_cast<jbyte *>(data.data()));
            env->DeleteLocalRef(bytes);

            const size_t slash = asset.find_last_of('/');
            const size_t dot   = asset.find_last_of('.');
            const std::string stem = asset.substr(slash + 1, dot == std::string::npos ? std::string::npos : dot - slash - 1);
            fonts.push_back(loader::fontEntryFromData(data, std::string(kAssetFontPrefix) + asset, "app", stem));
        }
        return fonts;
    }

    const nlohmann::json &AndroidLoader::systemFonts()
    {
        std::lock_guard<std::mutex> lock(systemFontsMutex_);
        if (systemFonts_)
        {
            return *systemFonts_;
        }

        nlohmann::json fonts = appFonts();
        if (JNIEnv *env = currentEnvironment())
        {
            for (nlohmann::json &font :
                 loader::systemFontsFromFiles(callStringArray(env, callbacks_.bridgeClass, callbacks_.availableFonts),
                                              "system"))
            {
                fonts.push_back(std::move(font));
            }
        }

        systemFonts_ = loader::fontCatalog(nlohmann::json::array(), fonts);
        return *systemFonts_;
    }

    nlohmann::json AndroidLoader::availableFonts()
    {
        return loader::fontNamesOf(systemFonts());
    }

    nlohmann::json AndroidLoader::fontCatalog()
    {
        return loader::fontCatalog(addons_.fonts(), systemFonts());
    }

    std::string AndroidLoader::resolveFont(const std::string &family)
    {
        const auto target = loader::fontOverrideFor(loader::preferences::fontOverrides(settings_), family);
        if (!target || *target == family)
        {
            return "{}";
        }

        const auto font = loader::resolveFontTarget(addons_.fonts(), systemFonts(), *target);
        if (!font)
        {
            return loader::toJSON({{"name", *target}, {"error", loader::fontUnavailableMessage(family, *target)}});
        }
        nlohmann::json resolved = {{"name", font->name}};
        if (font->path)
        {
            resolved["path"] = *font->path;
        }
        return loader::toJSON(resolved);
    }
}
