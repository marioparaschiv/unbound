#include <cassert>

#include "NativeHookKeys.h"

using loader::native::coalescedHookKey;
using loader::native::hookCallbackKey;
using loader::native::kAndroidHookPlatform;
using loader::native::kIOSHookPlatform;
using loader::native::nextHookIdentifier;
using loader::native::receiverCoalesceKey;

int main()
{
    uint64_t first  = nextHookIdentifier();
    uint64_t second = nextHookIdentifier();
    assert(first >= 1 && second == first + 1);

    assert(hookCallbackKey(kIOSHookPlatform, "7") == "ios-hook:7");
    assert(hookCallbackKey(kAndroidHookPlatform, "java-hook-3") == "android-hook:java-hook-3");
    assert(receiverCoalesceKey(kIOSHookPlatform, "7", "4096") == "ios-hook:7:4096");

    assert(*coalescedHookKey(kAndroidHookPlatform, "hook-1",
                             R"({"self":{"type":"handle","value":"java-9"},"args":[]})") ==
           "android-hook:hook-1:java-9");
    assert(!coalescedHookKey(kAndroidHookPlatform, "hook-1", "not json"));
    assert(!coalescedHookKey(kAndroidHookPlatform, "hook-1", "[]"));
    assert(!coalescedHookKey(kAndroidHookPlatform, "hook-1", R"({"args":[]})"));
    assert(!coalescedHookKey(kAndroidHookPlatform, "hook-1", R"({"self":"java-9"})"));
    assert(!coalescedHookKey(kAndroidHookPlatform, "hook-1",
                             R"({"self":{"type":"string","value":"java-9"}})"));
    assert(!coalescedHookKey(kAndroidHookPlatform, "hook-1",
                             R"({"self":{"type":"handle","value":9}})"));
}
