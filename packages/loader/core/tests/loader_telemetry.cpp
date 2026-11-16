#include <cassert>

#include "LoaderTelemetry.h"

int main()
{
    assert(loader::isTelemetryURL("https://discord.com/api/v9/science"));
    assert(loader::isTelemetryURL("https://discord.com/api/v10/metrics?x=1"));
    assert(loader::isTelemetryURL("https://canary.discord.com/api/science"));
    assert(loader::isTelemetryURL("https://DISCORD.com/API/v9/Science"));
    assert(loader::isTelemetryURL("https://discordapp.com/api/v9/metrics/v2"));
    assert(loader::isTelemetryURL("https://discord.com/error-reporting-proxy/ios/1/envelope/"));
    assert(loader::isTelemetryURL("https://o64374.ingest.sentry.io/api/1/envelope/"));
    assert(loader::isTelemetryURL("https://launches.appsflyersdk.com/api/v6.15/iosevent"));
    assert(loader::isTelemetryURL("https://img.litix.io/a.gif?x=1"));
    assert(loader::isTelemetryURL("https://siteintercept.qualtrics.com/WRSiteInterceptEngine/"));

    assert(!loader::isTelemetryURL("https://discord.com/api/v9/channels/1/messages"));
    assert(!loader::isTelemetryURL("https://discord.com/api/v9/sciencefair"));
    assert(!loader::isTelemetryURL("https://evil-discord.com/api/v9/science"));
    assert(!loader::isTelemetryURL("https://discord.com.evil.net/api/v9/science"));
    assert(!loader::isTelemetryURL("http://discord.com/api/v9/science"));
    assert(!loader::isTelemetryURL("https://cdn.discordapp.com/attachments/science"));
    assert(!loader::isTelemetryURL("https://discord.com/error-reporting-proxyx"));
    assert(!loader::isTelemetryURL("https://notsentry.io/api/1/envelope/"));
    assert(!loader::isTelemetryURL("https://sentry.io.evil.net/x"));
    assert(!loader::isTelemetryURL("https://discord.com/api/v9/experiments"));
    assert(!loader::isTelemetryURL("https://www.google.com/generate_204"));
    assert(!loader::isTelemetryURL(""));
    return 0;
}
