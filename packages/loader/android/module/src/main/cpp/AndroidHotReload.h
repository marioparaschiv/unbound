#pragma once

#include <jni.h>
#include <memory>

#include "LoaderHotReload.h"

namespace unbound::android {
bool registerHotReloadNatives(JNIEnv *env);
void reloadApp();

// The stream connection `loader::Loader` runs hot reload over, through Kotlin's HotReload.
std::shared_ptr<loader::HotReloadTransport> createHotReloadTransport();
}
