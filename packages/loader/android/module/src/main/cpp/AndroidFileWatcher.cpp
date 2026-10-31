#include "AndroidFileWatcher.h"

#include <chrono>
#include <memory>
#include <mutex>
#include <string>
#include <thread>

#include "JniEnvironment.h"
#include "LoaderFileWatcher.h"
#include "LoaderPreferences.h"

namespace unbound::android {
static const char *const kSettingsWatcherClass = "app/unbound/android/SettingsWatcher";

struct SettingsWatcherCallbacks {
    jclass    watcherClass  = nullptr;
    jmethodID observe       = nullptr;
    jmethodID stopObserving = nullptr;
    jmethodID changed       = nullptr;
};

static SettingsWatcherCallbacks gCallbacks;

static void callWithPath(jmethodID method, const std::string &path)
{
    JNIEnv *env = currentEnvironment();
    if (!env)
    {
        return;
    }
    jstring value = toJavaString(env, path);
    env->CallStaticVoidMethod(gCallbacks.watcherClass, method, value);
    clearPendingException(env);
    env->DeleteLocalRef(value);
}

static void notifyChanged()
{
    JNIEnv *env = currentEnvironment();
    if (!env)
    {
        return;
    }
    env->CallStaticVoidMethod(gCallbacks.watcherClass, gCallbacks.changed);
    clearPendingException(env);
}

class FileObserverBackend final : public loader::FileWatchBackend
{
public:
    bool watchFile(const std::string &) override
    {
        return true;
    }

    void unwatchFile(const std::string &) override {}

    bool watchDirectory(const std::string &path) override
    {
        callWithPath(gCallbacks.observe, path);
        return true;
    }

    void unwatchDirectory(const std::string &path) override
    {
        callWithPath(gCallbacks.stopObserving, path);
    }
};

static void runAfter(double seconds, std::function<void()> work)
{
    std::thread([seconds, work = std::move(work)]() {
        std::this_thread::sleep_for(std::chrono::duration<double>(seconds));
        work();
    }).detach();
}

static std::shared_ptr<loader::FileWatcher> settingsWatcher()
{
    static std::shared_ptr<loader::FileWatcher> watcher = std::make_shared<loader::FileWatcher>(
        std::make_shared<FileObserverBackend>(), runAfter, loader::kFileObserverDebounceSeconds);
    return watcher;
}

static void nativeStart(JNIEnv *env, jclass, jstring documents)
{
    const std::string path = toStdString(env, documents) + "/" + loader::preferences::kSettingsFile;
    settingsWatcher()->watch(path, notifyChanged);
}

static void nativeDirectoryEvent(JNIEnv *env, jclass, jstring directory, jstring name)
{
    settingsWatcher()->directoryChanged(toStdString(env, directory), toOptionalString(env, name));
}

bool registerFileWatcherNatives(JNIEnv *env)
{
    LocalClass watcher(env, env->FindClass(kSettingsWatcherClass));
    if (!watcher.get())
    {
        clearPendingException(env);
        return false;
    }

    static const JNINativeMethod methods[] = {
        {"nativeStart", "(Ljava/lang/String;)V", reinterpret_cast<void *>(nativeStart)},
        {"nativeDirectoryEvent", "(Ljava/lang/String;Ljava/lang/String;)V",
         reinterpret_cast<void *>(nativeDirectoryEvent)},
    };

    if (env->RegisterNatives(watcher.get(), methods, sizeof(methods) / sizeof(methods[0])) !=
        JNI_OK)
    {
        clearPendingException(env);
        return false;
    }

    gCallbacks.watcherClass = static_cast<jclass>(env->NewGlobalRef(watcher.get()));
    gCallbacks.observe = env->GetStaticMethodID(watcher.get(), "observe", "(Ljava/lang/String;)V");
    gCallbacks.stopObserving =
        env->GetStaticMethodID(watcher.get(), "stopObserving", "(Ljava/lang/String;)V");
    gCallbacks.changed = env->GetStaticMethodID(watcher.get(), "changed", "()V");

    return !clearPendingException(env) && gCallbacks.observe && gCallbacks.stopObserving &&
           gCallbacks.changed;
}
}
