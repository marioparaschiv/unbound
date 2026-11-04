#pragma once

#include <jsi/jsi.h>
#include <memory>
#include <nlohmann/json.hpp>
#include <string>

#include "NativeGeometry.h"

namespace loader::native {
class FabricView
{
public:
    virtual ~FabricView() = default;
};

class FabricAdapter
{
public:
    virtual ~FabricAdapter() = default;

    virtual std::shared_ptr<FabricView> view(facebook::jsi::Runtime     &runtime,
                                             const facebook::jsi::Value &handle) = 0;

    virtual std::string mount(const FabricView &container, const std::string &moduleName,
                              const nlohmann::json &properties)                              = 0;
    virtual bool        update(const std::string &surface, const nlohmann::json &properties) = 0;
    virtual void        setSize(const std::string &surface, const NativeSize &minimum,
                                const NativeSize &maximum)                                   = 0;
    virtual void        setFrame(const std::string &surface, const NativeFrame &frame)       = 0;
    virtual NativeFrame measure(const FabricView &view)                                      = 0;
    virtual NativeFrame measureSurface(const std::string &surface)                           = 0;
    virtual void        unmount(const std::string &surface)                                  = 0;
    virtual bool        detach(const std::string &surface);
    virtual bool        attach(const std::string &surface, const FabricView &container);
    virtual bool        detachesEverySurface() const;
    virtual bool        postsVoidCalls() const;
    virtual bool        measuresLastSetFrame() const;
};

enum class FabricCalls
{
    AsyncOnly,
    SyncAndAsync,
};

facebook::jsi::Object makeFabricNamespace(facebook::jsi::Runtime        &runtime,
                                          std::shared_ptr<FabricAdapter> adapter,
                                          FabricCalls                    calls);

inline constexpr size_t kIdleFabricSurfacesPerModule = 12;
inline constexpr size_t kIdleFabricSurfaces          = 24;

size_t mountedFabricSurfaces();
size_t idleFabricSurfaces();
size_t createdFabricSurfaces();
size_t reusedFabricSurfaces();
size_t missedFabricSurfaces();
void   evictIdleFabricSurfaces(const std::string &keyPrefix = "");
}
