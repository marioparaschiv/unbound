#include "LoaderHookBreadcrumbs.h"

#include <algorithm>
#include <cstring>
#include <mutex>
#include <unistd.h>

#include "LoaderAddonActivity.h"

namespace loader {
namespace {
    struct HookName {
        char text[kHookNameBytes];
        uint32_t length;
    };

    HookName gNames[kHookNameCapacity];
    uint32_t gNameCount = 0;
    std::mutex gNamesMutex;

    bool writeAll(int descriptor, const char *text, size_t length)
    {
        return length == 0 || write(descriptor, text, length) > 0;
    }
}

uint32_t registerHookName(const std::string &name)
{
    std::lock_guard<std::mutex> lock(gNamesMutex);
    for (uint32_t index = 1; index <= gNameCount; index++)
    {
        const HookName &existing = gNames[index - 1];
        if (existing.length == std::min(name.size(), kHookNameBytes)
            && std::memcmp(existing.text, name.data(), existing.length) == 0)
        {
            return index;
        }
    }

    if (gNameCount >= kHookNameCapacity)
    {
        return 0;
    }

    HookName &slot = gNames[gNameCount];
    size_t length  = std::min(name.size(), kHookNameBytes);
    std::memcpy(slot.text, name.data(), length);
    __atomic_store_n(&slot.length, static_cast<uint32_t>(length), __ATOMIC_RELEASE);
    __atomic_store_n(&gNameCount, gNameCount + 1, __ATOMIC_RELEASE);
    return gNameCount;
}

bool writeCrashingHookLines(int descriptor)
{
    HookCall calls[kHookTrailLength];
    size_t count = crashingThreadHookCalls(calls, kHookTrailLength);
    if (descriptor < 0 || count == 0)
    {
        return false;
    }

    uint32_t known = __atomic_load_n(&gNameCount, __ATOMIC_ACQUIRE);
    for (size_t index = 0; index < count; index++)
    {
        uint32_t hook = calls[index].hook;
        if (hook == 0 || hook > known)
        {
            continue;
        }

        const HookName &name  = gNames[hook - 1];
        uint32_t recordLength = 0;
        const char *record    = addonRecordText(calls[index].addon, recordLength);
        const char prefix[]   = "Hook ";
        const char space      = ' ';
        const char newline    = '\n';
        writeAll(descriptor, prefix, sizeof(prefix) - 1);
        writeAll(descriptor, name.text, __atomic_load_n(&name.length, __ATOMIC_ACQUIRE));
        if (record)
        {
            writeAll(descriptor, &space, 1);
            writeAll(descriptor, record, recordLength);
        }

        writeAll(descriptor, &newline, 1);
    }

    return true;
}
}
