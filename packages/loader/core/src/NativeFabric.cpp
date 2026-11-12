#include "NativeFabric.h"

#include <algorithm>
#include <atomic>
#include <deque>
#include <functional>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <unordered_map>
#include <vector>

#include "LoaderAddonActivity.h"
#include "LoaderJSIJSON.h"
#include "LoaderLog.h"
#include "NativeBoundedValue.h"
#include "NativeConversionBudget.h"
#include "NativeFabricSurfacePool.h"
#include "NativeLimits.h"
#include "NativePluginRuntime.h"
#include "NativeResourceBudget.h"

namespace loader::native {
namespace jsi = facebook::jsi;

bool FabricAdapter::detach(const std::string &)
{
    return false;
}

bool FabricAdapter::attach(const std::string &, const FabricView &)
{
    return false;
}

bool FabricAdapter::detachesEverySurface() const
{
    return false;
}

bool FabricAdapter::postsVoidCalls() const
{
    return false;
}

bool FabricAdapter::measuresLastSetFrame() const
{
    return false;
}

static SurfacePointer surfaceOf(jsi::Runtime &runtime, const jsi::Value &value)
{
    if (!value.isObject() || !value.asObject(runtime).isHostObject<FabricSurface>(runtime))
    {
        throw std::invalid_argument("A Fabric surface handle is invalid");
    }
    return value.asObject(runtime).getHostObject<FabricSurface>(runtime);
}

static bool isSurface(jsi::Runtime &runtime, const jsi::Value &value)
{
    return value.isObject() && value.asObject(runtime).isHostObject<FabricSurface>(runtime);
}

static nlohmann::json propertiesOf(jsi::Runtime &runtime, const jsi::Value *value)
{
    if (!value || value->isNull() || value->isUndefined())
    {
        return nlohmann::json::object();
    }
    return nlohmann::json::parse(
        serializeBoundedObject(runtime, *value, kNativePropertiesConversion));
}

static void requireArguments(size_t count, size_t minimum, const char *message)
{
    if (count < minimum)
    {
        throw std::invalid_argument(message);
    }
}

struct MountRequest {
    SurfacePointer              surface;
    std::shared_ptr<FabricView> container;
    std::string                 moduleName;
    nlohmann::json              properties;
    uint64_t                    generation = 0;
    std::string                 reuseKey;
};

static std::string reuseKeyOf(jsi::Runtime &runtime, const jsi::Value *options,
                              const std::string &moduleName)
{
    if (!options || !options->isObject())
    {
        return "";
    }
    jsi::Value reuse = options->asObject(runtime).getProperty(runtime, "reuse");
    AddonSlot  addon = currentAddon();
    if (!reuse.isBool() || !reuse.getBool() || addon == kNoAddon)
    {
        return "";
    }
    return std::to_string(addon) + ":" + moduleName;
}

static MountRequest mountRequest(jsi::Runtime                         &runtime,
                                 const std::shared_ptr<FabricAdapter> &adapter,
                                 const jsi::Value *args, size_t count)
{
    requireArguments(count, 2, "Mounting a React surface requires a container and a module name");
    MountRequest request;
    request.container = adapter->view(runtime, args[0]);
    request.moduleName =
        parseName(runtime, args[1], kMaximumNativeNameBytes, "A Fabric module name");
    request.properties = propertiesOf(runtime, count > 2 ? &args[2] : nullptr);
    request.reuseKey   = reuseKeyOf(runtime, count > 3 ? &args[3] : nullptr, request.moduleName);
    request.surface    = std::make_shared<FabricSurface>(adapter);
    request.generation = runtimeGeneration();
    return request;
}

static bool reuseIdle(const MountRequest &request)
{
    if (request.reuseKey.empty())
    {
        return false;
    }
    SurfacePointer idle = takeIdle(request.reuseKey, request.generation);
    if (!idle)
    {
        return false;
    }
    try
    {
        if (idle->adapter().attach(idle->id(), *request.container) &&
            idle->adapter().update(idle->id(), request.properties) &&
            adoptReused(request.surface, idle, request.generation, request.reuseKey))
        {
            return true;
        }
    }
    catch (const std::exception &error)
    {
        log(LogLevel::Error, LOG_CATEGORY_PLUGINS,
            std::string("Failed to reuse an idle Fabric surface: ") + error.what());
    }
    destroyIdle({idle});
    return false;
}

static void mount(const MountRequest &request)
{
    if (request.generation != runtimeGeneration())
    {
        throw std::runtime_error("Fabric runtime was replaced before mounting");
    }
    if (reuseIdle(request))
    {
        return;
    }
    if (!request.reuseKey.empty())
    {
        countMissedSurface();
    }
    evictIdleUntilSurfaceFits();
    NativeResourceReservation reservation(nativeSurfaceBudget(),
                                          "Too many React surfaces are mounted");
    std::string id = request.surface->adapter().mount(*request.container, request.moduleName,
                                                      request.properties);
    if (!remember(request.surface, id, request.generation, request.reuseKey, reservation))
    {
        request.surface->adapter().unmount(id);
        throw std::runtime_error("Fabric runtime was replaced while mounting");
    }
    countCreatedSurface();
}

static void unmount(const SurfacePointer &surface)
{
    if (!surface->deactivate())
    {
        return;
    }
    if (park(surface))
    {
        return;
    }
    surface->adapter().unmount(surface->id());
    forget(surface.get());
}

struct FrameRequest {
    SurfacePointer              surface;
    std::shared_ptr<FabricView> view;
};

static FrameRequest measureRequest(jsi::Runtime                         &runtime,
                                   const std::shared_ptr<FabricAdapter> &adapter,
                                   const jsi::Value *args, size_t count)
{
    requireArguments(count, 1, "Measuring a view requires a handle");
    if (isSurface(runtime, args[0]))
    {
        return {surfaceOf(runtime, args[0]), nullptr};
    }
    return {nullptr, adapter->view(runtime, args[0])};
}

static NativeFrame measure(const std::shared_ptr<FabricAdapter> &adapter,
                           const FrameRequest                   &request)
{
    if (request.surface)
    {
        return request.surface->active() ? adapter->measureSurface(request.surface->id())
                                         : NativeFrame{};
    }
    return adapter->measure(*request.view);
}

using Operation = std::function<void()>;
using Result    = std::function<jsi::Value(jsi::Runtime &)>;
using Immediate = std::function<std::optional<jsi::Value>(jsi::Runtime &)>;

struct FabricCall {
    Operation operation;
    Result    result;
    Immediate immediate;
    bool      nextFrame = false;
};

struct FabricFrameMutation {
    SurfacePointer                surface;
    std::optional<nlohmann::json> properties;
    std::optional<NativeSize>     minimum;
    std::optional<NativeSize>     maximum;
    std::optional<NativeFrame>    frame;
};

static std::vector<FabricFrameMutation> frameMutations(jsi::Runtime     &runtime,
                                                       const jsi::Value &value)
{
    if (!value.isObject() || !value.asObject(runtime).isArray(runtime))
    {
        throw std::invalid_argument("A Fabric frame batch requires an array of mutations");
    }
    jsi::Array batch = value.asObject(runtime).asArray(runtime);
    if (batch.size(runtime) > kMaximumBatchSteps)
    {
        throw std::invalid_argument("A Fabric frame batch requires at most 64 mutations");
    }

    std::vector<FabricFrameMutation>            mutations;
    std::unordered_map<FabricSurface *, size_t> indexes;
    for (size_t index = 0; index < batch.size(runtime); index++)
    {
        jsi::Value entryValue = batch.getValueAtIndex(runtime, index);
        if (!entryValue.isObject() || entryValue.asObject(runtime).isArray(runtime))
        {
            throw std::invalid_argument("A Fabric frame mutation must be an object");
        }
        jsi::Object    entry   = entryValue.asObject(runtime);
        SurfacePointer surface = surfaceOf(runtime, entry.getProperty(runtime, "surface"));
        auto [found, inserted] = indexes.emplace(surface.get(), mutations.size());
        if (inserted)
        {
            mutations.push_back({surface});
        }
        FabricFrameMutation &mutation = mutations[found->second];
        bool                 changed  = false;

        jsi::Value properties = entry.getProperty(runtime, "properties");
        if (!properties.isUndefined())
        {
            mutation.properties = propertiesOf(runtime, &properties);
            changed             = true;
        }

        jsi::Value frame = entry.getProperty(runtime, "frame");
        if (!frame.isUndefined())
        {
            mutation.frame = parseFrame(runtime, frame);
            changed        = true;
        }

        jsi::Value size = entry.getProperty(runtime, "size");
        if (!size.isUndefined())
        {
            if (!size.isObject() || size.asObject(runtime).isArray(runtime))
            {
                throw std::invalid_argument("A Fabric frame size mutation must be an object");
            }
            jsi::Object sizeObject = size.asObject(runtime);
            jsi::Value  minimum    = sizeObject.getProperty(runtime, "minimum");
            jsi::Value  maximum    = sizeObject.getProperty(runtime, "maximum");
            if (minimum.isUndefined() || maximum.isUndefined())
            {
                throw std::invalid_argument(
                    "A Fabric frame size mutation requires minimum and maximum sizes");
            }
            mutation.minimum = parseSize(runtime, minimum);
            mutation.maximum = parseSize(runtime, maximum);
            changed          = true;
        }

        if (!changed)
        {
            throw std::invalid_argument("A Fabric frame mutation has no update");
        }
    }

    for (const FabricFrameMutation &mutation : mutations)
    {
        if (mutation.frame && mutation.surface->adapter().measuresLastSetFrame())
        {
            mutation.surface->rememberSetFrame(*mutation.frame);
        }
    }
    return mutations;
}

static jsi::Value undefinedResult(jsi::Runtime &)
{
    return jsi::Value::undefined();
}

class FabricNamespace
{
public:
    FabricNamespace(jsi::Runtime &runtime, std::shared_ptr<FabricAdapter> adapter,
                    FabricCalls calls)
        : runtime_(runtime), adapter_(std::move(adapter)), calls_(calls), object_(runtime)
    {
    }

    template <typename Prepare>
    void define(const char *name, unsigned int argumentCount, Prepare prepare)
    {
        auto run = [prepare, adapter = adapter_, label = std::string("fabric.") + name](
                       jsi::Runtime &rt, const jsi::Value *args, size_t count,
                       bool synchronous) -> jsi::Value {
            FabricCall call = prepare(rt, args, count);
            if (!synchronous)
            {
                return executeMainAsynchronously(
                    rt, call.operation, call.result ? call.result : Result(undefinedResult),
                    call.nextFrame);
            }
            return runSynchronously(rt, call, *adapter, label);
        };
        if (calls_ == FabricCalls::SyncAndAsync)
        {
            add(name, argumentCount, [run](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
                return run(rt, args, count, true);
            });
        }
        add((std::string(name) + "Async").c_str(), argumentCount,
            [run](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
                return run(rt, args, count, false);
            });
    }

    template <typename Prepare>
    void defineAsync(const char *name, unsigned int argumentCount, Prepare prepare)
    {
        add(name, argumentCount,
            [prepare](jsi::Runtime &rt, const jsi::Value *args, size_t count) -> jsi::Value {
                FabricCall call = prepare(rt, args, count);
                return executeMainAsynchronously(
                    rt, call.operation, call.result ? call.result : Result(undefinedResult),
                    call.nextFrame);
            });
    }

    std::shared_ptr<FabricAdapter> adapter() const
    {
        return adapter_;
    }

    jsi::Object take()
    {
        return std::move(object_);
    }

private:
    using Handler = std::function<jsi::Value(jsi::Runtime &, const jsi::Value *, size_t)>;

    static jsi::Value runSynchronously(jsi::Runtime &rt, const FabricCall &call,
                                       const FabricAdapter &adapter, const std::string &label)
    {
        if (call.immediate)
        {
            if (std::optional<jsi::Value> known = call.immediate(rt))
            {
                return std::move(*known);
            }
        }
        if (!call.result && adapter.postsVoidCalls())
        {
            postMainOperation(call.operation, label);
            return jsi::Value::undefined();
        }
        executeMainSynchronouslyUnlessMainWaits(call.operation);
        return call.result ? call.result(rt) : jsi::Value::undefined();
    }

    void add(const char *name, unsigned int argumentCount, Handler handler)
    {
        object_.setProperty(runtime_, name,
                            makeFunction(runtime_, name, argumentCount,
                                         [handler](jsi::Runtime     &rt, const jsi::Value &,
                                                   const jsi::Value *args, size_t count) {
                                             return handler(rt, args, count);
                                         }));
    }

    jsi::Runtime                  &runtime_;
    std::shared_ptr<FabricAdapter> adapter_;
    FabricCalls                    calls_;
    jsi::Object                    object_;
};

jsi::Object makeFabricNamespace(jsi::Runtime &runtime, std::shared_ptr<FabricAdapter> adapter,
                                FabricCalls calls)
{
    watchRuntimeGenerations();
    FabricNamespace fabric(runtime, std::move(adapter), calls);
    auto            shared = fabric.adapter();

    fabric.define("mount", 4, [shared](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
        auto request = std::make_shared<MountRequest>(mountRequest(rt, shared, args, count));
        return FabricCall{[request]() {
                              mount(*request);
                          },
                          [request](jsi::Runtime &completion) {
                              return jsi::Value(
                                  jsi::Object::createFromHostObject(completion, request->surface));
                          },
                          nullptr};
    });
    fabric.define("update", 2, [](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
        requireArguments(count, 2, "Updating a React surface requires a handle and properties");
        SurfacePointer surface    = surfaceOf(rt, args[0]);
        nlohmann::json properties = propertiesOf(rt, &args[1]);
        return FabricCall{[surface, properties]() {
                              if (surface->active())
                              {
                                  surface->adapter().update(surface->id(), properties);
                              }
                          },
                          nullptr, nullptr};
    });
    fabric.define("setSize", 3, [](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
        requireArguments(
            count, 3,
            "Sizing a React surface requires a handle, a minimum size and a maximum size");
        SurfacePointer surface = surfaceOf(rt, args[0]);
        NativeSize     minimum = parseSize(rt, args[1]);
        NativeSize     maximum = parseSize(rt, args[2]);
        return FabricCall{[surface, minimum, maximum]() {
                              if (surface->active())
                              {
                                  surface->adapter().setSize(surface->id(), minimum, maximum);
                              }
                          },
                          nullptr, nullptr};
    });
    fabric.define("setFrame", 2, [](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
        requireArguments(count, 2, "Framing a React surface requires a handle and a frame");
        SurfacePointer surface = surfaceOf(rt, args[0]);
        NativeFrame    frame   = parseFrame(rt, args[1]);
        if (surface->adapter().measuresLastSetFrame())
        {
            surface->rememberSetFrame(frame);
        }
        return FabricCall{[surface, frame]() {
                              if (!surface->active())
                              {
                                  return;
                              }
                              try
                              {
                                  surface->adapter().setFrame(surface->id(), frame);
                              }
                              catch (...)
                              {
                                  surface->forgetSetFrame();
                                  throw;
                              }
                          },
                          nullptr, nullptr};
    });
    fabric.define("measure", 1, [shared](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
        FrameRequest request = measureRequest(rt, shared, args, count);
        auto         frame   = std::make_shared<NativeFrame>();
        return FabricCall{[shared, request, frame]() {
                              *frame = measure(shared, request);
                          },
                          [frame](jsi::Runtime &completion) {
                              return toJSIValue(completion, toJSON(*frame));
                          },
                          [request](jsi::Runtime &completion) -> std::optional<jsi::Value> {
                              std::optional<NativeFrame> known =
                                  request.surface ? request.surface->knownFrame() : std::nullopt;
                              if (!known)
                              {
                                  return std::nullopt;
                              }
                              return toJSIValue(completion, toJSON(*known));
                          }};
    });
    fabric.define("releaseIdle", 0, [](jsi::Runtime &, const jsi::Value *, size_t) {
        AddonSlot   addon  = currentAddon();
        std::string prefix = std::to_string(addon) + ":";
        return FabricCall{[addon, prefix]() {
                              if (addon != kNoAddon)
                              {
                                  evictIdleFabricSurfaces(prefix);
                              }
                          },
                          nullptr, nullptr};
    });
    fabric.define("unmount", 1, [](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
        requireArguments(count, 1, "Unmounting a React surface requires a handle");
        SurfacePointer surface = surfaceOf(rt, args[0]);
        surface->forgetSetFrame();
        if (std::optional<uint64_t> ticket = parkBeforeDetaching(surface))
        {
            return FabricCall{[surface, parked = *ticket]() {
                                  finishParking(surface, parked);
                              },
                              nullptr, nullptr};
        }
        return FabricCall{[surface]() {
                              unmount(surface);
                          },
                          nullptr, nullptr};
    });
    fabric.defineAsync("batchAsync", 1, [](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
        requireArguments(count, 1, "Batching Fabric updates requires a mutation array");
        auto mutations =
            std::make_shared<std::vector<FabricFrameMutation>>(frameMutations(rt, args[0]));
        return FabricCall{[mutations]() {
                              for (const FabricFrameMutation &mutation : *mutations)
                              {
                                  if (!mutation.surface->active())
                                  {
                                      continue;
                                  }
                                  if (mutation.properties)
                                  {
                                      mutation.surface->adapter().update(mutation.surface->id(),
                                                                         *mutation.properties);
                                  }
                                  if (mutation.minimum && mutation.maximum)
                                  {
                                      mutation.surface->adapter().setSize(mutation.surface->id(),
                                                                          *mutation.minimum,
                                                                          *mutation.maximum);
                                  }
                                  if (mutation.frame)
                                  {
                                      mutation.surface->adapter().setFrame(mutation.surface->id(),
                                                                           *mutation.frame);
                                  }
                              }
                          },
                          nullptr, nullptr, true};
    });
    return fabric.take();
}

}
