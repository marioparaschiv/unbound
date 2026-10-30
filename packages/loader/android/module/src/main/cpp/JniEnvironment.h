#pragma once

#include <jni.h>
#include <optional>
#include <string>
#include <vector>

namespace astral::android {
void    setJavaVM(JavaVM *vm);
JNIEnv *currentEnvironment();

std::string                toStdString(JNIEnv *env, jstring value);
std::optional<std::string> toOptionalString(JNIEnv *env, jstring value);
jstring                    toJavaString(JNIEnv *env, const std::string &value);
jobjectArray               toJavaStringArray(JNIEnv *env, const std::vector<std::string> &values);
bool                       clearPendingException(JNIEnv *env);

class LocalClass
{
public:
    LocalClass(JNIEnv *env, jclass cls);
    ~LocalClass();

    jclass get() const;

private:
    JNIEnv *env_;
    jclass  class_;
};
}
