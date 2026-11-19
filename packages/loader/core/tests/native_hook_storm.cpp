#include <cassert>
#include <chrono>

#include "NativeHookStorm.h"

int main()
{
    using namespace std::chrono_literals;
    auto start = std::chrono::steady_clock::now();
    int named  = 0;
    auto name  = [&named] {
        named++;
        return std::string("DCDCell -layoutSubviews");
    };

    for (size_t index = 0; index < loader::native::kHookStormLimit; index++)
    {
        assert(loader::native::admitHookEvent(7, loader::kNoAddon, name, start + 1ms));
    }

    assert(!loader::native::admitHookEvent(7, loader::kNoAddon, name, start + 2ms));
    assert(!loader::native::admitHookEvent(7, loader::kNoAddon, name, start + 3ms));
    assert(named == 1);
    assert(loader::native::admitHookEvent(8, loader::kNoAddon, name, start + 3ms));
    assert(loader::native::admitHookEvent(7, loader::kNoAddon, name, start + 1100ms));

    loader::native::forgetHookEvents(7);
    assert(loader::native::admitHookEvent(7, loader::kNoAddon, name, start + 1101ms));
    return 0;
}
