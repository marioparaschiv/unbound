#include <cassert>

#include "LoaderTelemetry.h"

int main()
{
    assert(loader::isTelemetryURL("https://discord.com/api/v9/science"));
    assert(loader::isTelemetryURL("https://discord.com/api/v10/metrics?x=1"));
    assert(loader::isTelemetryURL("https://canary.discord.com/api/science"));
    assert(loader::isTelemetryURL("https://DISCORD.com/API/v9/Science"));
    assert(loader::isTelemetryURL("https://discordapp.com/api/v9/metrics/v2"));

    assert(!loader::isTelemetryURL("https://discord.com/api/v9/channels/1/messages"));
    assert(!loader::isTelemetryURL("https://discord.com/api/v9/sciencefair"));
    assert(!loader::isTelemetryURL("https://evil-discord.com/api/v9/science"));
    assert(!loader::isTelemetryURL("https://discord.com.evil.net/api/v9/science"));
    assert(!loader::isTelemetryURL("http://discord.com/api/v9/science"));
    assert(!loader::isTelemetryURL("https://cdn.discordapp.com/attachments/science"));
    assert(!loader::isTelemetryURL(""));
    return 0;
}
