#include "AndroidFabricAdapter.h"

#include <algorithm>
#include <cmath>
#include <functional>
#include <iterator>
#include <jsi/instrumentation.h>
#include <memory>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <string>
#include <sys/types.h>
#include <unistd.h>
#include <unordered_map>
#include <vector>

#include "AndroidJavaValues.h"
#include "JavaHandleRelease.h"
#include "JniCall.h"
#include "LoaderAddonActivity.h"
#include "LoaderBootstrap.h"
#include "LoaderJSIJSON.h"
#include "LoaderLog.h"
#include "LoaderThreadWarnings.h"
#include "NativeBoundedValue.h"
#include "NativeEvaluations.h"
#include "NativeFFI.h"
#include "NativeFabric.h"
#include "NativeGeometry.h"
#include "NativeHandleLeases.h"
#include "NativeHookCallbacks.h"
#include "NativeHookKeys.h"
#include "NativeHookReturnCache.h"
#include "NativeLimits.h"
#include "NativePlatformBridge.h"
#include "NativePluginRoot.h"
#include "NativeResourceBudget.h"
#include "NativeRuntimeResources.h"
#include "NativeTaggedValue.h"
#include "NativeTraversalOptions.h"
#include "NativeUIScope.h"

namespace unbound::android {
namespace jsi = facebook::jsi;

static std::string surfaceContainer(jsi::Runtime &runtime, const jsi::Value &value)
{
    if (!value.isObject())
    {
        return "{}";
    }
    jsi::Object candidate = value.asObject(runtime);
    if (candidate.getProperty(runtime, "id").isString() ||
        candidate.getProperty(runtime, "value").isString())
    {
        return serializeJavaHandle(runtime, value);
    }
    return "{}";
}

class AndroidFabricView final : public loader::native::FabricView
{
public:
    explicit AndroidFabricView(std::string handle) : handle(std::move(handle)) {}

    std::string handle;
};

class AndroidFabricAdapter final : public loader::native::FabricAdapter
{
public:
    explicit AndroidFabricAdapter(const JavaCallbacks &callbacks) : callbacks_(callbacks) {}

    std::shared_ptr<loader::native::FabricView> view(jsi::Runtime     &runtime,
                                                     const jsi::Value &handle) override
    {
        return std::make_shared<AndroidFabricView>(surfaceContainer(runtime, handle));
    }

    std::string mount(const loader::native::FabricView &container, const std::string &moduleName,
                      const nlohmann::json &properties) override
    {
        std::string handle =
            callJavaString(callbacks_, callbacks_.fabricMount,
                           {static_cast<const AndroidFabricView &>(container).handle, moduleName,
                            properties.dump()});
        nlohmann::json parsed = nlohmann::json::parse(handle, nullptr, false);
        if (parsed.is_discarded() || !parsed.contains("id") || !parsed["id"].is_string())
        {
            throw std::runtime_error("The Android surface adapter returned an invalid handle");
        }
        return parsed["id"].get<std::string>();
    }

    bool update(const std::string &surface, const nlohmann::json &properties) override
    {
        callJavaVoid(callbacks_, callbacks_.fabricUpdate,
                     {loader::native::handleJSON(surface), properties.dump()});
        return true;
    }

    void setSize(const std::string &surface, const loader::native::NativeSize &minimum,
                 const loader::native::NativeSize &maximum) override
    {
        callJavaVoid(callbacks_, callbacks_.fabricSetSize,
                     {loader::native::handleJSON(surface), loader::native::toJSON(minimum).dump(),
                      loader::native::toJSON(maximum).dump()});
    }

    void setFrame(const std::string &surface, const loader::native::NativeFrame &frame) override
    {
        callJavaVoid(callbacks_, callbacks_.fabricSetFrame,
                     {loader::native::handleJSON(surface), loader::native::toJSON(frame).dump()});
    }

    loader::native::NativeFrame measure(const loader::native::FabricView &view) override
    {
        return measureHandle(static_cast<const AndroidFabricView &>(view).handle);
    }

    loader::native::NativeFrame measureSurface(const std::string &surface) override
    {
        return measureHandle(loader::native::handleJSON(surface));
    }

    void unmount(const std::string &surface) override
    {
        invokeStaticBoolean(callbacks_.bridgeClass, callbacks_.fabricUnmount,
                            loader::native::handleJSON(surface));
    }

    bool detach(const std::string &surface) override
    {
        return callbacks_.fabricDetach && callbacks_.fabricAttach &&
               invokeStaticBoolean(callbacks_.bridgeClass, callbacks_.fabricDetach,
                                   loader::native::handleJSON(surface));
    }

    bool attach(const std::string &surface, const loader::native::FabricView &container) override
    {
        callJavaVoid(callbacks_, callbacks_.fabricAttach,
                     {loader::native::handleJSON(surface),
                      static_cast<const AndroidFabricView &>(container).handle});
        return true;
    }

private:
    loader::native::NativeFrame measureHandle(const std::string &handle)
    {
        return loader::native::parseFrame(
            nlohmann::json::parse(callJavaString(callbacks_, callbacks_.fabricMeasure, {handle})));
    }

    JavaCallbacks callbacks_;
};

std::shared_ptr<loader::native::FabricAdapter>
makeAndroidFabricAdapter(const JavaCallbacks &callbacks)
{
    return std::make_shared<AndroidFabricAdapter>(callbacks);
}
}
