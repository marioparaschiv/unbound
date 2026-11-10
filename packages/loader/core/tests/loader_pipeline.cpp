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
#include "bundle_test_server.h"

namespace {
const std::string kBase   = "https://builds.unbound.rip/";
const std::string kBundle = "unbound.98.bundle";
const std::string kDev    = "unbound-dev.98.bundle";

class CountingHost : public loader::LoaderHost
{
public:
    int                      addonPreparations = 0;
    int                      reloads           = 0;
    std::vector<std::string> events;

    void runInBackground(std::function<void()> work) override
    {
        work();
    }

    void runAfter(double seconds, std::function<void()> work) override
    {
        delays.push_back(seconds);
        delayed.push_back(std::move(work));
    }

    loader::PreviousExit previousExit() override
    {
        return exit;
    }

    bool onMeteredNetwork() override
    {
        return metered;
    }

    std::vector<double>  delays;
    loader::PreviousExit exit    = loader::PreviousExit::Unknown;
    bool                 metered = false;

    std::vector<std::function<void()>> delayed;

    std::optional<std::string> resource(const std::string &) override
    {
        return std::nullopt;
    }

    std::optional<std::string> resolveUpdateURL() override
    {
        return std::nullopt;
    }

    uint32_t runtimeBytecodeVersion() override
    {
        return 98;
    }

    loader::UnboundNativeProvider unboundNativeProvider() override
    {
        return {};
    }

    void installNativeModules(facebook::jsi::Runtime &) override {}

    void onAddonsPrepared() override
    {
        addonPreparations++;
        events.push_back("addons prepared");
    }

    void reload() override
    {
        reloads++;
    }

    void alert(const std::string &message) override
    {
        alerts.push_back(message);
    }

    std::vector<std::string> alerts;
};

// Marks the running loader as having checked before, so a launch models a loader that was not just
// updated.
bool checkedBy(bundle_test::Server &server, const std::string &version)
{
    server.settings.set("unbound", loader::kCheckedLoaderSetting, version);
    return true;
}

struct Launch {
    bundle_test::Server           server;
    bool                          checked = checkedBy(server, loader::loaderVersion());
    loader::BundleUpdater         updater = server.updater(bundle_test::productionTrust());
    std::shared_ptr<CountingHost> host    = std::make_shared<CountingHost>();
    loader::LoaderPipeline        pipeline{host, loader::updaterSettings(server.settings), updater};
};

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
    assert(launch.server.settings.getString("unbound", loader::kCheckedLoaderSetting, "") ==
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
    assert(launch.pipeline.launchTimings().find("Launch counted as healthy: not yet") ==
           std::string::npos);
}

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
}
}

int main()
{
    leavesAFirstDownloadForTheRuntime();
    keepsTheSavedBundleUntilTheNextLaunch();
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
    waitsForWifiBeforeABackgroundUpdate();
    checksInTheForegroundOnlyOnceTheLastCheckIsOld();
    retriesAFailedCheckWhenTheServerSaysWhen();
    spacesRetriesWithJitter();
    return 0;
}
