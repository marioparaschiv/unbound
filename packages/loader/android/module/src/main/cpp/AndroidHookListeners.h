#pragma once

#include <jsi/jsi.h>
#include <memory>
#include <nlohmann/json.hpp>
#include <optional>
#include <string>
#include <vector>

#include "AndroidLoader.h"
#include "JavaHandleRelease.h"
#include "NativeHookCallbacks.h"
#include "NativeHookReturnCache.h"
#include "NativeRuntimeResources.h"

namespace unbound::android {
namespace jsi = facebook::jsi;

bool onMainThread();
void rememberHookListener(jsi::Runtime &runtime, const std::string &token,
                          const jsi::Value &listener, bool coalesce, JavaCallbacks callbacks);
void forgetHookListener(const std::string &token);
std::string                             hookTokenId(jsi::Runtime &runtime, const jsi::Value &value);
loader::native::NativeResourceRegistry &installedHooks();
loader::native::HookReturnCache        &hookReturnValues();
std::string    installedHookToken(jsi::Runtime &runtime, const jsi::Value &value);
nlohmann::json boundedJSON(jsi::Runtime &runtime, const jsi::Value &value);
nlohmann::json boundedArgumentsJSON(jsi::Runtime &runtime, const jsi::Value &value);
void           watchRuntimeGenerations(const JavaCallbacks &callbacks);
}
