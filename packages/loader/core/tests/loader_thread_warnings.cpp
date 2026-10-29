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
    AddonSlot plugin = registerAddonSlot("unbound.example", "Example");
    assert(*warnings.warning(plugin, "-[UIView bounds]") ==
           "Example called -[UIView bounds] off the main thread. Views are only safe on the main "
           "thread; use invokeAsync instead.");
    assert(!warnings.warning(plugin, "-[UIView bounds]"));
    assert(warnings.warning(plugin, "android.view.View.getWidth()"));
    assert(warnings.warning(kNoAddon, "-[UIView bounds]")->rfind("an unknown plugin", 0) == 0);
    return 0;
}
