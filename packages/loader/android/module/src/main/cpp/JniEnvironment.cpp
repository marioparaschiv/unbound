#include "JniEnvironment.h"

#include <pthread.h>

namespace unbound::android
{
    static JavaVM        *gJavaVM = nullptr;
    static pthread_key_t  gDetachKey;
    static pthread_once_t gDetachKeyOnce = PTHREAD_ONCE_INIT;

    static void detachThread(void *)
    {
        if (gJavaVM)
        {
            gJavaVM->DetachCurrentThread();
        }
    }

    static void createDetachKey()
    {
        pthread_key_create(&gDetachKey, detachThread);
    }

    void setJavaVM(JavaVM *vm)
    {
        gJavaVM = vm;
    }

    JNIEnv *currentEnvironment()
    {
        if (!gJavaVM)
        {
            return nullptr;
        }

        JNIEnv *env = nullptr;
        if (gJavaVM->GetEnv(reinterpret_cast<void **>(&env), JNI_VERSION_1_6) == JNI_OK)
        {
            return env;
        }

        if (gJavaVM->AttachCurrentThread(&env, nullptr) != JNI_OK)
        {
            return nullptr;
        }

        pthread_once(&gDetachKeyOnce, createDetachKey);
        pthread_setspecific(gDetachKey, env);
        return env;
    }

    std::string toStdString(JNIEnv *env, jstring value)
    {
        if (!value)
        {
            return std::string();
        }

        const char *characters = env->GetStringUTFChars(value, nullptr);
        std::string result(characters ? characters : "");
        if (characters)
        {
            env->ReleaseStringUTFChars(value, characters);
        }
        return result;
    }

    std::optional<std::string> toOptionalString(JNIEnv *env, jstring value)
    {
        if (!value)
        {
            return std::nullopt;
        }
        return toStdString(env, value);
    }

    jstring toJavaString(JNIEnv *env, const std::string &value)
    {
        return env->NewStringUTF(value.c_str());
    }

    jobjectArray toJavaStringArray(JNIEnv *env, const std::vector<std::string> &values)
    {
        LocalClass   stringClass(env, env->FindClass("java/lang/String"));
        jobjectArray array =
            env->NewObjectArray(static_cast<jsize>(values.size()), stringClass.get(), nullptr);
        for (size_t index = 0; index < values.size(); index++)
        {
            jstring element = toJavaString(env, values[index]);
            env->SetObjectArrayElement(array, static_cast<jsize>(index), element);
            env->DeleteLocalRef(element);
        }
        return array;
    }

    bool clearPendingException(JNIEnv *env)
    {
        if (!env->ExceptionCheck())
        {
            return false;
        }
        env->ExceptionDescribe();
        env->ExceptionClear();
        return true;
    }

    LocalClass::LocalClass(JNIEnv *env, jclass cls) : env_(env), class_(cls) {}

    LocalClass::~LocalClass()
    {
        if (class_)
        {
            env_->DeleteLocalRef(class_);
        }
    }

    jclass LocalClass::get() const
    {
        return class_;
    }
}
