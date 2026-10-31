#include <cassert>
#include <filesystem>
#include <string>
#include <unistd.h>
#include <vector>

#include "LoaderFiles.h"
#include "LoaderLog.h"
#include "LoaderPipeline.h"

namespace {
const std::string kDeadURL = "http://127.0.0.1:9/unbound.js";

struct LoggedLine {
    loader::LogLevel level;
    std::string      message;
};

class ImmediateHost : public loader::LoaderHost
{
public:
    void runOnRuntime(std::function<void(facebook::jsi::Runtime &)>) override {}
    void runAfter(double, std::function<void()>) override {}

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
        return kDeadURL;
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
    void onAddonsPrepared() override {}
};

std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-download-logging-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

loader::BundleUpdater unreachableUpdater(const std::filesystem::path &root,
                                         loader::SettingsStore       &settings)
{
    return loader::BundleUpdater(
        root.string(), loader::updaterSettings(settings),
        [](const std::string &, double) -> std::optional<std::string> {
            return std::nullopt;
        },
        [](const std::string &, const std::string &, const std::map<std::string, std::string> &,
           const loader::DownloadPolicy &) -> std::optional<loader::DownloadResult> {
            return std::nullopt;
        });
}

std::vector<LoggedLine> prepareAndCapture(loader::SettingsStore &settings,
                                          loader::BundleUpdater &updater)
{
    std::vector<LoggedLine> lines;
    loader::setLogSink([&](loader::LogLevel level, const std::string &, const std::string &text) {
        lines.push_back({level, text});
    });

    loader::LoaderPipeline pipeline(std::make_shared<ImmediateHost>(),
                                    loader::updaterSettings(settings), updater);
    pipeline.prepare();

    loader::setLogSink(nullptr);
    return lines;
}

const LoggedLine *find(const std::vector<LoggedLine> &lines, const std::string &prefix)
{
    for (const LoggedLine &line : lines)
    {
        if (line.message.rfind(prefix, 0) == 0)
        {
            return &line;
        }
    }
    return nullptr;
}
}

int main()
{
    const auto root = makeTemporaryDirectory();

    loader::SettingsStore settings((root / "settings.json").string());
    settings.load();
    loader::BundleUpdater updater = unreachableUpdater(root, settings);

    std::vector<LoggedLine> uncached = prepareAndCapture(settings, updater);

    const LoggedLine *manifest = find(uncached, "No usable manifest at ");
    assert(manifest);
    assert(manifest->level == loader::LogLevel::Warning);
    assert(manifest->message ==
           "No usable manifest at http://127.0.0.1:9/manifest.json; falling back to " + kDeadURL);

    const LoggedLine *failed = find(uncached, "Bundle download failed. ");
    assert(failed);
    assert(failed->level == loader::LogLevel::Error);
    assert(failed->message == "Bundle download failed. (Could not download " + kDeadURL + ")");

    assert(loader::writeTextFileAtomically(updater.resolveBundlePath(), "cached bundle"));

    std::vector<LoggedLine> cached = prepareAndCapture(settings, updater);

    const LoggedLine *covered = find(cached, "Bundle download failed. ");
    assert(covered);
    assert(covered->level == loader::LogLevel::Warning);
    assert(covered->message == "Bundle download failed. (Could not download " + kDeadURL +
                                   "); using the cached bundle");

    std::filesystem::remove_all(root);
    return 0;
}
