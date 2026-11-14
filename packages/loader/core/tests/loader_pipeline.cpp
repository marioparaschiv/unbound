#include <algorithm>
#include <cassert>
#include <cstring>
#include <string>
#include <vector>

#include "HermesBytecodeHeader.h"
#include "LoaderLaunchGuard.h"
#include "LoaderLog.h"
#include "LoaderPipeline.h"
#include "LoaderVersion.h"
#include "PipelineFixtures.h"

namespace {
using pipeline_test::checkedBy;
using pipeline_test::CountingHost;
using pipeline_test::kBase;
using pipeline_test::kBundle;
using pipeline_test::kDev;
using pipeline_test::Launch;

void leavesAFirstDownloadForTheRuntime()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "first"}});

    launch.pipeline.prepare();

    assert(launch.host->addonPreparations == 1);
    assert(launch.host->reloads == 0);
    assert(loader::readTextFile(launch.server.candidate()) == "first");
    // The runtime waits for it, so it runs this launch and is not staged.
    assert(!launch.pipeline.hasStagedBundle());
}

void keepsTheSavedBundleUntilTheNextLaunch()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    launch.server.publish(kBase, "2026-10-03T00:00:00.000Z", {{kBundle, "next"}});

    launch.pipeline.prepare();

    assert(launch.host->reloads == 0);
    assert(loader::readTextFile(launch.server.candidate()) == "next");
    assert(launch.pipeline.hasStagedBundle());
}

std::string hermesBundle(uint32_t version, const std::string &body)
{
    std::string bytes(12, '\0');
    std::memcpy(bytes.data(), &loader::kHermesMagic, sizeof(loader::kHermesMagic));
    std::memcpy(bytes.data() + 8, &version, sizeof(version));
    return bytes + body;
}

void waitsForAMatchingBundleWhenDiscordsBytecodeChanges()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, hermesBundle(97, "old")}});
    assert(launch.server.install(launch.updater, std::nullopt));
    launch.server.publish(kBase, "2026-10-03T00:00:00.000Z", {{kBundle, hermesBundle(98, "new")}});

    launch.pipeline.prepare();

    assert(!launch.pipeline.hasStagedBundle());
    std::optional<loader::LoaderPipeline::SavedBundle> bundle = launch.pipeline.takeSavedBundle();
    assert(bundle && bundle->bytecode);
    assert(loader::hermesBytecodeVersion(bundle->bytecode->data(), bundle->bytecode->size()) == 98);
}

void runsAHotReloadUpdateWithoutReloading()
{
    Launch launch;
    launch.server.settings.set("unbound", "loader.update.hmr", true);
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    launch.server.publish(kBase, "2026-10-03T00:00:00.000Z", {{kBundle, "next"}});

    launch.pipeline.prepare();

    std::optional<loader::LoaderPipeline::SavedBundle> bundle = launch.pipeline.takeSavedBundle();
    assert(bundle && bundle->bundle == "next");
    assert(launch.host->reloads == 0);
}

void runsTheSavedBundleWithHotReloadOnAndNoUpdate()
{
    Launch launch;
    launch.server.settings.set("unbound", "loader.update.hmr", true);
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(launch.server.install(launch.updater, std::nullopt));

    launch.pipeline.prepare();

    std::optional<loader::LoaderPipeline::SavedBundle> bundle = launch.pipeline.takeSavedBundle();
    assert(bundle && bundle->bundle == "current");
    assert(launch.host->reloads == 0);
}

void runsTheSavedBundleWhenItsFlavourMatches()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "default"}, {kDev, "dev"}});
    launch.server.settings.set("unbound", "developer-mode", true);
    assert(launch.server.install(launch.updater, std::nullopt));
    assert(launch.server.activeContents() == "dev");

    launch.pipeline.prepare();

    std::optional<loader::LoaderPipeline::SavedBundle> bundle = launch.pipeline.takeSavedBundle();
    assert(bundle && bundle->bundle == "dev");
    assert(launch.server.lastDownload == kBase + kDev);
    assert(launch.host->reloads == 0);
}

void runsTheDevBundleItDownloadedForTheSwitch()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "default"}, {kDev, "dev"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    assert(launch.server.activeContents() == "default");
    launch.server.settings.set("unbound", "developer-mode", true);

    launch.pipeline.prepare();

    assert(launch.server.lastDownload == kBase + kDev);
    std::optional<loader::LoaderPipeline::SavedBundle> bundle = launch.pipeline.takeSavedBundle();
    assert(bundle && bundle->bundle == "dev");
    assert(bundle->path == launch.server.candidate());
    assert(launch.host->reloads == 0);
}

void runsTheSavedBundleWhenNoDevBundleIsPublished()
{
    Launch launch;
    launch.server.settings.set("unbound", "developer-mode", true);
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "default"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    launch.server.publish(kBase, "2026-10-03T00:00:00.000Z", {{kBundle, "next"}});

    launch.pipeline.prepare();

    // Not a pending switch: the saved bundle runs now and the update waits for the next launch.
    std::optional<loader::LoaderPipeline::SavedBundle> bundle = launch.pipeline.takeSavedBundle();
    assert(bundle && bundle->bundle == "default");
    assert(bundle->path == launch.server.active());
}

void fallsBackToTheSavedBundleWhenTheSwitchDownloadFails()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "default"}, {kDev, "dev"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    launch.server.files.erase(kBase + kDev);
    launch.server.settings.set("unbound", "developer-mode", true);

    launch.pipeline.prepare();

    std::optional<loader::LoaderPipeline::SavedBundle> bundle = launch.pipeline.takeSavedBundle();
    assert(bundle && bundle->bundle == "default");
    assert(bundle->path == launch.server.active());
    assert(launch.server.activeContents() == "default");
}

void logsTheRuntimeBeforeAddonsLoadForIt()
{
    Launch launch;
    loader::setLogSink([&](loader::LogLevel, const std::string &, const std::string &text) {
        launch.host->events.push_back(text);
    });

    launch.pipeline.prepare();
    loader::setLogSink(nullptr);

    const std::vector<std::string> &events = launch.host->events;
    auto runtime  = std::find(events.begin(), events.end(), "Discord's runtime was created.");
    auto prepared = std::find(events.begin(), events.end(), "addons prepared");
    assert(runtime != events.end() && prepared != events.end());
    assert(runtime < prepared);
}

void runsTheNewBundleOnTheFirstLaunchAfterALoaderUpdate()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    checkedBy(launch.server, "0.0.1");
    launch.server.publish(kBase, "2026-10-03T00:00:00.000Z", {{kBundle, "next"}});

    launch.pipeline.prepare();

    std::optional<loader::LoaderPipeline::SavedBundle> bundle = launch.pipeline.takeSavedBundle();
    assert(bundle && bundle->bundle == "next");
    assert(launch.server.settings.getString("unbound", "loader.update.checkedBy", "") ==
           loader::loaderVersion());
    assert(launch.host->reloads == 0);
}

void doesNothingWhenDisabled()
{
    Launch launch;
    launch.server.settings.set("unbound", "loader.enabled", false);
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "first"}});

    launch.pipeline.prepare();

    assert(launch.host->addonPreparations == 0);
    assert(launch.host->reloads == 0);
    assert(launch.server.downloads == 0);
}

void mapsBytecodeAndReadsSource()
{
    bundle_test::Server server;
    std::string         bytecode(64, '\0');
    uint64_t            magic = loader::kHermesMagic;
    std::memcpy(bytecode.data(), &magic, sizeof(magic));
    bytecode[8] = 98;
    assert(loader::writeTextFileAtomically(server.path("unbound.bundle"), bytecode));
    assert(loader::writeTextFileAtomically(server.path("unbound.js"), "source"));

    auto mapped = loader::LoaderPipeline::readSavedBundle(server.path("unbound.bundle"));
    assert(mapped && mapped->bundle.empty() && mapped->bytecode && !mapped->empty());
    assert(std::string(reinterpret_cast<const char *>(mapped->bytecode->data()),
                       mapped->bytecode->size()) == bytecode);

    auto source = loader::LoaderPipeline::readSavedBundle(server.path("unbound.js"));
    assert(source && source->bundle == "source" && !source->bytecode);

    assert(!loader::LoaderPipeline::readSavedBundle(server.path("missing.bundle")));
}

void explainsWhyAFirstLaunchHasNoBundle()
{
    Launch offline;
    offline.pipeline.prepare();
    assert(offline.host->alerts.size() == 1);
    assert(offline.host->alerts[0] ==
           loader::bundleFailureNotice(loader::BundleUpdateFailure::Network));

    Launch outdated;
    outdated.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "next"}}, {}, "beta",
                            "abc1234", "999.0.0");
    outdated.pipeline.prepare();
    assert(outdated.host->alerts.size() == 1);
    assert(outdated.host->alerts[0] ==
           loader::bundleFailureNotice(loader::BundleUpdateFailure::LoaderTooOld));
}

void guardsTheLaunchOncePerProcess()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    std::string marker = launch.server.path(loader::LaunchGuard::kFile);

    launch.pipeline.prepare();
    assert(loader::fileExists(marker));
    // A reload in the same process does not count as a failed launch.
    launch.pipeline.prepare();
    assert(loader::readTextFile(marker) == R"({"failures":0})");

    for (const std::function<void()> &work : launch.host->delayed)
    {
        work();
    }
    assert(!loader::fileExists(marker));
}

void turnsOnRecoveryModeAfterRepeatedFailedLaunches()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    assert(loader::writeTextFileAtomically(launch.server.path(loader::LaunchGuard::kFile),
                                           R"({"failures":2})"));

    launch.pipeline.prepare();

    assert(launch.server.settings.getBoolean("unbound", "recovery", false));
}

void ignoresAnEarlyExitThatWasNotACrash()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    std::string marker = launch.server.path(loader::LaunchGuard::kFile);
    assert(loader::writeTextFileAtomically(marker, R"({"failures":2})"));
    launch.host->exit = loader::PreviousExit::Ended;

    launch.pipeline.prepare();

    assert(!launch.server.settings.getBoolean("unbound", "recovery", false));
    assert(loader::readTextFile(marker) == R"({"failures":0})");
}

void countsTheLaunchHealthyShortlyAfterTheFirstRender()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    std::string marker = launch.server.path(loader::LaunchGuard::kFile);
    launch.pipeline.prepare();
    launch.host->delays.clear();
    launch.host->delayed.clear();

    launch.pipeline.markRendered();
    launch.pipeline.markRendered();

    assert(launch.host->delays.size() == 1);
    assert(launch.host->delays[0] == loader::LoaderPipeline::kRenderedHealthySeconds);
    launch.host->delayed[0]();
    assert(!loader::fileExists(marker));
}

void runDelayed(CountingHost &host, double seconds)
{
    for (size_t index = 0; index < host.delays.size(); index++)
    {
        if (host.delays[index] == seconds)
        {
            host.delayed[index]();
        }
    }
}

void offersTheToolboxOnceWhenDiscordNeverRenders()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    launch.pipeline.prepare();

    runDelayed(*launch.host, loader::LoaderPipeline::kStuckLaunchSeconds);
    runDelayed(*launch.host, loader::LoaderPipeline::kStuckLaunchSeconds);

    assert(launch.host->stuck.size() == 1);
    assert(launch.host->stuck[0] == loader::LoaderPipeline::kStuckLaunchNotice);
}

void staysQuietWhenDiscordRendered()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    launch.pipeline.prepare();
    launch.pipeline.markRendered();

    runDelayed(*launch.host, loader::LoaderPipeline::kStuckLaunchSeconds);

    assert(launch.host->stuck.empty());
}

}

int main()
{
    offersTheToolboxOnceWhenDiscordNeverRenders();
    staysQuietWhenDiscordRendered();
    leavesAFirstDownloadForTheRuntime();
    keepsTheSavedBundleUntilTheNextLaunch();
    waitsForAMatchingBundleWhenDiscordsBytecodeChanges();
    runsAHotReloadUpdateWithoutReloading();
    runsTheSavedBundleWithHotReloadOnAndNoUpdate();
    runsTheSavedBundleWhenItsFlavourMatches();
    runsTheDevBundleItDownloadedForTheSwitch();
    fallsBackToTheSavedBundleWhenTheSwitchDownloadFails();
    runsTheSavedBundleWhenNoDevBundleIsPublished();
    logsTheRuntimeBeforeAddonsLoadForIt();
    runsTheNewBundleOnTheFirstLaunchAfterALoaderUpdate();
    doesNothingWhenDisabled();
    mapsBytecodeAndReadsSource();
    explainsWhyAFirstLaunchHasNoBundle();
    guardsTheLaunchOncePerProcess();
    turnsOnRecoveryModeAfterRepeatedFailedLaunches();
    ignoresAnEarlyExitThatWasNotACrash();
    countsTheLaunchHealthyShortlyAfterTheFirstRender();
    return 0;
}
