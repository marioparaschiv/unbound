#include "NativeUIScope.h"

#include <algorithm>

#include "NativePluginRuntime.h"
#include "NativeUIScopeCache.h"

namespace jsi = facebook::jsi;

namespace loader::native {
static thread_local jsi::Runtime *gUIScopeRuntime = nullptr;

jsi::Runtime *currentUIScopeRuntime()
{
    return gUIScopeRuntime;
}

UIScope::UIScope(AddonSlot addon, std::vector<std::string> allowed)
    : addon_(addon), allowed_(std::move(allowed))
{
}

AddonSlot UIScope::addon() const
{
    return addon_;
}

const std::vector<std::string> &UIScope::allowed() const
{
    return allowed_;
}

bool UIScope::allows(const std::string &path) const
{
    return std::find(allowed_.begin(), allowed_.end(), path) != allowed_.end();
}

bool UIScope::active() const
{
    std::lock_guard<std::mutex> lock(mutex_);
    return !disposed_;
}

jsi::Value UIScope::hook(jsi::Runtime &runtime, const Install &install)
{
    if (!active())
    {
        throw jsi::JSError(runtime, "The UI scope has been disposed");
    }
    AddonScope    addonScope(addon_);
    jsi::Runtime *previous = gUIScopeRuntime;
    gUIScopeRuntime        = &runtime;
    std::pair<jsi::Value, Release> installed;
    try
    {
        installed = install();
    }
    catch (...)
    {
        gUIScopeRuntime = previous;
        throw;
    }
    gUIScopeRuntime = previous;
    if (installed.second)
    {
        std::lock_guard<std::mutex> lock(mutex_);
        releases_.push_back(std::move(installed.second));
    }
    return std::move(installed.first);
}

void UIScope::dispose()
{
    std::vector<Release> releases;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        if (disposed_)
        {
            return;
        }
        disposed_ = true;
        releases.swap(releases_);
    }
    for (const Release &release : releases)
    {
        release();
    }
}

namespace {
    class UIScopeHost final : public jsi::HostObject
    {
    public:
        UIScopeHost(std::shared_ptr<UIScope> scope, std::vector<std::string> namespaces,
                    UIScopeNamespaceFactory create, std::function<void(jsi::Runtime &)> onRead)
            : scope_(std::move(scope)), namespaces_(std::move(namespaces)),
              create_(std::move(create)), onRead_(std::move(onRead)), cacheId_(nextUIScopeCacheId())
        {
        }

        ~UIScopeHost() override
        {
            scope_->dispose();
        }

        // Hermes on Android cannot take a C++ exception, so a failed read returns a failure
        // envelope.
        jsi::Value get(jsi::Runtime &runtime, const jsi::PropNameID &property) override
        {
            return loader::native::guard(runtime, [&]() -> jsi::Value {
                if (onRead_)
                {
                    onRead_(runtime);
                }
                return read(runtime, property.utf8(runtime));
            });
        }

    private:
        jsi::Value read(jsi::Runtime &runtime, const std::string &name)
        {
            auto scope = scope_;
            if (name == "dispose")
            {
                return makeFunction(
                    runtime, "dispose", 0,
                    [scope](jsi::Runtime &, const jsi::Value &, const jsi::Value *, size_t) {
                        scope->dispose();
                        return jsi::Value::undefined();
                    });
            }
            if (std::find(namespaces_.begin(), namespaces_.end(), name) == namespaces_.end())
            {
                return jsi::Value::undefined();
            }
            return cachedUIScopeNamespace(
                runtime, std::to_string(cacheId_) + ":" + name,
                [&] {
                    AddonScope addonScope(scope->addon());
                    return create_(runtime, name);
                },
                [scope] {
                    return scope->active();
                });
        }

        std::shared_ptr<UIScope>            scope_;
        const std::vector<std::string>      namespaces_;
        UIScopeNamespaceFactory             create_;
        std::function<void(jsi::Runtime &)> onRead_;
        const uint64_t                      cacheId_;
    };
}

jsi::Object makeUIScopeObject(jsi::Runtime &runtime, std::shared_ptr<UIScope> scope,
                              std::vector<std::string> namespaces, UIScopeNamespaceFactory create,
                              std::function<void(jsi::Runtime &)> onRead)
{
    return jsi::Object::createFromHostObject(
        runtime, std::make_shared<UIScopeHost>(std::move(scope), std::move(namespaces),
                                               std::move(create), std::move(onRead)));
}
}
