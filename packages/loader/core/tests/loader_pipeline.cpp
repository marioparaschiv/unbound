#include <cassert>
#include <chrono>
#include <filesystem>
#include <string>
#include <unistd.h>

#include "LoaderPipeline.h"

namespace {
class CountingHost : public loader::LoaderHost
{
public:
    int addonPreparations = 0;

    void runOnRuntime(std::function<void(facebook::jsi::Runtime &)>) override {}
    void runAfter(double, std::function<void()>) override {}
    void runInBackground(std::function<void()>) override {}

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
};

std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-pipeline-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}
}

int main()
{
    const auto root = makeTemporaryDirectory();

    loader::SettingsStore settings((root / "settings.json").string());
    settings.load();

    loader::BundleUpdater updater(
        root.string(), loader::updaterSettings(settings),
        [](const std::string &, double) -> std::optional<std::string> {
            return std::nullopt;
        },
        [](const std::string &, const std::string &, const std::map<std::string, std::string> &,
           const loader::DownloadPolicy &) -> std::optional<loader::DownloadResult> {
            return std::nullopt;
        });

    auto                   host = std::make_shared<CountingHost>();
    loader::LoaderPipeline pipeline(host, loader::updaterSettings(settings), updater);

    pipeline.prepare();
    assert(host->addonPreparations == 1);
    assert(!pipeline.waitForPreparedBundle(std::chrono::milliseconds(1)));

    pipeline.prepare();
    pipeline.prepare();
    assert(host->addonPreparations == 3);

    settings.set("unbound", "loader.enabled", false);
    pipeline.prepare();
    assert(host->addonPreparations == 3);
    assert(!pipeline.waitForPreparedBundle(std::chrono::milliseconds(1)));

    std::filesystem::remove_all(root);
    return 0;
}
