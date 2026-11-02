#include "NativeUIScopeCache.h"

#include <atomic>

#include "LoaderBootstrap.h"
#include "NativeLimits.h"
#include "NativePluginRuntime.h"

namespace loader::native {
namespace jsi = facebook::jsi;

static constexpr const char *kScopeCacheGlobal = "__nativeUIScopeCache";
static std::atomic_uint64_t  gNextScopeCacheId{1};

uint64_t nextUIScopeCacheId()
{
    return gNextScopeCacheId.fetch_add(1);
}

static jsi::Object scopeCache(jsi::Runtime &runtime)
{
    jsi::Value existing = runtime.global().getProperty(runtime, kScopeCacheGlobal);
    if (existing.isObject())
    {
        return existing.asObject(runtime);
    }
    jsi::Value created = bootstrap::evaluate(runtime, bootstrap::kNativeUIScopeCache);
    if (!created.isObject())
    {
        throwCoded(runtime, "NATIVE_PLUGIN_UNAVAILABLE", "The UI scope cache is unavailable");
    }
    runtime.global().setProperty(runtime, kScopeCacheGlobal, created);
    return created.asObject(runtime);
}

jsi::Value cachedUIScopeNamespace(jsi::Runtime &runtime, const std::string &key,
                                  const std::function<jsi::Object()> &create,
                                  std::function<bool()>               active)
{
    jsi::Object cache      = scopeCache(runtime);
    jsi::String identifier = jsi::String::createFromUtf8(runtime, key);
    if (!active())
    {
        cache.getPropertyAsFunction(runtime, "erase").call(runtime, identifier);
        throwCoded(runtime, "NATIVE_PLUGIN_SCOPE_DISPOSED", "The UI scope has been disposed");
    }
    jsi::Value existing = cache.getPropertyAsFunction(runtime, "read").call(runtime, identifier);
    if (!existing.isUndefined())
    {
        return existing;
    }
    jsi::Object source = create();
    auto isActive = makeFunction(runtime, "isActive", 0,
                                 [active = std::move(active)](jsi::Runtime &, const jsi::Value &,
                                                              const jsi::Value *, size_t) {
                                     return jsi::Value(active());
                                 });
    return cache.getPropertyAsFunction(runtime, "create")
        .call(runtime, identifier, source, isActive,
              static_cast<double>(kMaximumUIScopeNamespaces));
}
}
