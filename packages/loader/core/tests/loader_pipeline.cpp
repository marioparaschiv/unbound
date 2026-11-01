#include <cassert>
#include <string>

#include "LoaderPipeline.h"
#include "bundle_test_server.h"

namespace {
const std::string kBase   = "https://builds.unbound.rip/";
const std::string kBundle = "unbound.98.bundle";

class CountingHost : public loader::LoaderHost
{
public:
    int addonPreparations = 0;
    int reloads           = 0;

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

    loader::PreloadPayload preloadPayload() override
    {
        return {};
    }

    void installNativeModules(facebook::jsi::Runtime &) override {}

    void onAddonsPrepared() override
    {
        addonPreparations++;
    }

    void reload() override
    {
        reloads++;
    }
};

struct Launch {
    bundle_test::Server           server;
    loader::BundleUpdater         updater = server.updater(bundle_test::productionTrust());
    std::shared_ptr<CountingHost> host    = std::make_shared<CountingHost>();
    loader::LoaderPipeline        pipeline{host, loader::updaterSettings(server.settings), updater};
};

void reloadsOnceAFirstDownloadArrives()
{
    Launch launch;
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "first"}});

    launch.pipeline.prepare();

    assert(launch.host->addonPreparations == 1);
    assert(launch.host->reloads == 1);
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

void reloadsForAnUpdateWithHotReloadOn()
{
    Launch launch;
    launch.server.settings.set("unbound", "loader.update.hmr", true);
    launch.server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "current"}});
    assert(launch.server.install(launch.updater, std::nullopt));
    launch.server.publish(kBase, "2026-10-03T00:00:00.000Z", {{kBundle, "next"}});

    launch.pipeline.prepare();

    assert(launch.host->reloads == 1);
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
    reloadsOnceAFirstDownloadArrives();
    keepsTheSavedBundleUntilTheNextLaunch();
    reloadsForAnUpdateWithHotReloadOn();
    doesNothingWhenDisabled();
    return 0;
}
