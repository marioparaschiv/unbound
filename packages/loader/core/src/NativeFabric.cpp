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
#include "LoaderLog.h"
#include "NativeBoundedValue.h"
#include "NativeConversionBudget.h"
#include "NativeLimits.h"
#include "NativePlatformBridge.h"
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

class FabricSurface final : public jsi::HostObject
{
public:
    explicit FabricSurface(std::shared_ptr<FabricAdapter> adapter) : adapter_(std::move(adapter)) {}

    void activate(std::string id, uint64_t generation, std::string reuseKey)
    {
        std::lock_guard<std::mutex> lock(mutex_);
        id_         = std::move(id);
        generation_ = generation;
        reuseKey_   = std::move(reuseKey);
        active_     = true;
    }

    std::string reuseKey() const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return reuseKey_;
    }

    bool deactivate()
    {
        std::lock_guard<std::mutex> lock(mutex_);
        bool                        wasActive = active_;
        active_                               = false;
        lastSetFrame_.reset();
        return wasActive;
    }

    void rememberSetFrame(const NativeFrame &frame)
    {
        std::lock_guard<std::mutex> lock(mutex_);
        lastSetFrame_ = frame;
    }

    void forgetSetFrame()
    {
        std::lock_guard<std::mutex> lock(mutex_);
        lastSetFrame_.reset();
    }

    std::optional<NativeFrame> knownFrame() const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return active_ ? lastSetFrame_ : std::nullopt;
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
    std::string                    reuseKey_;
    uint64_t                       generation_ = 0;
    bool                           active_     = false;
    std::optional<NativeFrame>     lastSetFrame_;
};

using SurfacePointer = std::shared_ptr<FabricSurface>;

struct IdleSurface {
    std::string    key;
    SurfacePointer surface;
    uint64_t       parking = 0;
};

static std::atomic<size_t> gCreatedSurfaces{0};
static std::atomic<size_t> gReusedSurfaces{0};
static std::atomic<size_t> gMissedSurfaces{0};

struct SurfaceRegistry {
    std::mutex                                          mutex;
    std::unordered_map<FabricSurface *, SurfacePointer> surfaces;
    std::deque<IdleSurface>                             idle;
    uint64_t                                            parkings = 0;
};

static SurfaceRegistry &registry()
{
    static SurfaceRegistry instance;
    return instance;
}

static bool remember(const SurfacePointer &surface, const std::string &id, uint64_t generation,
                     const std::string &reuseKey, NativeResourceReservation &reservation)
{
    std::lock_guard<std::mutex> lock(registry().mutex);
    if (generation != runtimeGeneration())
    {
        return false;
    }
    surface->activate(id, generation, reuseKey);
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

static size_t countIdle(const std::string &key)
{
    size_t count = 0;
    for (const IdleSurface &idle : registry().idle)
    {
        count += idle.key == key ? 1 : 0;
    }
    return count;
}

static std::vector<SurfacePointer> overflowingIdleLocked()
{
    std::vector<SurfacePointer> evicted;
    auto                       &idle = registry().idle;
    while (idle.size() > kIdleFabricSurfaces)
    {
        evicted.push_back(idle.front().surface);
        idle.pop_front();
    }
    for (auto iterator = idle.begin(); iterator != idle.end();)
    {
        if (countIdle(iterator->key) > kIdleFabricSurfacesPerModule)
        {
            evicted.push_back(iterator->surface);
            iterator = idle.erase(iterator);
            continue;
        }
        ++iterator;
    }
    return evicted;
}

static void destroyIdle(const std::vector<SurfacePointer> &evicted)
{
    for (const SurfacePointer &surface : evicted)
    {
        unmountQuietly(surface);
        nativeSurfaceBudget().release();
    }
}

static bool park(const SurfacePointer &surface)
{
    std::string key = surface->reuseKey();
    if (key.empty() || surface->generation() != runtimeGeneration() ||
        !surface->adapter().detach(surface->id()))
    {
        return false;
    }
    std::vector<SurfacePointer> evicted;
    {
        std::lock_guard<std::mutex> lock(registry().mutex);
        if (registry().surfaces.erase(surface.get()) == 0)
        {
            return false;
        }
        registry().idle.push_back({key, surface});
        evicted = overflowingIdleLocked();
    }
    destroyIdle(evicted);
    return true;
}

static std::optional<uint64_t> parkBeforeDetaching(const SurfacePointer &surface)
{
    std::string key = surface->reuseKey();
    if (key.empty() || !surface->adapter().detachesEverySurface() ||
        surface->generation() != runtimeGeneration())
    {
        return std::nullopt;
    }
    std::lock_guard<std::mutex> lock(registry().mutex);
    if (!surface->active() || registry().surfaces.erase(surface.get()) == 0)
    {
        return std::nullopt;
    }
    surface->deactivate();
    uint64_t ticket = ++registry().parkings;
    registry().idle.push_back({key, surface, ticket});
    return ticket;
}

static std::vector<SurfacePointer> overflowingIdle()
{
    std::lock_guard<std::mutex> lock(registry().mutex);
    return overflowingIdleLocked();
}

static std::deque<IdleSurface>::iterator findParking(const SurfacePointer &surface, uint64_t ticket)
{
    auto &idle = registry().idle;
    return std::find_if(idle.begin(), idle.end(), [&](const IdleSurface &entry) {
        return entry.surface == surface && entry.parking == ticket;
    });
}

static bool stillParked(const SurfacePointer &surface, uint64_t ticket)
{
    std::lock_guard<std::mutex> lock(registry().mutex);
    return findParking(surface, ticket) != registry().idle.end();
}

static bool unpark(const SurfacePointer &surface, uint64_t ticket)
{
    std::lock_guard<std::mutex> lock(registry().mutex);
    auto                        found = findParking(surface, ticket);
    if (found == registry().idle.end())
    {
        return false;
    }
    registry().idle.erase(found);
    return true;
}

static bool detachQuietly(const SurfacePointer &surface)
{
    try
    {
        return surface->adapter().detach(surface->id());
    }
    catch (const std::exception &error)
    {
        log(LogLevel::Error, LOG_CATEGORY_PLUGINS,
            std::string("Failed to detach an idle Fabric surface: ") + error.what());
    }
    return false;
}

static void finishParking(const SurfacePointer &surface, uint64_t ticket)
{
    destroyIdle(overflowingIdle());
    if (!stillParked(surface, ticket) || detachQuietly(surface))
    {
        return;
    }
    if (unpark(surface, ticket))
    {
        destroyIdle({surface});
    }
}

static SurfacePointer takeIdle(const std::string &key, uint64_t generation)
{
    std::lock_guard<std::mutex> lock(registry().mutex);
    auto                       &idle = registry().idle;
    for (auto iterator = idle.rbegin(); iterator != idle.rend(); ++iterator)
    {
        if (iterator->key == key && iterator->surface->generation() == generation)
        {
            SurfacePointer surface = iterator->surface;
            idle.erase(std::next(iterator).base());
            return surface;
        }
    }
    return nullptr;
}

static void releaseStaleSurfaces(uint64_t generation)
{
    std::vector<SurfacePointer> stale;
    std::vector<SurfacePointer> staleIdle;
    {
        std::lock_guard<std::mutex> lock(registry().mutex);
        auto                       &idle = registry().idle;
        for (auto iterator = idle.begin(); iterator != idle.end();)
        {
            if (iterator->surface->generation() >= generation)
            {
                ++iterator;
                continue;
            }
            staleIdle.push_back(iterator->surface);
            iterator = idle.erase(iterator);
            nativeSurfaceBudget().release();
        }
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
    if ((stale.empty() && staleIdle.empty()) || !target)
    {
        return;
    }
    target->runOnMain([stale = std::move(stale), staleIdle = std::move(staleIdle)]() {
        for (const SurfacePointer &surface : stale)
        {
            if (surface->deactivate())
            {
                unmountQuietly(surface);
            }
        }
        for (const SurfacePointer &surface : staleIdle)
        {
            unmountQuietly(surface);
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
            idle->adapter().update(idle->id(), request.properties))
        {
            std::lock_guard<std::mutex> lock(registry().mutex);
            if (request.generation == runtimeGeneration())
            {
                request.surface->activate(idle->id(), request.generation, request.reuseKey);
                registry().surfaces[request.surface.get()] = request.surface;
                gReusedSurfaces++;
                return true;
            }
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

static SurfacePointer takeOldestIdle()
{
    std::lock_guard<std::mutex> lock(registry().mutex);
    auto                       &idle = registry().idle;
    if (idle.empty())
    {
        return nullptr;
    }
    SurfacePointer oldest = idle.front().surface;
    idle.pop_front();
    return oldest;
}

static void evictIdleUntilSurfaceFits()
{
    while (nativeSurfaceBudget().used() >= nativeSurfaceBudget().limit())
    {
        SurfacePointer oldest = takeOldestIdle();
        if (!oldest)
        {
            return;
        }
        destroyIdle({oldest});
    }
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
        gMissedSurfaces++;
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
    gCreatedSurfaces++;
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

size_t mountedFabricSurfaces()
{
    std::lock_guard<std::mutex> lock(registry().mutex);
    return registry().surfaces.size();
}

size_t createdFabricSurfaces()
{
    return gCreatedSurfaces.load();
}

size_t reusedFabricSurfaces()
{
    return gReusedSurfaces.load();
}

size_t missedFabricSurfaces()
{
    return gMissedSurfaces.load();
}

size_t idleFabricSurfaces()
{
    std::lock_guard<std::mutex> lock(registry().mutex);
    return registry().idle.size();
}

void evictIdleFabricSurfaces(const std::string &keyPrefix)
{
    std::vector<SurfacePointer> evicted;
    {
        std::lock_guard<std::mutex> lock(registry().mutex);
        auto                       &idle = registry().idle;
        for (auto iterator = idle.begin(); iterator != idle.end();)
        {
            if (iterator->key.rfind(keyPrefix, 0) != 0)
            {
                ++iterator;
                continue;
            }
            evicted.push_back(iterator->surface);
            iterator = idle.erase(iterator);
        }
    }
    destroyIdle(evicted);
}
}
