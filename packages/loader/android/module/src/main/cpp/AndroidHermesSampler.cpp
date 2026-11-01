#include "AndroidHermesSampler.h"

#include "HermesSampling.h"
#include "JniEnvironment.h"

namespace unbound::android {
static constexpr const char *kSamplerClass = "app/unbound/android/HermesSampler";

static jclass    gSamplerClass = nullptr;
static jmethodID gStart        = nullptr;
static jmethodID gStop         = nullptr;

static bool start()
{
    JNIEnv *env = currentEnvironment();
    if (!env || !gSamplerClass || !gStart)
    {
        return false;
    }
    bool started = env->CallStaticBooleanMethod(gSamplerClass, gStart);
    return !clearPendingException(env) && started;
}

static std::string stop()
{
    JNIEnv *env = currentEnvironment();
    if (!env || !gSamplerClass || !gStop)
    {
        return {};
    }
    auto trace = static_cast<jstring>(env->CallStaticObjectMethod(gSamplerClass, gStop));
    if (clearPendingException(env) || !trace)
    {
        return {};
    }
    std::string text = toStdString(env, trace);
    env->DeleteLocalRef(trace);
    return text;
}

bool registerHermesSampler(JNIEnv *env)
{
    LocalClass sampler(env, env->FindClass(kSamplerClass));
    if (!sampler.get())
    {
        clearPendingException(env);
        return false;
    }
    gSamplerClass = static_cast<jclass>(env->NewGlobalRef(sampler.get()));
    gStart        = env->GetStaticMethodID(sampler.get(), "start", "()Z");
    gStop         = env->GetStaticMethodID(sampler.get(), "stop", "()Ljava/lang/String;");
    if (clearPendingException(env) || !gStart || !gStop)
    {
        return false;
    }
    loader::native::setJavaScriptProfiler({start, stop});
    return true;
}
}
