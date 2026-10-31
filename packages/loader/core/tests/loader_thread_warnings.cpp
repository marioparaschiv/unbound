#include <cassert>
#include <chrono>

#include "LoaderThreadWarnings.h"

using namespace loader;
using namespace loader::threading;

int main()
{
    bool                                  developerMode = false;
    int                                   reads         = 0;
    std::chrono::steady_clock::time_point now{};
    OffMainViewWarnings                   warnings(
        [&] {
            reads++;
            return developerMode;
        },
        [&] {
            return now;
        });

    assert(!warnings.warning(kNoAddon, "-[UIView bounds]"));
    developerMode = true;
    assert(!warnings.warning(kNoAddon, "-[UIView bounds]"));
    assert(reads == 1);

    now += std::chrono::seconds(1);
    AddonSlot plugin = registerAddonSlot("astral.example", "Example");
    assert(*warnings.warning(plugin, "-[UIView bounds]") ==
           "Example called -[UIView bounds] off the main thread. Views are only safe on the main "
           "thread; use invokeAsync instead.");
    assert(!warnings.warning(plugin, "-[UIView bounds]"));
    assert(warnings.warning(plugin, "android.view.View.getWidth()"));
    assert(warnings.warning(kNoAddon, "-[UIView bounds]")->rfind("an unknown plugin", 0) == 0);

    assert(hookFailureMessage(plugin, "boom") == "Native plugin hook failed in Example: boom");

    std::chrono::steady_clock::time_point failedAt{};
    HookFailureThrottle                   throttle([&] {
        return failedAt;
    });
    assert(*throttle.admit(plugin, "boom") == "Native plugin hook failed in Example: boom");
    assert(!throttle.admit(plugin, "boom"));
    assert(!throttle.admit(plugin, "boom"));
    assert(*throttle.admit(plugin, "other") == "Native plugin hook failed in Example: other");
    failedAt += std::chrono::seconds(10);
    assert(*throttle.admit(plugin, "boom") ==
           "Native plugin hook failed in Example: boom [repeated 3 times]");
    assert(!throttle.admit(plugin, "boom"));
    assert(callbackFailureMessage(plugin, "boom") ==
           "Native plugin callback failed in Example: boom");
    assert(hookSkippedMessage(plugin, "layoutSubviews") ==
           "Native plugin hook skipped in Example: the JavaScript thread did not answer the "
           "layoutSubviews hook within 100 ms, so it did not run");

    developerMode = false;
    now += std::chrono::seconds(1);
    assert(!warnings.warning(plugin, "-[UIView bounds]"));
    developerMode = true;
    now += std::chrono::seconds(1);
    assert(warnings.warning(plugin, "-[UIView bounds]"));
    return 0;
}
