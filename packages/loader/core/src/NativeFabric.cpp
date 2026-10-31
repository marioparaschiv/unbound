#include "NativeFabric.h"

#include <functional>
#include <mutex>
#include <stdexcept>
#include <unordered_map>
#include <vector>

#include "LoaderLog.h"
#include "NativeBoundedValue.h"
#include "NativeConversionBudget.h"
#include "NativeLimits.h"
#include "NativePlatformBridge.h"
#include "NativePluginRuntime.h"
#include "NativeResourceBudget.h"

namespace loader::native {
namespace jsi = facebook::jsi;

class FabricSurface final : public jsi::HostObject
{
public:
    explicit FabricSurface(std::shared_ptr<FabricAdapter> adapter) : adapter_(std::move(adapter)) {}

    void activate(std::string id, uint64_t generation)
    {
        std::lock_guard<std::mutex> lock(mutex_);
        id_         = std::move(id);
        generation_ = generation;
        active_     = true;
    }

    bool deactivate()
    {
        std::lock_guard<std::mutex> lock(mutex_);
        bool                        wasActive = active_;
        active_                               = false;
        return wasActive;
    }

    bool active() const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return active_;
    }

    std::string id() const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return id_;
    }

    uint64_t generation() const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return generation_;
    }

    FabricAdapter &adapter() const
    {
        return *adapter_;
    }

private:
    std::shared_ptr<FabricAdapter> adapter_;
    mutable std::mutex             mutex_;
    std::string                    id_;
    uint64_t                       generation_ = 0;
    bool                           active_     = false;
};

using SurfacePointer = std::shared_ptr<FabricSurface>;

struct SurfaceRegistry {
    std::mutex                                          mutex;
    std::unordered_map<FabricSurface *, SurfacePointer> surfaces;
};

static SurfaceRegistry &registry()
{
    static SurfaceRegistry instance;
    return instance;
}

static bool remember(const SurfacePointer &surface, const std::string &id, uint64_t generation,
                     NativeResourceReservation &reservation)
{
    std::lock_guard<std::mutex> lock(registry().mutex);
    if (generation != runtimeGeneration())
    {
        return false;
    }
    surface->activate(id, generation);
    registry().surfaces[surface.get()] = surface;
    reservation.commit();
    return true;
}

static void forget(FabricSurface *surface)
{
    std::lock_guard<std::mutex> lock(registry().mutex);
    if (registry().surfaces.erase(surface) > 0)
    {
        nativeSurfaceBudget().release();
    }
}

static void unmountQuietly(const SurfacePointer &surface)
{
    try
    {
        surface->adapter().unmount(surface->id());
    }
    catch (const std::exception &error)
    {
        log(LogLevel::Error, LOG_CATEGORY_PLUGINS,
            std::string("Failed to release a stale Fabric surface: ") + error.what());
    }
}

static void releaseStaleSurfaces(uint64_t generation)
{
    std::vector<SurfacePointer> stale;
    {
        std::lock_guard<std::mutex> lock(registry().mutex);
        for (auto iterator = registry().surfaces.begin(); iterator != registry().surfaces.end();)
        {
            if (iterator->second->generation() >= generation)
            {
                ++iterator;
                continue;
            }
            stale.push_back(iterator->second);
            iterator = registry().surfaces.erase(iterator);
            nativeSurfaceBudget().release();
        }
    }
    auto target = executor();
    if (stale.empty() || !target)
    {
        return;
    }
    target->runOnMain([stale = std::move(stale)]() {
        for (const SurfacePointer &surface : stale)
        {
            if (surface->deactivate())
            {
                unmountQuietly(surface);
            }
        }
    });
}

static void watchRuntimeGenerations()
{
    static std::once_flag watching;
    std::call_once(watching, [] {
        onRuntimeGenerationChanged(releaseStaleSurfaces);
    });
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
};

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
    request.surface    = std::make_shared<FabricSurface>(adapter);
    request.generation = runtimeGeneration();
    return request;
}

static void mount(const MountRequest &request)
{
    if (request.generation != runtimeGeneration())
    {
        throw std::runtime_error("Fabric runtime was replaced before mounting");
    }
    NativeResourceReservation reservation(nativeSurfaceBudget(),
                                          "Too many React surfaces are mounted");
    std::string id = request.surface->adapter().mount(*request.container, request.moduleName,
                                                      request.properties);
    if (!remember(request.surface, id, request.generation, reservation))
    {
        request.surface->adapter().unmount(id);
        throw std::runtime_error("Fabric runtime was replaced while mounting");
    }
}

static void unmount(const SurfacePointer &surface)
{
    if (!surface->deactivate())
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
        auto run = [prepare](jsi::Runtime &rt, const jsi::Value *args, size_t count,
                             bool synchronous) -> jsi::Value {
            auto [operation, result] = prepare(rt, args, count);
            if (synchronous)
            {
                executeMainSynchronously(operation);
                return result(rt);
            }
            return executeMainAsynchronously(rt, operation, result);
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

    fabric.define("mount", 3, [shared](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
        auto request = std::make_shared<MountRequest>(mountRequest(rt, shared, args, count));
        return std::pair<Operation, Result>(
            [request]() {
                mount(*request);
            },
            [request](jsi::Runtime &completion) {
                return jsi::Value(jsi::Object::createFromHostObject(completion, request->surface));
            });
    });
    fabric.define("update", 2, [](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
        requireArguments(count, 2, "Updating a React surface requires a handle and properties");
        SurfacePointer surface    = surfaceOf(rt, args[0]);
        nlohmann::json properties = propertiesOf(rt, &args[1]);
        return std::pair<Operation, Result>(
            [surface, properties]() {
                if (surface->active())
                {
                    surface->adapter().update(surface->id(), properties);
                }
            },
            undefinedResult);
    });
    fabric.define("setSize", 3, [](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
        requireArguments(
            count, 3,
            "Sizing a React surface requires a handle, a minimum size and a maximum size");
        SurfacePointer surface = surfaceOf(rt, args[0]);
        NativeSize     minimum = parseSize(rt, args[1]);
        NativeSize     maximum = parseSize(rt, args[2]);
        return std::pair<Operation, Result>(
            [surface, minimum, maximum]() {
                if (surface->active())
                {
                    surface->adapter().setSize(surface->id(), minimum, maximum);
                }
            },
            undefinedResult);
    });
    fabric.define("setFrame", 2, [](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
        requireArguments(count, 2, "Framing a React surface requires a handle and a frame");
        SurfacePointer surface = surfaceOf(rt, args[0]);
        NativeFrame    frame   = parseFrame(rt, args[1]);
        return std::pair<Operation, Result>(
            [surface, frame]() {
                if (surface->active())
                {
                    surface->adapter().setFrame(surface->id(), frame);
                }
            },
            undefinedResult);
    });
    fabric.define("measure", 1, [shared](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
        FrameRequest request = measureRequest(rt, shared, args, count);
        auto         frame   = std::make_shared<NativeFrame>();
        return std::pair<Operation, Result>(
            [shared, request, frame]() {
                *frame = measure(shared, request);
            },
            [frame](jsi::Runtime &completion) {
                return toJSIValue(completion, toJSON(*frame));
            });
    });
    fabric.define("unmount", 1, [](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
        requireArguments(count, 1, "Unmounting a React surface requires a handle");
        SurfacePointer surface = surfaceOf(rt, args[0]);
        return std::pair<Operation, Result>(
            [surface]() {
                unmount(surface);
            },
            undefinedResult);
    });
    return fabric.take();
}

size_t mountedFabricSurfaces()
{
    std::lock_guard<std::mutex> lock(registry().mutex);
    return registry().surfaces.size();
}
}
