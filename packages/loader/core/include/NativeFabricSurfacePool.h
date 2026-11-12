#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

#include "NativeFabricSurface.h"
#include "NativeResourceBudget.h"

namespace loader::native {
bool remember(const SurfacePointer &surface, const std::string &id, uint64_t generation,
              const std::string &reuseKey, NativeResourceReservation &reservation);
void forget(FabricSurface *surface);
void destroyIdle(const std::vector<SurfacePointer> &evicted);
bool park(const SurfacePointer &surface);
std::optional<uint64_t> parkBeforeDetaching(const SurfacePointer &surface);
void                    finishParking(const SurfacePointer &surface, uint64_t ticket);
SurfacePointer          takeIdle(const std::string &key, uint64_t generation);
void                    watchRuntimeGenerations();
void                    evictIdleUntilSurfaceFits();
bool adoptReused(const SurfacePointer &surface, const SurfacePointer &idle, uint64_t generation,
                 const std::string &reuseKey);
void countMissedSurface();
void countCreatedSurface();
}
