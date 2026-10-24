// Trimmed copy of RN 0.83.1 ReactCommon/.../TurboModule.h.
// LAYOUT-CRITICAL: data members and virtual declaration order must match the
// binary. Deviations (layout-neutral): EventEmitter.h include replaced by a
// forward-decl of IAsyncEventEmitter (only held as shared_ptr); inline bodies
// reduced to declarations (definitions resolve from the React dylib).

#pragma once

#include <memory>
#include <string>
#include <unordered_map>

#include <jsi/jsi.h>

#include <ReactCommon/CallInvoker.h>

namespace facebook::react {

// Forward-decl in place of <react/bridging/EventEmitter.h> (held only as shared_ptr).
class IAsyncEventEmitter;

/**
 * For now, support the same set of return types as existing impl.
 * This can be improved to support richer typed objects.
 */
enum TurboModuleMethodValueKind {
  VoidKind,
  BooleanKind,
  NumberKind,
  StringKind,
  ObjectKind,
  ArrayKind,
  FunctionKind,
  PromiseKind,
};

/**
 * Determines TurboModuleMethodValueKind based on the jsi::Value type.
 */
TurboModuleMethodValueKind getTurboModuleMethodValueKind(jsi::Runtime &rt, const jsi::Value *value);

class TurboCxxModule;
class TurboModuleBinding;

/**
 * Base HostObject class for every module to be exposed to JS
 */
class JSI_EXPORT TurboModule : public jsi::HostObject {
 public:
  TurboModule(std::string name, std::shared_ptr<CallInvoker> jsInvoker);

  jsi::Value get(jsi::Runtime &runtime, const jsi::PropNameID &propName) override;

  std::vector<jsi::PropNameID> getPropertyNames(jsi::Runtime &runtime) override;

 protected:
  const std::string name_;
  std::shared_ptr<CallInvoker> jsInvoker_;

  struct MethodMetadata {
    size_t argCount;
    jsi::Value (*invoker)(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value *args, size_t count);
  };
  std::unordered_map<std::string, MethodMetadata> methodMap_;

  friend class TurboModuleTestFixtureInternal;
  std::unordered_map<std::string, std::shared_ptr<IAsyncEventEmitter>> eventEmitterMap_;

  using ArgFactory = std::function<void(jsi::Runtime &runtime, std::vector<jsi::Value> &args)>;

  void emitDeviceEvent(const std::string &eventName, ArgFactory &&argFactory = nullptr);

  // Backwards compatibility version
  void emitDeviceEvent(
      jsi::Runtime & /*runtime*/,

      const std::string &eventName,
      ArgFactory &&argFactory = nullptr);

  virtual jsi::Value create(jsi::Runtime &runtime, const jsi::PropNameID &propName);

 private:
  friend class TurboModuleBinding;
  std::unique_ptr<jsi::WeakObject> jsRepresentation_;
};

/**
 * An app/platform-specific provider function to get an instance of a module
 * given a name.
 */
using TurboModuleProviderFunctionType = std::function<std::shared_ptr<TurboModule>(const std::string &name)>;

} // namespace facebook::react
