#pragma once

#include <jni.h>
#include <optional>
#include <string>
#include <type_traits>
#include <vector>

#include "JniEnvironment.h"

// Calls into static Java methods from any thread. `std::string` arguments cross as Java strings
// that are released after the call; every other argument passes as is, so it must already be a
// JNI type (jint, jboolean, jlong, jobject). A missing environment or method, or a Java exception,
// reads as failure, and the exception is cleared.
namespace unbound::android {
namespace jni {
    class LocalReferences
    {
    public:
        explicit LocalReferences(JNIEnv *env) : env_(env) {}
        LocalReferences(const LocalReferences &)            = delete;
        LocalReferences &operator=(const LocalReferences &) = delete;
        ~LocalReferences()
        {
            for (jobject reference : references_)
            {
                if (reference)
                {
                    env_->DeleteLocalRef(reference);
                }
            }
        }

        jstring string(const std::string &value)
        {
            jstring converted = toJavaString(env_, value);
            references_.push_back(converted);
            return converted;
        }

    private:
        JNIEnv              *env_;
        std::vector<jobject> references_;
    };

    template <typename T> T argument(LocalReferences &, const T &value)
    {
        static_assert(!std::is_same_v<T, bool>, "pass jboolean, as C varargs widen bool");
        return value;
    }

    inline jstring argument(LocalReferences &locals, const std::string &value)
    {
        return locals.string(value);
    }
}

// Whether the call ran without throwing.
template <typename... Args> bool callStaticVoid(jclass type, jmethodID method, const Args &...args)
{
    JNIEnv *env = currentEnvironment();
    if (!env || !type || !method)
    {
        return false;
    }
    jni::LocalReferences locals(env);
    env->CallStaticVoidMethod(type, method, jni::argument(locals, args)...);
    return !clearPendingException(env);
}

// False when the call failed, as well as when it returned false.
template <typename... Args>
bool callStaticBoolean(jclass type, jmethodID method, const Args &...args)
{
    JNIEnv *env = currentEnvironment();
    if (!env || !type || !method)
    {
        return false;
    }
    jni::LocalReferences locals(env);
    jboolean result = env->CallStaticBooleanMethod(type, method, jni::argument(locals, args)...);
    return !clearPendingException(env) && result == JNI_TRUE;
}

// None when the call failed or returned null.
template <typename... Args>
std::optional<std::string> callStaticString(jclass type, jmethodID method, const Args &...args)
{
    JNIEnv *env = currentEnvironment();
    if (!env || !type || !method)
    {
        return std::nullopt;
    }
    jni::LocalReferences locals(env);
    auto                 result = static_cast<jstring>(
        env->CallStaticObjectMethod(type, method, jni::argument(locals, args)...));
    if (clearPendingException(env) || !result)
    {
        if (result)
        {
            env->DeleteLocalRef(result);
        }
        return std::nullopt;
    }
    std::string text = toStdString(env, result);
    env->DeleteLocalRef(result);
    return text;
}
}
