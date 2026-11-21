#include <algorithm>
#include <cassert>
#include <string>

#include "LoaderFiles.h"
#include "LoaderPipeline.h"
#include "LoaderPreferences.h"
#include "PipelineFixtures.h"

namespace {
using pipeline_test::kBase;
using pipeline_test::kBundle;
using pipeline_test::Launch;

void waitsForWifiBeforeABackgroundUpdate()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    launch.server.publish(kBase, "2026-10-03T00:00:00.000Z", {{kBundle, "next"}});
    launch.host->metered = true;
    int downloads        = launch.server.downloads;

    launch.pipeline.prepare();
    assert(launch.server.downloads == downloads);
    assert(!launch.pipeline.hasStagedBundle());

    // Still metered: returning to the foreground keeps waiting.
    launch.pipeline.onForeground();
    assert(launch.server.downloads == downloads);

    launch.host->metered = false;
    launch.pipeline.onForeground();
    assert(loader::readTextFile(launch.server.candidate()) == "next");
    assert(launch.pipeline.hasStagedBundle());
}

void checksWhenGoingToTheBackgroundOnlyWhenDue()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    launch.server.publish(kBase, "2026-10-03T00:00:00.000Z", {{kBundle, "next"}});
    launch.host->metered = true;
    launch.pipeline.prepare();
    int downloads = launch.server.downloads;

    launch.host->metered = false;
    Launch fresh;
    fresh.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(fresh.server.install(fresh.updater, std::nullopt));
    fresh.pipeline.prepare();
    int freshDownloads = fresh.server.downloads;
    assert(!fresh.pipeline.onBackground());
    assert(fresh.server.downloads == freshDownloads);

    launch.pipeline.onBackground();
    assert(launch.server.downloads > downloads);
    assert(loader::readTextFile(launch.server.candidate()) == "next");
    assert(!launch.pipeline.isCheckingForUpdate());
}

void checksInTheForegroundOnlyOnceTheLastCheckIsOld()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    launch.pipeline.prepare();
    int downloads = launch.server.downloads;

    launch.pipeline.onForeground();

    assert(launch.server.downloads == downloads);
}

void retriesAFailedCheckWhenTheServerSaysWhen()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    launch.server.publish(kBase, "2026-10-03T00:00:00.000Z", {{kBundle, "next"}});
    launch.server.failNext = loader::DownloadResult{503, "", "7"};

    launch.pipeline.prepare();
    assert(!launch.pipeline.hasStagedBundle());

    auto retry = std::find(launch.host->delays.begin(), launch.host->delays.end(), 7.0);
    assert(retry != launch.host->delays.end());
    launch.host->delayed[retry - launch.host->delays.begin()]();
    assert(loader::readTextFile(launch.server.candidate()) == "next");
    assert(launch.pipeline.hasStagedBundle());
}

void checksThenStagesABundleTheClientAsksForEvenOnAMeteredNetwork()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    // Metered, so the launch's own check waits and every check below asks the server.
    launch.host->metered = true;
    launch.pipeline.prepare();
    assert(!launch.pipeline.isBundleUpdateAvailable());

    launch.server.publish(kBase, "2026-10-03T00:00:00.000Z", {{kBundle, "next"}});
    int downloads = launch.server.downloads;

    assert(launch.pipeline.isBundleUpdateAvailable());
    assert(launch.server.downloads == downloads);
    assert(!launch.pipeline.hasStagedBundle());

    assert(launch.pipeline.updateBundleNow());
    assert(loader::readTextFile(launch.server.candidate()) == "next");
    assert(launch.host->reloads == 0);
    assert(!launch.pipeline.isCheckingForUpdate());
    // The staged candidate is what the next restart runs, so nothing newer waits.
    assert(!launch.pipeline.isBundleUpdateAvailable());
}

void answersTheClientFromTheLaunchCheckThatJustRan()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    launch.pipeline.prepare();
    int fetches = launch.server.fetches;

    assert(!launch.pipeline.isBundleUpdateAvailable());
    assert(launch.server.fetches == fetches);
}

void answersTheClientFromTheFirstDownloadThisLaunchRuns()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "first"}});
    launch.pipeline.prepare();
    assert(launch.pipeline.takeSavedBundle());
    // Promoted at once, as a dev server's bundle is.
    assert(launch.updater.acceptBundle(launch.server.candidate()));
    int fetches = launch.server.fetches;

    assert(!launch.pipeline.isBundleUpdateAvailable());
    assert(launch.server.fetches == fetches);
}

void keepsTheCandidateThisLaunchRunsWhenTheClientChecks()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    launch.server.publish(kBase, "2026-10-03T00:00:00.000Z", {{kBundle, "next"}});
    assert(launch.server.download(launch.updater, std::nullopt));
    launch.host->metered = true;
    launch.pipeline.prepare();
    // What evaluating the candidate marks before Discord's bundle runs.
    assert(launch.updater.markBundleAttempted(launch.server.candidate()));

    assert(!launch.pipeline.isBundleUpdateAvailable());
    launch.host->metered = false;
    assert(launch.pipeline.onBackground() == false);
    launch.pipeline.updateBundleNow();

    assert(loader::readTextFile(launch.server.candidate()) == "next");
    assert(loader::preferences::rejectedRevision(launch.server.settings).empty());
}

void leavesPausedClientUpdatesAlone()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    launch.pipeline.prepare();
    launch.server.settings.set("unbound", "updater.auto.client", false);
    launch.server.publish(kBase, "2026-10-03T00:00:00.000Z", {{kBundle, "next"}});
    int downloads = launch.server.downloads;

    assert(!launch.pipeline.isBundleUpdateAvailable());
    assert(!launch.pipeline.updateBundleNow());
    assert(launch.server.downloads == downloads);
    assert(!loader::fileExists(launch.server.candidate()));
}

void reportsNoUpdateFromASourceWithoutAManifestToCompare()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    launch.pipeline.prepare();
    launch.server.settings.set("unbound", "loader.update.unsigned", true);

    assert(!launch.pipeline.isBundleUpdateAvailable());
}

void spacesRetriesWithJitter()
{
    using loader::LoaderPipeline;
    assert(LoaderPipeline::retryDelay(0, std::nullopt, 0.0) == 30 * 0.8);
    assert(LoaderPipeline::retryDelay(1, std::nullopt, 0.5) == 120);
    assert(LoaderPipeline::retryDelay(9, std::nullopt, 0.0) == 600 * 0.8);
    assert(LoaderPipeline::retryDelay(0, 99999.0, 0.0) == LoaderPipeline::kMaxRetryAfterSeconds);
    assert(loader::retryAfterSeconds("120") == 120.0);
    assert(!loader::retryAfterSeconds("Wed, 21 Oct 2026 07:28:00 GMT"));
    assert(!loader::retryAfterSeconds(""));
    assert(loader::maxAgeSeconds("max-age=600") == 600.0);
    assert(loader::maxAgeSeconds("public, MAX-AGE=3600, must-revalidate") == 3600.0);
    assert(loader::maxAgeSeconds("max-age=0, no-cache, no-store") == 0.0);
    assert(!loader::maxAgeSeconds("s-maxage=60"));
    assert(!loader::maxAgeSeconds("no-cache"));
    assert(!loader::maxAgeSeconds(""));
}
}

int main()
{
    waitsForWifiBeforeABackgroundUpdate();
    checksWhenGoingToTheBackgroundOnlyWhenDue();
    checksInTheForegroundOnlyOnceTheLastCheckIsOld();
    retriesAFailedCheckWhenTheServerSaysWhen();
    checksThenStagesABundleTheClientAsksForEvenOnAMeteredNetwork();
    answersTheClientFromTheLaunchCheckThatJustRan();
    answersTheClientFromTheFirstDownloadThisLaunchRuns();
    keepsTheCandidateThisLaunchRunsWhenTheClientChecks();
    leavesPausedClientUpdatesAlone();
    reportsNoUpdateFromASourceWithoutAManifestToCompare();
    spacesRetriesWithJitter();
    return 0;
}
