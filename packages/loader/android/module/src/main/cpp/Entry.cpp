#include <android/log.h>
#include <jni.h>
#include <mutex>

#include "AndroidAttestation.h"
#include "AndroidFileWatcher.h"
#include "AndroidHermesSampler.h"
#include "AndroidHotReload.h"
#include "AndroidLoader.h"
#include "HermesBytecodeHeader.h"
#include "JniEnvironment.h"
#include "JniSurface.h"
#include "LoaderColor.h"
#include "LoaderDevOverlay.h"
#include "LoaderDiagnostics.h"
#include "LoaderDocuments.h"
#include "LoaderJSI.h"
#include "LoaderJSON.h"
#include "LoaderLog.h"
#include "LoaderLogFile.h"
#include "LoaderPreferences.h"
#include "LoaderTelemetry.h"
#include "LoaderThreadWarnings.h"
#include "LoaderToolbox.h"
#include "LoaderToolboxGestures.h"
#include "NativeFabric.h"
#include "NativePluginBridge.h"

using namespace unbound::android;

static JavaCallbacks gCallbacks;

static int androidPriority(loader::LogLevel level)
{
    switch (level)
    {
        case loader::LogLevel::Debug:
            return ANDROID_LOG_DEBUG;
        case loader::LogLevel::Info:
            return ANDROID_LOG_INFO;
        case loader::LogLevel::Warning:
            return ANDROID_LOG_WARN;
        case loader::LogLevel::Error:
            return ANDROID_LOG_ERROR;
    }
    return ANDROID_LOG_INFO;
}

static void writeLog(loader::LogLevel level, const std::string &category,
                     const std::string &message)
{
    __android_log_write(androidPriority(level), "Unbound",
                        loader::formatLogLine(category, message).c_str());
    loader::appendLogFile(level, category, message);
}

static void nativeLog(JNIEnv *env, jclass, jint level, jstring category, jstring message)
{
    loader::logFromPlatform(level, category ? toStdString(env, category) : LOG_CATEGORY_DEFAULT,
                            message ? toStdString(env, message) : std::string());
}

static void nativeAppendLogFile(JNIEnv *env, jclass, jint level, jstring category, jstring message)
{
    loader::appendLogFile(loader::logLevelFromIndex(level),
                          category ? toStdString(env, category) : LOG_CATEGORY_DEFAULT,
                          message ? toStdString(env, message) : std::string());
}

static void nativeInitialize(JNIEnv *env, jclass, jstring documents, jstring bootstrapScripts,
                             jstring origin, jint bytecodeVersion, jstring platformInfo)
{
    LoaderConfiguration configuration;
    configuration.documents = toStdString(env, documents);
    loader::openLogFile(configuration.documents);
    configuration.bootstrapScripts =
        nlohmann::json::parse(toStdString(env, bootstrapScripts), nullptr, false);
    configuration.origin          = toStdString(env, origin);
    configuration.bytecodeVersion = static_cast<uint32_t>(bytecodeVersion);

    nlohmann::json info = nlohmann::json::parse(toStdString(env, platformInfo), nullptr, false);
    if (info.is_object())
    {
        configuration.platformInfo = std::move(info);
    }

    const std::string documentsPath = configuration.documents;
    const std::string originName    = configuration.origin;
    auto              host = std::make_shared<AndroidLoader>(std::move(configuration), gCallbacks);
    auto              loader = std::make_shared<loader::Loader>(
        loader::LoaderOptions{documentsPath, "Android", originName}, host,
        host->platformProvider());
    loader->start();
    loader->prescanAddons();
    setCurrentLoader(loader, host);
    loader::log(loader::LogLevel::Info, LOG_CATEGORY_DEFAULT, "Native loader initialized.");
}

static void nativeOnLoadJSBundle(JNIEnv *, jclass)
{
    if (auto loader = currentLoader())
    {
        loader->prepare();
    }
}

static void nativeMarkHealthy(JNIEnv *, jclass)
{
    if (auto loader = currentLoader())
    {
        loader->markHealthy();
    }
}

static void nativeOnForeground(JNIEnv *, jclass)
{
    if (auto loader = currentLoader())
    {
        loader->onForeground();
    }
}

static jstring nativeLaunchTimings(JNIEnv *env, jclass)
{
    return env->NewStringUTF(loader::LoaderPipeline::currentLaunchTimings().c_str());
}

static jboolean nativeOnRuntimeCreated(JNIEnv *, jclass, jlong runtimePointer)
{
    if (runtimePointer == 0)
    {
        return JNI_FALSE;
    }

    auto loader = currentLoader();
    auto host   = currentHost();
    if (!loader || !host)
    {
        return JNI_FALSE;
    }

    host->onRuntimeCreated();
    loader->onRuntimeCreated(*reinterpret_cast<facebook::jsi::Runtime *>(runtimePointer));
    return JNI_TRUE;
}

static void nativeDrainRuntimeWork(JNIEnv *, jclass, jlong runtimePointer)
{
    auto host = currentHost();
    if (!host || runtimePointer == 0)
    {
        return;
    }

    auto *runtime = reinterpret_cast<facebook::jsi::Runtime *>(runtimePointer);
    host->drainRuntimeWork(*runtime);
}

static jboolean nativeInstallSchedulerDrain(JNIEnv *, jclass, jlong runtimePointer)
{
    auto host = currentHost();
    if (!host || runtimePointer == 0)
    {
        return JNI_FALSE;
    }

    auto *runtime = reinterpret_cast<facebook::jsi::Runtime *>(runtimePointer);
    return host->installSchedulerDrain(*runtime) ? JNI_TRUE : JNI_FALSE;
}

static void nativeDispatchHookEvent(JNIEnv *env, jclass, jstring token, jstring payload)
{
    if (!token || !payload)
    {
        return;
    }

    unbound::android::dispatchHookEvent(unbound::android::toStdString(env, token),
                                        unbound::android::toStdString(env, payload));
}

static void nativeDrainMainWork(JNIEnv *, jclass)
{
    if (auto host = currentHost())
    {
        host->drainMainWork();
    }
}

static void nativeDrainFrameWork(JNIEnv *, jclass)
{
    if (auto host = currentHost())
    {
        host->drainMainFrameWork();
    }
}

static jint nativeHermesBytecodeVersion(JNIEnv *env, jclass, jbyteArray header)
{
    if (!header)
    {
        return 0;
    }

    jsize  length = env->GetArrayLength(header);
    jbyte *bytes  = env->GetByteArrayElements(header, nullptr);
    if (!bytes)
    {
        return 0;
    }

    uint32_t version = loader::hermesBytecodeVersion(bytes, static_cast<size_t>(length));
    env->ReleaseByteArrayElements(header, bytes, JNI_ABORT);
    return static_cast<jint>(version);
}

static jstring nativeHookReturnValue(JNIEnv *env, jclass, jstring token, jstring self,
                                     jstring arguments)
{
    if (!token || !self || !arguments)
    {
        return nullptr;
    }
    std::optional<std::string> value = unbound::android::hookReturnValue(
        toStdString(env, token), toStdString(env, self), toStdString(env, arguments));
    return value ? toJavaString(env, *value) : nullptr;
}

static jstring nativeToolbox(JNIEnv *env, jclass, jstring action, jstring argument)
{
    auto loader = currentLoader();
    if (!loader || !action)
    {
        return nullptr;
    }
    return toJavaString(env,
                        loader->toolbox(toStdString(env, action),
                                        argument ? toStdString(env, argument) : std::string()));
}

static void nativeEvictIdleSurfaces(JNIEnv *, jclass)
{
    loader::native::evictIdleFabricSurfaces();
}

static void nativeWarnOffMainViewCall(JNIEnv *env, jclass, jstring call)
{
    static loader::threading::OffMainViewWarnings warnings([] {
        auto loader = currentLoader();
        return loader && loader::preferences::developerMode(loader->settings());
    });
    if (!call || !warnings.enabled())
    {
        return;
    }
    if (auto warning = warnings.warning(loader::currentAddon(), toStdString(env, call)))
    {
        loader::log(loader::LogLevel::Warning, LOG_CATEGORY_PLUGINS, *warning);
    }
}

static jstring nativeActiveThemeId(JNIEnv *env, jclass)
{
    auto loader  = currentLoader();
    auto themeId = loader ? loader::preferences::activeThemeId(loader->settings()) : std::nullopt;
    return themeId ? toJavaString(env, *themeId) : nullptr;
}

static jstring nativeRecoveryActionLabel(JNIEnv *env, jclass)
{
    auto loader = currentLoader();
    return loader ? toJavaString(env, loader::preferences::recoveryActionLabel(
                                          loader::preferences::recoveryEnabled(loader->settings())))
                  : nullptr;
}

static jboolean nativeGestureEnabled(JNIEnv *env, jclass, jstring name)
{
    auto loader  = currentLoader();
    auto gesture = name ? loader::preferences::gestureNamed(toStdString(env, name)) : std::nullopt;
    return loader && gesture && loader::preferences::gestureEnabled(loader->settings(), *gesture)
               ? JNI_TRUE
               : JNI_FALSE;
}

static void nativeSetGestureEnabled(JNIEnv *env, jclass, jstring name, jboolean enabled)
{
    auto loader  = currentLoader();
    auto gesture = name ? loader::preferences::gestureNamed(toStdString(env, name)) : std::nullopt;
    if (loader && gesture)
    {
        loader::preferences::setGestureEnabled(loader->settings(), *gesture, enabled == JNI_TRUE);
    }
}

static jboolean nativeDevOverlayVisible(JNIEnv *, jclass, jboolean virtualDevice,
                                        jboolean debugBuild)
{
    auto loader = currentLoader();
    return loader && loader::preferences::devOverlayVisible(
                         loader->settings(), virtualDevice == JNI_TRUE, debugBuild == JNI_TRUE)
               ? JNI_TRUE
               : JNI_FALSE;
}

static jlong nativeToolboxHoldMilliseconds(JNIEnv *, jclass)
{
    return static_cast<jlong>(loader::toolbox::kThreeFingerHoldMilliseconds);
}

static jboolean nativeIsBlockedTelemetry(JNIEnv *env, jclass, jstring url)
{
    auto loader = currentLoader();
    return loader && url && loader::isTelemetryURL(toStdString(env, url)) &&
                   loader::preferences::telemetryBlocked(loader->settings())
               ? JNI_TRUE
               : JNI_FALSE;
}

struct ToolboxGestures {
    std::mutex                        mutex;
    loader::toolbox::ShakeSensor      shake;
    loader::toolbox::ThreeFingerPress press;
};

static ToolboxGestures &toolboxGestures()
{
    static ToolboxGestures gestures;
    return gestures;
}

static loader::toolbox::GestureEnabled gestureEnabled(loader::preferences::ToolboxGesture gesture)
{
    return [gesture] {
        auto loader = currentLoader();
        return loader && loader::preferences::gestureEnabled(loader->settings(), gesture);
    };
}

static jboolean nativeShakeSample(JNIEnv *, jclass, jfloat x, jfloat y, jfloat z,
                                  jlong milliseconds)
{
    ToolboxGestures            &gestures = toolboxGestures();
    std::lock_guard<std::mutex> lock(gestures.mutex);
    return gestures.shake.sample(x, y, z, milliseconds,
                                 gestureEnabled(loader::preferences::ToolboxGesture::Shake)) ==
                   loader::toolbox::GestureAction::Open
               ? JNI_TRUE
               : JNI_FALSE;
}

static jstring nativeThreeFingerEvent(JNIEnv *env, jclass, jstring event, jint pointers)
{
    const std::string              name     = toStdString(env, event);
    ToolboxGestures               &gestures = toolboxGestures();
    std::lock_guard<std::mutex>    lock(gestures.mutex);
    loader::toolbox::GestureAction action = loader::toolbox::GestureAction::None;
    if (name == "pointer-down")
    {
        action = gestures.press.pointerDown(
            pointers, gestureEnabled(loader::preferences::ToolboxGesture::ThreeFinger));
    }
    else if (name == "released")
    {
        action = gestures.press.released();
    }
    else if (name == "hold-elapsed")
    {
        action = gestures.press.holdElapsed();
    }
    return toJavaString(env, loader::toolbox::gestureActionName(action));
}

static jstring nativeResolveFont(JNIEnv *env, jclass, jstring family)
{
    auto loader = currentLoader();
    return toJavaString(env, loader ? loader->resolveFont(toStdString(env, family)) : "{}");
}

static jstring nativeDocumentsDirectory(JNIEnv *env, jclass, jstring parent)
{
    return toJavaString(env, loader::documentsDirectory(toStdString(env, parent)));
}

static jstring nativeSettingsFileName(JNIEnv *env, jclass)
{
    return toJavaString(env, loader::preferences::kSettingsFile);
}

static jstring nativeThemeColorsJSON(JNIEnv *env, jclass, jstring themeId)
{
    auto loader = currentLoader();
    return toJavaString(env, loader ? loader::toJSON(loader->themeColors(toStdString(env, themeId)))
                                    : "{}");
}

static void nativePrepareAddons(JNIEnv *, jclass)
{
    if (auto loader = currentLoader())
    {
        loader->onAddonsPrepared();
    }
}

static bool readOverlayBounds(JNIEnv *env, jdoubleArray bounds, loader::devoverlay::Size &size,
                              loader::devoverlay::Insets &insets)
{
    if (!bounds || env->GetArrayLength(bounds) < 6)
    {
        return false;
    }
    jdouble values[6];
    env->GetDoubleArrayRegion(bounds, 0, 6, values);
    size   = {values[0], values[1]};
    insets = {values[2], values[3], values[4], values[5]};
    return true;
}

static jdoubleArray toPointArray(JNIEnv *env, loader::devoverlay::Point point)
{
    jdoubleArray result = env->NewDoubleArray(2);
    if (result)
    {
        const jdouble values[2] = {point.x, point.y};
        env->SetDoubleArrayRegion(result, 0, 2, values);
    }
    return result;
}

static jdouble nativeDevOverlayButtonSide(JNIEnv *, jclass)
{
    return loader::devoverlay::kButtonSide;
}

static jdoubleArray nativeDevOverlayCenter(JNIEnv *env, jclass, jdoubleArray bounds)
{
    loader::devoverlay::Size   size;
    loader::devoverlay::Insets insets;
    auto                       loader = currentLoader();
    if (!loader || !readOverlayBounds(env, bounds, size, insets))
    {
        return nullptr;
    }
    return toPointArray(env, loader::devoverlay::buttonCenter(loader->settings(), size, insets));
}

static jdoubleArray nativeClampDevOverlayCenter(JNIEnv *env, jclass, jdouble x, jdouble y,
                                                jdoubleArray bounds)
{
    loader::devoverlay::Size   size;
    loader::devoverlay::Insets insets;
    if (!readOverlayBounds(env, bounds, size, insets))
    {
        return nullptr;
    }
    return toPointArray(env, loader::devoverlay::clampCenter({x, y}, size, insets));
}

static void nativeSaveDevOverlayCenter(JNIEnv *env, jclass, jdouble x, jdouble y,
                                       jdoubleArray bounds)
{
    loader::devoverlay::Size   size;
    loader::devoverlay::Insets insets;
    auto                       loader = currentLoader();
    if (loader && readOverlayBounds(env, bounds, size, insets))
    {
        loader::devoverlay::saveButtonCenter(loader->settings(), {x, y}, size);
    }
}

static jstring nativeIncompatibleHostMessage(JNIEnv *env, jclass)
{
    return toJavaString(env, loader::diagnostics::kIncompatibleHostMessage);
}

static jstring nativeDevelopmentBuildBanner(JNIEnv *env, jclass, jstring commit, jstring subject,
                                            jstring branch, jstring timestamp)
{
    const auto text = [env](jstring value) {
        return value ? toStdString(env, value) : std::string();
    };
    return toJavaString(env, loader::diagnostics::developmentBuildBanner(
                                 {text(commit), text(subject), text(branch), text(timestamp)}));
}

static jint nativeDevelopmentBuildBannerSeconds(JNIEnv *, jclass)
{
    return static_cast<jint>(loader::diagnostics::kBannerSeconds);
}

// Looks up every UNBOUND_BRIDGE_CALLBACKS entry; false, naming each missing one, when any is
// absent.
static bool cacheCallbacks(JNIEnv *env, jclass bridge)
{
    gCallbacks.bridgeClass = static_cast<jclass>(env->NewGlobalRef(bridge));
    bool found             = true;
#define UNBOUND_CACHE_CALLBACK(field, name, signature)                                             \
    gCallbacks.field = env->GetStaticMethodID(bridge, name, signature);                            \
    if (clearPendingException(env) || !gCallbacks.field)                                           \
    {                                                                                              \
        loader::log(loader::LogLevel::Error, LOG_CATEGORY_DEFAULT,                                 \
                    std::string("Failed to find NativeBridge.") + name + " " + signature);         \
        found = false;                                                                             \
    }
    UNBOUND_BRIDGE_CALLBACKS(UNBOUND_CACHE_CALLBACK)
#undef UNBOUND_CACHE_CALLBACK
    return found;
}

extern "C" JNIEXPORT jint JNI_OnLoad(JavaVM *vm, void *)
{
    setJavaVM(vm);
    loader::setLogSink(writeLog);

    JNIEnv *env = nullptr;
    if (vm->GetEnv(reinterpret_cast<void **>(&env), JNI_VERSION_1_6) != JNI_OK)
    {
        return JNI_ERR;
    }

    LocalClass bridge(env, env->FindClass(kBridgeClass));
    if (!bridge.get())
    {
        clearPendingException(env);
        return JNI_ERR;
    }

    static const JNINativeMethod methods[] = {
#define UNBOUND_NATIVE_METHOD(name, signature, function)                                           \
    {name, signature, reinterpret_cast<void *>(function)},
        UNBOUND_BRIDGE_NATIVES(UNBOUND_NATIVE_METHOD)
#undef UNBOUND_NATIVE_METHOD
    };

    if (env->RegisterNatives(bridge.get(), methods, sizeof(methods) / sizeof(methods[0])) !=
            JNI_OK ||
        !cacheCallbacks(env, bridge.get()) || !registerHotReloadNatives(env) ||
        !registerFileWatcherNatives(env) || !registerHermesSampler(env))
    {
        clearPendingException(env);
        return JNI_ERR;
    }

    return JNI_VERSION_1_6;
}
