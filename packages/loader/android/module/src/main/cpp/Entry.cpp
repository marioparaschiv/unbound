#include "AndroidHotReload.h"
#include "AndroidLoader.h"
#include "LoaderDevOverlay.h"
#include "LoaderColor.h"
#include "LoaderPreferences.h"
#include "HermesBytecodeHeader.h"
#include "JniEnvironment.h"
#include "LoaderLog.h"
#include "LoaderPreload.h"
#include "LoaderJSI.h"
#include "NativePluginBridge.h"

#include <android/log.h>
#include <jni.h>

using namespace unbound::android;

static const char *const kBridgeClass = "app/unbound/android/NativeBridge";

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

static void writeLog(loader::LogLevel level, const std::string &category, const std::string &message)
{
    __android_log_write(androidPriority(level), "Unbound", loader::formatLogLine(category, message).c_str());
}

static void nativeLog(JNIEnv *env, jclass, jint level, jstring category, jstring message)
{
    loader::logFromPlatform(level, category ? toStdString(env, category) : LOG_CATEGORY_DEFAULT,
                            message ? toStdString(env, message) : std::string());
}

static void nativeInitialize(JNIEnv *env, jclass, jstring documents, jstring bootstrapScripts,
                             jstring origin, jint bytecodeVersion,
                             jstring platformInfo)
{
    LoaderConfiguration configuration;
    configuration.documents       = toStdString(env, documents);
    configuration.bootstrapScripts = nlohmann::json::parse(toStdString(env, bootstrapScripts), nullptr, false);
    configuration.origin          = toStdString(env, origin);
    configuration.bytecodeVersion = static_cast<uint32_t>(bytecodeVersion);

    nlohmann::json info = nlohmann::json::parse(toStdString(env, platformInfo), nullptr, false);
    if (info.is_object())
    {
        configuration.platformInfo = std::move(info);
    }

    auto loader = std::make_shared<AndroidLoader>(std::move(configuration), gCallbacks);
    loader->start();
    setCurrentLoader(loader);
    loader::log(loader::LogLevel::Info, LOG_CATEGORY_DEFAULT, "Native loader initialized.");
}

static void nativeOnLoadJSBundle(JNIEnv *, jclass)
{
    if (auto loader = currentLoader())
    {
        loader->onLoadJSBundle();
    }
}

static void nativeOnJSBundleLoaded(JNIEnv *, jclass)
{
    if (auto loader = currentLoader())
    {
        loader->onJSBundleLoaded();
    }
}

static jboolean nativeInstallMetroModuleCapture(JNIEnv *, jclass, jlong runtimePointer)
{
    if (runtimePointer == 0)
    {
        return JNI_FALSE;
    }

    auto loader = currentLoader();
    if (!loader)
    {
        return JNI_FALSE;
    }

    loader->onRuntimeCreated(*reinterpret_cast<facebook::jsi::Runtime *>(runtimePointer));
    return JNI_TRUE;
}

static void nativeDrainRuntimeWork(JNIEnv *, jclass, jlong runtimePointer)
{
    auto loader = currentLoader();
    if (!loader || runtimePointer == 0)
    {
        return;
    }

    auto *runtime = reinterpret_cast<facebook::jsi::Runtime *>(runtimePointer);
    loader->drainRuntimeWork(*runtime);
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
    if (auto loader = currentLoader())
    {
        loader->drainMainWork();
    }
}

static jint nativeHermesBytecodeVersion(JNIEnv *env, jclass, jbyteArray header)
{
    if (!header)
    {
        return 0;
    }

    jsize length = env->GetArrayLength(header);
    jbyte *bytes  = env->GetByteArrayElements(header, nullptr);
    if (!bytes)
    {
        return 0;
    }

    uint32_t version = loader::hermesBytecodeVersion(bytes, static_cast<size_t>(length));
    env->ReleaseByteArrayElements(header, bytes, JNI_ABORT);
    return static_cast<jint>(version);
}

static jstring nativeHookReturnValue(JNIEnv *env, jclass, jstring token, jstring self, jstring arguments)
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
    return toJavaString(env, loader->toolbox(toStdString(env, action),
                                             argument ? toStdString(env, argument) : std::string()));
}

static jstring nativePreference(JNIEnv *env, jclass, jstring action, jstring argument)
{
    auto loader = currentLoader();
    if (!loader || !action)
    {
        return nullptr;
    }
    return toJavaString(env, loader::preferences::perform(loader->settings(), toStdString(env, action),
                                                          argument ? toStdString(env, argument) : std::string()));
}

static jlong nativeParseColor(JNIEnv *env, jclass, jstring value)
{
    if (!value)
    {
        return -1;
    }
    const auto color = loader::parseColor(toStdString(env, value));
    return color ? static_cast<jlong>(loader::toARGB(*color)) : -1;
}

static jdoubleArray nativeMessageBubbleStyle(JNIEnv *env, jclass)
{
    const auto  &style     = loader::preferences::kMessageBubbleStyle;
    const jdouble values[] = {style.radius, style.horizontalPadding, style.verticalPadding,
                              static_cast<jdouble>(loader::toARGB(loader::preferences::messageBubbleColor(true))),
                              static_cast<jdouble>(loader::toARGB(loader::preferences::messageBubbleColor(false)))};
    jdoubleArray result = env->NewDoubleArray(5);
    if (result)
    {
        env->SetDoubleArrayRegion(result, 0, 5, values);
    }
    return result;
}

static jstring nativeResolveFont(JNIEnv *env, jclass, jstring family)
{
    auto loader = currentLoader();
    return toJavaString(env, loader ? loader->resolveFont(toStdString(env, family)) : "{}");
}

static jstring nativeDocumentsName(JNIEnv *env, jclass)
{
    return toJavaString(env, loader::preferences::kDocumentsName);
}

static jstring nativeSettingsFileName(JNIEnv *env, jclass)
{
    return toJavaString(env, loader::preferences::kSettingsFile);
}

static jstring nativeThemeColorsJSON(JNIEnv *env, jclass, jstring themeId)
{
    auto loader = currentLoader();
    return toJavaString(env, loader ? loader->themeColorsJSON(toStdString(env, themeId)) : "{}");
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

static jdoubleArray nativeClampDevOverlayCenter(JNIEnv *env, jclass, jdouble x, jdouble y, jdoubleArray bounds)
{
    loader::devoverlay::Size   size;
    loader::devoverlay::Insets insets;
    if (!readOverlayBounds(env, bounds, size, insets))
    {
        return nullptr;
    }
    return toPointArray(env, loader::devoverlay::clampCenter({x, y}, size, insets));
}

static void nativeSaveDevOverlayCenter(JNIEnv *env, jclass, jdouble x, jdouble y, jdoubleArray bounds)
{
    loader::devoverlay::Size   size;
    loader::devoverlay::Insets insets;
    auto                       loader = currentLoader();
    if (loader && readOverlayBounds(env, bounds, size, insets))
    {
        loader::devoverlay::saveButtonCenter(loader->settings(), {x, y}, size);
    }
}

static bool cacheCallbacks(JNIEnv *env, jclass bridge)
{
    gCallbacks.bridgeClass     = static_cast<jclass>(env->NewGlobalRef(bridge));
    gCallbacks.scheduleRuntime = env->GetStaticMethodID(bridge, "scheduleRuntimeWork", "()V");
    gCallbacks.scheduleMain    = env->GetStaticMethodID(bridge, "scheduleMainWork", "()V");
    gCallbacks.isMainThread    = env->GetStaticMethodID(bridge, "isMainThread", "()Z");
    gCallbacks.lookupViews = env->GetStaticMethodID(
        bridge, "lookupViews", "(Ljava/lang/String;)Ljava/lang/String;");
    gCallbacks.snapshotViews = env->GetStaticMethodID(
        bridge, "snapshotViews", "(Ljava/lang/String;)Ljava/lang/String;");
    gCallbacks.measureView = env->GetStaticMethodID(
        bridge, "measureView", "(Ljava/lang/String;)Ljava/lang/String;");
    gCallbacks.setViewFrame = env->GetStaticMethodID(
        bridge, "setViewFrame", "(Ljava/lang/String;Ljava/lang/String;)V");
    gCallbacks.mountView = env->GetStaticMethodID(
        bridge, "mountView",
        "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;");
    gCallbacks.updateView = env->GetStaticMethodID(
        bridge, "updateView", "(Ljava/lang/String;Ljava/lang/String;)V");
    gCallbacks.unmountView = env->GetStaticMethodID(
        bridge, "unmountView", "(Ljava/lang/String;)V");
    gCallbacks.javaGetClass = env->GetStaticMethodID(
        bridge, "javaGetClass", "(Ljava/lang/String;)Ljava/lang/String;");
    gCallbacks.javaClassName = env->GetStaticMethodID(
        bridge, "javaClassName", "(Ljava/lang/String;)Ljava/lang/String;");
    gCallbacks.javaConstruct = env->GetStaticMethodID(
        bridge, "javaConstruct", "(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;");
    gCallbacks.javaRespondsTo = env->GetStaticMethodID(
        bridge, "javaRespondsTo",
        "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;");
    gCallbacks.javaInvoke = env->GetStaticMethodID(
        bridge, "javaInvoke",
        "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;");
    gCallbacks.javaGetField = env->GetStaticMethodID(
        bridge, "javaGetField", "(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;");
    gCallbacks.javaSetField = env->GetStaticMethodID(
        bridge, "javaSetField", "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V");
    gCallbacks.javaRelease =
        env->GetStaticMethodID(bridge, "javaRelease", "(Ljava/lang/String;)V");
    gCallbacks.hooksInstall = env->GetStaticMethodID(
        bridge, "hooksInstall",
        "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)Ljava/lang/"
        "String;");
    gCallbacks.hooksRemove =
        env->GetStaticMethodID(bridge, "hooksRemove", "(Ljava/lang/String;)V");
    gCallbacks.runtimeReplaced = env->GetStaticMethodID(bridge, "runtimeReplaced", "()V");
    gCallbacks.javaBatch = env->GetStaticMethodID(
        bridge, "javaBatch", "(Ljava/lang/String;)Ljava/lang/String;");
    gCallbacks.javaCreateAssociationKey =
        env->GetStaticMethodID(bridge, "javaCreateAssociationKey", "()Ljava/lang/String;");
    gCallbacks.javaGetAssociatedObject = env->GetStaticMethodID(
        bridge, "javaGetAssociatedObject",
        "(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;");
    gCallbacks.javaSetAssociatedObject = env->GetStaticMethodID(
        bridge, "javaSetAssociatedObject",
        "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;I)V");
    gCallbacks.fabricMount = env->GetStaticMethodID(
        bridge, "fabricMount",
        "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;");
    gCallbacks.fabricUpdate = env->GetStaticMethodID(
        bridge, "fabricUpdate", "(Ljava/lang/String;Ljava/lang/String;)V");
    gCallbacks.fabricUnmount =
        env->GetStaticMethodID(bridge, "fabricUnmount", "(Ljava/lang/String;)Z");
    gCallbacks.fabricSetSize = env->GetStaticMethodID(
        bridge, "fabricSetSize", "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V");
    gCallbacks.fabricSetFrame = env->GetStaticMethodID(
        bridge, "fabricSetFrame", "(Ljava/lang/String;Ljava/lang/String;)V");
    gCallbacks.fabricMeasure = env->GetStaticMethodID(
        bridge, "fabricMeasure", "(Ljava/lang/String;)Ljava/lang/String;");
    gCallbacks.fetchText =
        env->GetStaticMethodID(bridge, "fetchText", "(Ljava/lang/String;I)Ljava/lang/String;");
    gCallbacks.download = env->GetStaticMethodID(
        bridge, "download",
        "(Ljava/lang/String;Ljava/lang/String;[Ljava/lang/String;[Ljava/lang/String;III)[Ljava/lang/"
        "String;");
    gCallbacks.devServerHost = env->GetStaticMethodID(bridge, "devServerHost", "()Ljava/lang/String;");
    gCallbacks.isServing     = env->GetStaticMethodID(bridge, "isServing", "(Ljava/lang/String;I)Z");
    gCallbacks.availableFonts =
        env->GetStaticMethodID(bridge, "availableFonts", "()[Ljava/lang/String;");
    gCallbacks.appFonts = env->GetStaticMethodID(bridge, "appFonts", "()[Ljava/lang/String;");
    gCallbacks.appFontBytes = env->GetStaticMethodID(bridge, "appFontBytes", "(Ljava/lang/String;)[B");
    gCallbacks.alert = env->GetStaticMethodID(bridge, "alert", "(Ljava/lang/String;)V");
    gCallbacks.onBundleExecuted = env->GetStaticMethodID(bridge, "onBundleExecuted", "()V");

    return !clearPendingException(env) && gCallbacks.scheduleRuntime && gCallbacks.scheduleMain &&
           gCallbacks.isMainThread && gCallbacks.lookupViews && gCallbacks.snapshotViews &&
           gCallbacks.measureView && gCallbacks.setViewFrame && gCallbacks.mountView &&
           gCallbacks.updateView && gCallbacks.unmountView && gCallbacks.javaGetClass &&
           gCallbacks.javaClassName && gCallbacks.javaConstruct && gCallbacks.javaRespondsTo &&
           gCallbacks.javaInvoke && gCallbacks.javaGetField && gCallbacks.javaSetField &&
           gCallbacks.javaRelease && gCallbacks.hooksInstall && gCallbacks.hooksRemove &&
           gCallbacks.runtimeReplaced &&
           gCallbacks.javaBatch &&
           gCallbacks.javaCreateAssociationKey && gCallbacks.javaGetAssociatedObject &&
           gCallbacks.javaSetAssociatedObject && gCallbacks.fabricMount &&
           gCallbacks.fabricUpdate && gCallbacks.fabricUnmount && gCallbacks.fabricSetSize &&
           gCallbacks.fabricSetFrame && gCallbacks.fabricMeasure && gCallbacks.fetchText &&
           gCallbacks.download && gCallbacks.devServerHost && gCallbacks.isServing && gCallbacks.availableFonts && gCallbacks.appFonts && gCallbacks.appFontBytes &&
           gCallbacks.alert && gCallbacks.onBundleExecuted;
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
        {"nativeInitialize",
         "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;ILjava/lang/String;)V",
         reinterpret_cast<void *>(nativeInitialize)},
        {"nativeOnLoadJSBundle", "()V", reinterpret_cast<void *>(nativeOnLoadJSBundle)},
        {"nativeOnJSBundleLoaded", "()V", reinterpret_cast<void *>(nativeOnJSBundleLoaded)},
        {"nativeInstallMetroModuleCapture", "(J)Z",
         reinterpret_cast<void *>(nativeInstallMetroModuleCapture)},
        {"nativeDrainRuntimeWork", "(J)V", reinterpret_cast<void *>(nativeDrainRuntimeWork)},
        {"nativeDrainMainWork", "()V", reinterpret_cast<void *>(nativeDrainMainWork)},
        {"nativeDispatchHookEvent", "(Ljava/lang/String;Ljava/lang/String;)V",
         reinterpret_cast<void *>(nativeDispatchHookEvent)},
        {"nativeHermesBytecodeVersion", "([B)I",
         reinterpret_cast<void *>(nativeHermesBytecodeVersion)},
        {"nativeHookReturnValue", "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;",
         reinterpret_cast<void *>(nativeHookReturnValue)},
        {"nativeToolbox", "(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;",
         reinterpret_cast<void *>(nativeToolbox)},
        {"nativePreference", "(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;",
         reinterpret_cast<void *>(nativePreference)},
        {"nativeParseColor", "(Ljava/lang/String;)J", reinterpret_cast<void *>(nativeParseColor)},
        {"nativeMessageBubbleStyle", "()[D", reinterpret_cast<void *>(nativeMessageBubbleStyle)},
        {"nativeResolveFont", "(Ljava/lang/String;)Ljava/lang/String;", reinterpret_cast<void *>(nativeResolveFont)},
        {"nativeDocumentsName", "()Ljava/lang/String;", reinterpret_cast<void *>(nativeDocumentsName)},
        {"nativeSettingsFileName", "()Ljava/lang/String;", reinterpret_cast<void *>(nativeSettingsFileName)},
        {"nativeThemeColorsJSON", "(Ljava/lang/String;)Ljava/lang/String;",
         reinterpret_cast<void *>(nativeThemeColorsJSON)},
        {"nativePrepareAddons", "()V", reinterpret_cast<void *>(nativePrepareAddons)},
        {"nativeLog", "(ILjava/lang/String;Ljava/lang/String;)V", reinterpret_cast<void *>(nativeLog)},
        {"nativeDevOverlayButtonSide", "()D", reinterpret_cast<void *>(nativeDevOverlayButtonSide)},
        {"nativeDevOverlayCenter", "([D)[D", reinterpret_cast<void *>(nativeDevOverlayCenter)},
        {"nativeClampDevOverlayCenter", "(DD[D)[D", reinterpret_cast<void *>(nativeClampDevOverlayCenter)},
        {"nativeSaveDevOverlayCenter", "(DD[D)V", reinterpret_cast<void *>(nativeSaveDevOverlayCenter)},
    };

    if (env->RegisterNatives(bridge.get(), methods, sizeof(methods) / sizeof(methods[0])) != JNI_OK ||
        !cacheCallbacks(env, bridge.get()) || !registerHotReloadNatives(env))
    {
        clearPendingException(env);
        return JNI_ERR;
    }

    return JNI_VERSION_1_6;
}
