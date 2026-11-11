#pragma once

#include <functional>
#include <jsi/jsi.h>
#include <mutex>
#include <string>
#include <vector>

#include "LoaderAddonActivity.h"

// A plugin's UI scope (`createUIScope`): the method paths it may call on the UI thread and the
// hooks it installed, which dispose removes. Each platform supplies its namespaces and its hook
// release.
namespace loader::native {
// The runtime a UI scope is installing a hook from on this thread, or null outside one.
facebook::jsi::Runtime *currentUIScopeRuntime();

class UIScope
{
public:
    // A hook's removal; empty when the install returned no hook.
    using Release = std::function<void()>;
    using Install = std::function<std::pair<facebook::jsi::Value, Release>()>;

    UIScope(AddonSlot addon, std::vector<std::string> allowed);

    AddonSlot                       addon() const;
    const std::vector<std::string> &allowed() const;
    bool                            allows(const std::string &path) const;
    bool                            active() const;

    // Runs `install` as the scope's addon with currentUIScopeRuntime() set, and keeps its release
    // for dispose. Throws a JSError once the scope is disposed.
    facebook::jsi::Value hook(facebook::jsi::Runtime &runtime, const Install &install);
    // Removes every hook the scope installed; later calls do nothing.
    void dispose();

private:
    const AddonSlot                addon_;
    const std::vector<std::string> allowed_;
    mutable std::mutex             mutex_;
    std::vector<Release>           releases_;
    bool                           disposed_ = false;
};

using UIScopeNamespaceFactory =
    std::function<facebook::jsi::Object(facebook::jsi::Runtime &, const std::string &name)>;

// The object `createUIScope` returns: `dispose`, plus each name in `namespaces`, built once per
// scope by `create` as the scope's addon and rejected after dispose. `onRead` runs before each
// property read. Disposes the scope when collected.
facebook::jsi::Object makeUIScopeObject(facebook::jsi::Runtime                       &runtime,
                                        std::shared_ptr<UIScope>                      scope,
                                        std::vector<std::string>                      namespaces,
                                        UIScopeNamespaceFactory                       create,
                                        std::function<void(facebook::jsi::Runtime &)> onRead = {});
}
