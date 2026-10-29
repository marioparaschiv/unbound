#include "AndroidHermesSampler.h"

#include "HermesSampling.h"
#include "JniEnvironment.h"

namespace unbound::android {
static constexpr const char *kSamplerClass = "app/unbound/android/HermesSampler";

static jclass    gSamplerClass = nullptr;
static jmethodID gSample       = nullptr;

static std::string sample(std::chrono::milliseconds duration)
{
    JNIEnv *env = currentEnvironment();
    if (!env || !gSamplerClass || !gSample)
    {
        return {};
    }
    auto trace = static_cast<jstring>(
        env->CallStaticObjectMethod(gSamplerClass, gSample, static_cast<jlong>(duration.count())));
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
    gSample       = env->GetStaticMethodID(sampler.get(), "sample", "(J)Ljava/lang/String;");
    if (clearPendingException(env) || !gSample)
    {
        return false;
    }
    loader::native::setJavaScriptSampler(sample);
    return true;
}
}
