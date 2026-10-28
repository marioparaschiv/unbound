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
    virtual void        update(const std::string &surface, const nlohmann::json &properties) = 0;
    virtual void        setSize(const std::string &surface, const NativeSize &minimum,
                                const NativeSize &maximum)                                   = 0;
    virtual void        setFrame(const std::string &surface, const NativeFrame &frame)       = 0;
    virtual NativeFrame measure(const FabricView &view)                                      = 0;
    virtual NativeFrame measureSurface(const std::string &surface)                           = 0;
    virtual void        unmount(const std::string &surface)                                  = 0;
};

enum class FabricCalls
{
    AsyncOnly,
    SyncAndAsync,
};

facebook::jsi::Object makeFabricNamespace(facebook::jsi::Runtime        &runtime,
                                          std::shared_ptr<FabricAdapter> adapter,
                                          FabricCalls                    calls);

size_t mountedFabricSurfaces();
}
