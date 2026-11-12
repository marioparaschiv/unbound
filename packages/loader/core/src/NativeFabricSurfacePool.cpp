#include "NativeFabricSurfacePool.h"

#include <atomic>
#include <deque>
#include <mutex>
#include <unordered_map>
#include <vector>

#include "LoaderLog.h"
#include "NativePluginRuntime.h"

namespace loader::native {
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

bool remember(const SurfacePointer &surface, const std::string &id, uint64_t generation,
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

void forget(FabricSurface *surface)
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

void destroyIdle(const std::vector<SurfacePointer> &evicted)
{
    for (const SurfacePointer &surface : evicted)
    {
        unmountQuietly(surface);
        nativeSurfaceBudget().release();
    }
}

bool park(const SurfacePointer &surface)
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

std::optional<uint64_t> parkBeforeDetaching(const SurfacePointer &surface)
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

void finishParking(const SurfacePointer &surface, uint64_t ticket)
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

SurfacePointer takeIdle(const std::string &key, uint64_t generation)
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

void watchRuntimeGenerations()
{
    static std::once_flag watching;
    std::call_once(watching, [] {
        onRuntimeGenerationChanged(releaseStaleSurfaces);
    });
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

void evictIdleUntilSurfaceFits()
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

bool adoptReused(const SurfacePointer &surface, const SurfacePointer &idle, uint64_t generation,
                 const std::string &reuseKey)
{
    std::lock_guard<std::mutex> lock(registry().mutex);
    if (generation != runtimeGeneration())
    {
        return false;
    }
    surface->activate(idle->id(), generation, reuseKey);
    registry().surfaces[surface.get()] = surface;
    gReusedSurfaces++;
    return true;
}

void countMissedSurface()
{
    gMissedSurfaces++;
}

void countCreatedSurface()
{
    gCreatedSurfaces++;
}
}
