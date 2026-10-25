#pragma once

#include <jni.h>

#include <memory>

#include "LoaderHotReload.h"

namespace unbound::android
{
    bool registerHotReloadNatives(JNIEnv *env);

    std::shared_ptr<loader::HotReloadController> createHotReloadController(
        loader::SettingsStore &settings, loader::HotReloadURLResolver resolveBaseURL,
        loader::HotReloadScheduler schedule);
}
