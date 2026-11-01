#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <hermes/hermes.h>
#include <jsi/jsi.h>
#include <memory>
#include <sstream>
#include <string>

#include "LoaderPipeline.h"

#include "../bundle_test_server.h"

namespace jsi = facebook::jsi;

static const std::string kBase   = "https://builds.unbound.rip/";
static const std::string kBundle = "unbound.98.bundle";

// Stands in for Unbound's bundle: it records whether Metro and the preload existed when it ran.
static const std::string kUnbound =
    "globalThis.order = ['unbound:' + typeof globalThis.__d + ':' + "
    "typeof Object.getOwnPropertyDescriptor(globalThis, 'UNBOUND_SETTINGS')];";
static const std::string kDiscord = "globalThis.__d = function () {}; "
                                    "(globalThis.order = globalThis.order || []).push('discord');";

static void require(bool condition, const std::string &check)
{
    if (!condition)
    {
        std::fprintf(stderr, "define stage check failed: %s\n", check.c_str());
        std::exit(1);
    }
}

class Host : public loader::LoaderHost
{
public:
    int reloads = 0;

    void runInBackground(std::function<void()> work) override
    {
        work();
    }

    std::optional<std::string> resource(const std::string &name) override
    {
        std::ifstream file(std::string(UNBOUND_BOOTSTRAP_DIR) + "/" + name + ".js");
        if (!file)
        {
            return std::nullopt;
        }
        std::stringstream contents;
        contents << file.rdbuf();
        return contents.str();
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

    void installNativeModules(jsi::Runtime &) override {}

    void reload() override
    {
        reloads++;
    }
};

static std::string launch(loader::LoaderPipeline &pipeline)
{
    auto runtime = facebook::hermes::makeHermesRuntime();
    pipeline.prepare();
    pipeline.onRuntimeCreated(*runtime);
    runtime->evaluateJavaScript(std::make_shared<jsi::StringBuffer>(kDiscord), "discord.js");
    jsi::Value order = runtime->evaluateJavaScript(
        std::make_shared<jsi::StringBuffer>("JSON.stringify(globalThis.order)"), "order.js");
    return order.getString(*runtime).utf8(*runtime);
}

static void runsTheSavedBundleBeforeDiscords()
{
    bundle_test::Server server;
    server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, kUnbound}});
    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());
    require(server.download(updater, std::nullopt), "the bundle downloads");
    auto                   host = std::make_shared<Host>();
    loader::LoaderPipeline pipeline(host, loader::updaterSettings(server.settings), updater);

    std::string order = launch(pipeline);

    require(order == R"(["unbound:undefined:object","discord"])",
            "Unbound runs before Discord's bundle, after the preload; got " + order);
    require(pipeline.isBundleReady(), "the bundle is marked ready");
    require(server.activeContents() == kUnbound, "the candidate that ran is promoted");
    require(host->reloads == 0, "a saved bundle needs no reload");
}

static void runsNothingEarlyWithoutASavedBundle()
{
    bundle_test::Server    server;
    loader::BundleUpdater  updater = server.updater(bundle_test::productionTrust());
    auto                   host    = std::make_shared<Host>();
    loader::LoaderPipeline pipeline(host, loader::updaterSettings(server.settings), updater);

    std::string order = launch(pipeline);

    require(order == R"(["discord"])", "only Discord runs; got " + order);
    require(!pipeline.isBundleReady(), "nothing is marked ready");
}

static void runsTheFirstDownloadBeforeDiscordsWithoutAReload()
{
    bundle_test::Server server;
    server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, kUnbound}});
    loader::BundleUpdater  updater = server.updater(bundle_test::productionTrust());
    auto                   host    = std::make_shared<Host>();
    loader::LoaderPipeline pipeline(host, loader::updaterSettings(server.settings), updater);

    std::string order = launch(pipeline);

    require(order == R"(["unbound:undefined:object","discord"])",
            "the first download runs before Discord's bundle; got " + order);
    require(pipeline.isBundleReady(), "the first bundle is marked ready");
    require(server.activeContents() == kUnbound, "the first bundle is promoted");
    require(host->reloads == 0, "the first download needs no reload");
}

static void doesNotReloadIntoABundleAfterOneFailed()
{
    bundle_test::Server server;
    server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "throw new Error('broken');"}});
    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());
    require(server.download(updater, std::nullopt), "the broken bundle downloads");
    auto                   host = std::make_shared<Host>();
    loader::LoaderPipeline pipeline(host, loader::updaterSettings(server.settings), updater);

    std::string order = launch(pipeline);

    require(order == R"(["discord"])", "a throwing bundle leaves Discord running; got " + order);
    require(!loader::fileExists(server.candidate()), "the failed candidate is rejected");

    server.publish(kBase, "2026-10-03T00:00:00.000Z", {{kBundle, "throw new Error('again');"}});
    launch(pipeline);

    require(host->reloads == 0, "a new download does not reload after a failure");
}

int main()
{
    runsTheSavedBundleBeforeDiscords();
    runsNothingEarlyWithoutASavedBundle();
    runsTheFirstDownloadBeforeDiscordsWithoutAReload();
    doesNotReloadIntoABundleAfterOneFailed();
    std::printf("define stage: Unbound's saved bundle runs before Discord's on Hermes\n");
    return 0;
}
