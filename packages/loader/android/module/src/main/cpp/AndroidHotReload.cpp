#include "AndroidHotReload.h"

#include "AndroidLoader.h"
#include "JniEnvironment.h"

#include <algorithm>
#include <string>
#include <vector>

namespace unbound::android
{
    static const char *const kHotReloadClass = "app/unbound/android/HotReload";

    struct HotReloadCallbacks
    {
        jclass    hotReloadClass = nullptr;
        jmethodID open           = nullptr;
        jmethodID cancel         = nullptr;
        jmethodID reload         = nullptr;
    };

    static HotReloadCallbacks gHotReload;

    static jint milliseconds(double seconds)
    {
        return static_cast<jint>(seconds * 1000);
    }

    static void callHotReload(jmethodID method)
    {
        JNIEnv *env = currentEnvironment();
        if (!env)
        {
            return;
        }
        env->CallStaticVoidMethod(gHotReload.hotReloadClass, method);
        clearPendingException(env);
    }

    class AndroidHotReloadTransport final : public loader::HotReloadTransport
    {
    public:
        void open(const loader::HotReloadRequest &request) override
        {
            JNIEnv *env = currentEnvironment();
            if (!env)
            {
                return;
            }

            std::vector<std::string> keys;
            std::vector<std::string> values;
            for (const auto &[key, value] : request.headers)
            {
                keys.push_back(key);
                values.push_back(value);
            }

            jstring      url          = toJavaString(env, request.url);
            jobjectArray headerKeys   = toJavaStringArray(env, keys);
            jobjectArray headerValues = toJavaStringArray(env, values);
            env->CallStaticVoidMethod(gHotReload.hotReloadClass, gHotReload.open,
                                      static_cast<jlong>(request.connection), url, headerKeys, headerValues,
                                      milliseconds(request.connectTimeoutSeconds),
                                      milliseconds(request.readTimeoutSeconds));
            clearPendingException(env);
            env->DeleteLocalRef(url);
            env->DeleteLocalRef(headerKeys);
            env->DeleteLocalRef(headerValues);
        }

        void cancel() override
        {
            callHotReload(gHotReload.cancel);
        }
    };

    static std::shared_ptr<loader::HotReloadController> currentController()
    {
        auto loader = currentLoader();
        return loader ? loader->hotReload() : nullptr;
    }

    static void nativeSync(JNIEnv *, jclass)
    {
        if (auto controller = currentController())
        {
            controller->sync();
        }
    }

    static jboolean nativeResponse(JNIEnv *, jclass, jlong connection, jint status)
    {
        auto controller = currentController();
        return controller && controller->onResponse(static_cast<uint64_t>(connection), status) ? JNI_TRUE
                                                                                              : JNI_FALSE;
    }

    static jboolean nativeChunk(JNIEnv *env, jclass, jlong connection, jbyteArray chunk, jint length)
    {
        auto controller = currentController();
        if (!controller || !chunk)
        {
            return JNI_FALSE;
        }

        jsize       count = std::clamp<jsize>(length, 0, env->GetArrayLength(chunk));
        std::string bytes(static_cast<size_t>(count), '\0');
        env->GetByteArrayRegion(chunk, 0, count, reinterpret_cast<jbyte *>(bytes.data()));
        return controller->onChunk(static_cast<uint64_t>(connection), bytes) ? JNI_TRUE : JNI_FALSE;
    }

    static void nativeClosed(JNIEnv *env, jclass, jlong connection, jstring error)
    {
        if (auto controller = currentController())
        {
            controller->onClosed(static_cast<uint64_t>(connection), toOptionalString(env, error));
        }
    }

    bool registerHotReloadNatives(JNIEnv *env)
    {
        LocalClass hotReload(env, env->FindClass(kHotReloadClass));
        if (!hotReload.get())
        {
            clearPendingException(env);
            return false;
        }

        static const JNINativeMethod methods[] = {
            {"nativeSync", "()V", reinterpret_cast<void *>(nativeSync)},
            {"nativeResponse", "(JI)Z", reinterpret_cast<void *>(nativeResponse)},
            {"nativeChunk", "(J[BI)Z", reinterpret_cast<void *>(nativeChunk)},
            {"nativeClosed", "(JLjava/lang/String;)V", reinterpret_cast<void *>(nativeClosed)},
        };

        if (env->RegisterNatives(hotReload.get(), methods, sizeof(methods) / sizeof(methods[0])) != JNI_OK)
        {
            clearPendingException(env);
            return false;
        }

        gHotReload.hotReloadClass = static_cast<jclass>(env->NewGlobalRef(hotReload.get()));
        gHotReload.open           = env->GetStaticMethodID(
            hotReload.get(), "open", "(JLjava/lang/String;[Ljava/lang/String;[Ljava/lang/String;II)V");
        gHotReload.cancel = env->GetStaticMethodID(hotReload.get(), "cancel", "()V");
        gHotReload.reload = env->GetStaticMethodID(hotReload.get(), "reload", "()V");

        return !clearPendingException(env) && gHotReload.open && gHotReload.cancel && gHotReload.reload;
    }

    std::shared_ptr<loader::HotReloadController> createHotReloadController(
        loader::SettingsStore &settings, loader::HotReloadURLResolver resolveBaseURL,
        loader::HotReloadScheduler schedule)
    {
        return std::make_shared<loader::HotReloadController>(
            settings, std::move(resolveBaseURL), std::make_shared<AndroidHotReloadTransport>(),
            std::move(schedule), [] { callHotReload(gHotReload.reload); });
    }
}
