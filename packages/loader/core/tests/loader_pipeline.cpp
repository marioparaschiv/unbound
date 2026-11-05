#include <algorithm>
#include <cassert>
#include <string>
#include <vector>

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
    return 0;
}
