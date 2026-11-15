#pragma once

#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "LoaderPipeline.h"
#include "LoaderVersion.h"
#include "bundle_test_server.h"

namespace pipeline_test {
const std::string kBase   = "https://builds.unbound.rip/";
const std::string kBundle = "unbound.98.bundle";
const std::string kDev    = "unbound-dev.98.bundle";

class CountingHost : public loader::PipelineHost
{
public:
    int addonPreparations = 0;
    int reloads           = 0;
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

    std::vector<double> delays;
    loader::PreviousExit exit = loader::PreviousExit::Unknown;
    bool metered              = false;

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

    loader::LoaderInstall loaderInstall() override
    {
        return install;
    }

    void stuckLaunch(const std::string &message) override
    {
        stuck.push_back(message);
    }

    std::vector<std::string> alerts;
    std::vector<std::string> stuck;
    loader::LoaderInstall install = loader::LoaderInstall::Unknown;
};

// Marks the running loader as having checked before, so a launch models a loader that was not just
// updated.
inline bool checkedBy(bundle_test::Server &server, const std::string &version)
{
    server.settings.set("unbound", "loader.update.checkedBy", version);
    return true;
}

struct Launch {
    bundle_test::Server server;
    bool checked                       = checkedBy(server, loader::loaderVersion());
    loader::BundleUpdater updater      = server.updater(bundle_test::productionTrust());
    std::shared_ptr<CountingHost> host = std::make_shared<CountingHost>();
    loader::LoaderPipeline pipeline{host, server.settings, updater};
};
}
