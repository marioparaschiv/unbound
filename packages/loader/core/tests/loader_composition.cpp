#include <cassert>
#include <filesystem>
#include <string>
#include <vector>

#include "Loader.h"
#include "LoaderPreferences.h"
#include "bundle_test_server.h"

namespace {
class RecordingTransport : public loader::HotReloadTransport
{
public:
    std::vector<std::string> opened;

    void open(const loader::HotReloadRequest &request) override
    {
        opened.push_back(request.url);
    }

    void cancel() override {}
};

class FakeHost : public loader::LoaderHost
{
public:
    std::optional<std::string>          devHost;
    std::vector<std::string>            probed;
    int                                 systemFontReads   = 0;
    int                                 fontChanges       = 0;
    int                                 themeRescans      = 0;
    int                                 addonPreparations = 0;
    int                                 bundlesExecuted   = 0;
    int                                 reloads           = 0;
    std::shared_ptr<RecordingTransport> transport;

    void runInBackground(std::function<void()> work) override
    {
        work();
    }

    // Runs only immediate work, so timeouts and reconnects never fire.
    void runAfter(double seconds, std::function<void()> work) override
    {
        if (seconds == 0)
        {
            work();
        }
    }

    std::optional<std::string> resource(const std::string &) override
    {
        return std::nullopt;
    }

    uint32_t runtimeBytecodeVersion() override
    {
        return 98;
    }

    std::optional<std::string> fetchText(const std::string &, double) override
    {
        return std::nullopt;
    }

    std::optional<loader::DownloadResult> download(const std::string &, const std::string &,
                                                   const std::map<std::string, std::string> &,
                                                   const loader::DownloadPolicy &) override
    {
        return std::nullopt;
    }

    bool isServing(const std::string &url, double) override
    {
        probed.push_back(url);
        return true;
    }

    std::optional<std::string> devServerHost() override
    {
        return devHost;
    }

    std::shared_ptr<loader::HotReloadTransport> hotReloadTransport() override
    {
        return transport;
    }

    nlohmann::json systemFonts() override
    {
        systemFontReads++;
        return nlohmann::json::array();
    }

    void onFontsChanged() override
    {
        fontChanges++;
    }

    void onThemesRescanned() override
    {
        themeRescans++;
    }

    void installNativeModules(facebook::jsi::Runtime &) override {}

    void extendNativeProvider(loader::UnboundNativeProvider &provider) override
    {
        provider.getAppIcons = [] {
            return nlohmann::json::array({"icon"});
        };
    }

    void onAddonsPrepared() override
    {
        addonPreparations++;
    }

    void onBundleExecuted() override
    {
        bundlesExecuted++;
    }

    void reload() override
    {
        reloads++;
    }
};

std::shared_ptr<loader::Loader> startLoader(const std::filesystem::path &documents,
                                            std::shared_ptr<FakeHost>    host)
{
    auto provider      = std::make_shared<loader::NativePlatformProvider>();
    provider->platform = "android";
    auto loader        = std::make_shared<loader::Loader>(
        loader::LoaderOptions{documents.string(), "Android", "libunbound.so"}, host, provider);
    loader->start();
    return loader;
}
}

static void testSettingsLoadFromDocuments()
{
    const auto root      = bundle_test::makeTemporaryDirectory();
    const auto documents = root / "Unbound";
    std::filesystem::create_directories(documents);
    loader::SettingsStore written((documents / "settings.json").string());
    written.set("unbound", "loader.update.url", "https://example.com/unbound.bundle");
    assert(written.save());

    auto host   = std::make_shared<FakeHost>();
    auto loader = startLoader(documents, host);

    assert(loader->settings().path() == (documents / "settings.json").string());
    assert(loader::preferences::updateURL(loader->settings()) ==
           "https://example.com/unbound.bundle");
    assert(loader->resolveUpdateURL() ==
           std::optional<std::string>("https://example.com/unbound.bundle"));
    assert(host->probed.empty());
    assert(loader::currentNativePlatformProvider()->documents == documents.string());
    assert(loader::currentNativePlatformProvider()->settings == &loader->settings());
    std::filesystem::remove_all(root);
}

static void testUpdateURLProbesTheDevServer()
{
    const auto root = bundle_test::makeTemporaryDirectory();
    auto       host = std::make_shared<FakeHost>();
    host->devHost   = "10.0.2.2";
    auto loader     = startLoader(root, host);
    assert(loader->resolveUpdateURL() == std::optional<std::string>("http://10.0.2.2:3000/"));
    assert(host->probed == std::vector<std::string>{"http://10.0.2.2:3000/manifest.json"});

    // The toolbox resolves the same URL, through the same host.
    loader::toolbox::ToolboxContext context = loader->toolboxContext();
    assert(context.platform == "Android");
    assert(context.updateURL() == std::optional<std::string>("http://10.0.2.2:3000/"));
    assert(context.bytecodeVersion() == 98);
    assert(!context.bundleReady());
    assert(context.provider && context.provider->platform == "android");
    std::filesystem::remove_all(root);
}

static void testNativeProviderIsComposedOnce()
{
    const auto root   = bundle_test::makeTemporaryDirectory();
    auto       host   = std::make_shared<FakeHost>();
    auto       loader = startLoader(root, host);

    loader::UnboundNativeProvider provider = loader->unboundNativeProvider();
    assert(provider.getLoader()["origin"] == "libunbound.so");
    assert(provider.getLoader()["bytecodeVersion"] == 98);
    assert(provider.getAppIcons() == nlohmann::json::array({"icon"}));
    assert(provider.fonts == loader->fonts());
    assert(provider.downloadFile);
    provider.rescanThemes();
    assert(host->themeRescans == 1);

    loader->onAddonsPrepared();
    assert(host->addonPreparations == 1);
    std::filesystem::remove_all(root);
}

static void testFontsReadSystemFontsOnce()
{
    const auto root   = bundle_test::makeTemporaryDirectory();
    auto       host   = std::make_shared<FakeHost>();
    auto       loader = startLoader(root, host);

    loader->fontCatalog();
    loader->fontCatalog();
    assert(host->systemFontReads == 1);
    assert(loader->resolveFont("gg sans") == "{}");
    assert(loader::currentNativePlatformProvider()->fonts().is_array());
    std::filesystem::remove_all(root);
}

static void testHotReloadNeedsATransport()
{
    const auto root = bundle_test::makeTemporaryDirectory();
    auto       none = startLoader(root, std::make_shared<FakeHost>());
    assert(!none->hotReload());
    none->onBundleExecuted();

    auto host       = std::make_shared<FakeHost>();
    host->transport = std::make_shared<RecordingTransport>();
    host->devHost   = "10.0.2.2";
    auto loader     = startLoader(root, host);
    assert(loader->hotReload());
    loader->settings().set("unbound", "loader.update.hmr", true);
    loader->onBundleExecuted();
    assert(host->bundlesExecuted == 1);
    assert(host->transport->opened == std::vector<std::string>{"http://10.0.2.2:3000/__hot"});
    std::filesystem::remove_all(root);
}

int main()
{
    testSettingsLoadFromDocuments();
    testUpdateURLProbesTheDevServer();
    testNativeProviderIsComposedOnce();
    testFontsReadSystemFontsOnce();
    testHotReloadNeedsATransport();
    loader::setNativePlatformProvider(nullptr);
    return 0;
}
