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

std::string callJavaString(const JavaCallbacks &callbacks, jmethodID method,
                           const std::vector<std::string> &arguments);
void        callJavaVoid(const JavaCallbacks &callbacks, jmethodID method,
                         const std::vector<std::string> &arguments);
std::string javaName(jsi::Runtime &runtime, const jsi::Value &value);
std::string serializeJavaHandle(jsi::Runtime &runtime, const jsi::Value &value);
std::string serializeJavaBatch(jsi::Runtime &runtime, const jsi::Value &value);
void        callSetAssociatedObject(const JavaCallbacks &callbacks, const std::string &handle,
                                    const std::string &key, const std::string &value);
std::string serializeJavaArguments(jsi::Runtime &runtime, const jsi::Value *args, size_t count,
                                   size_t index);
std::string serializeJavaParameterTypes(jsi::Runtime &runtime, const jsi::Value &value);
std::string serializeJavaValue(jsi::Runtime &runtime, const jsi::Value &value);
std::optional<JavaCallbacks> javaReleaseCallbacks();
void                         leaseJavaHandles(const JavaCallbacks &callbacks);
jsi::Value                   adoptJavaValue(jsi::Runtime &runtime, const nlohmann::json &value);
std::optional<jsi::Value> adoptTaggedJavaEvent(jsi::Runtime &runtime, const std::string &payload);
jsi::Value                parseJavaResult(jsi::Runtime &runtime, const std::string &response);
JavaHandleReleaser        javaHandleReleaser(JavaCallbacks callbacks);
std::shared_ptr<PendingJavaPayload> pendingJavaPayload(const JavaCallbacks &callbacks,
                                                       std::string          payload = {});
jsi::Value javaAsynchronously(jsi::Runtime &runtime, const JavaCallbacks &callbacks,
                              std::function<std::string()> work);
jsi::Value javaSynchronously(jsi::Runtime &runtime, const JavaCallbacks &callbacks,
                             jmethodID method, const std::vector<std::string> &arguments);
}
