#include "Loader.h"

#include "LoaderFiles.h"
#include "LoaderFonts.h"
#include "LoaderJSON.h"
#include "LoaderPreferences.h"
#include "LoaderThemes.h"

namespace loader {
namespace jsi = facebook::jsi;

// The pipeline's view of the loader. Holds it weakly, as the loader owns the pipeline.
class Loader::Pipeline final : public PipelineHost
{
public:
    Pipeline(std::weak_ptr<Loader> loader, std::shared_ptr<LoaderHost> host)
        : loader_(std::move(loader)), host_(std::move(host))
    {
    }

    void runInBackground(std::function<void()> work) override
    {
        host_->runInBackground(std::move(work));
    }

    void runAfter(double seconds, std::function<void()> work) override
    {
        host_->runAfter(seconds, std::move(work));
    }

    std::optional<std::string> resource(const std::string &name) override
    {
        return host_->resource(name);
    }

    std::optional<std::string> resolveUpdateURL() override
    {
        auto loader = loader_.lock();
        return loader ? loader->resolveUpdateURL() : std::nullopt;
    }

    uint32_t runtimeBytecodeVersion() override
    {
        return host_->runtimeBytecodeVersion();
    }

    UnboundNativeProvider unboundNativeProvider() override
    {
        auto loader = loader_.lock();
        return loader ? loader->unboundNativeProvider() : UnboundNativeProvider{};
    }

    void installNativeModules(jsi::Runtime &runtime) override
    {
        if (auto loader = loader_.lock())
        {
            loader->installNativeModules(runtime);
        }
    }

    void onAddonsPrepared() override
    {
        if (auto loader = loader_.lock())
        {
            loader->onAddonsPrepared();
        }
    }

    void onBundleExecuted() override
    {
        if (auto loader = loader_.lock())
        {
            loader->onBundleExecuted();
        }
    }

    void alert(const std::string &message) override
    {
        host_->alert(message);
    }

    void crashAlert(const std::string &message) override
    {
        host_->crashAlert(message);
    }

    void showUpdateProgress(bool showing) override
    {
        host_->showUpdateProgress(showing);
    }

    void reload() override
    {
        host_->reload();
    }

private:
    std::weak_ptr<Loader>       loader_;
    std::shared_ptr<LoaderHost> host_;
};

Loader::Loader(LoaderOptions options, std::shared_ptr<LoaderHost> host,
               std::shared_ptr<NativePlatformProvider> provider)
    : options_(std::move(options)), host_(std::move(host)),
      provider_(provider ? std::move(provider) : std::make_shared<NativePlatformProvider>()),
      settings_(joinPath(options_.documents, preferences::kSettingsFile))
{
}

void Loader::start()
{
    std::weak_ptr<Loader> weak = weak_from_this();
    provider_->documents       = options_.documents;
    provider_->settings        = &settings_;
    provider_->fonts           = [weak] {
        auto self = weak.lock();
        return self ? self->fontCatalog() : nlohmann::json::array();
    };
    setNativePlatformProvider(provider_);

    createDirectories(options_.documents);
    settings_.load();
    host_->runInBackground([weak] {
        if (auto self = weak.lock())
        {
            self->settings_.refreshCache();
        }
    });

    fonts_ = std::make_shared<fonts::FontService>(
        options_.documents,
        [weak](const std::string &url, const std::string &destination,
               const std::map<std::string, std::string> &headers, const DownloadPolicy &policy) {
            auto self = weak.lock();
            return self ? self->host_->download(url, destination, headers, policy) : std::nullopt;
        });
    fonts_->store().open(preferences::fontOverrides(settings_));
    fonts_->store().setOnChange([weak] {
        if (auto self = weak.lock())
        {
            self->host_->onFontsChanged();
        }
    });

    updater_ = std::make_unique<BundleUpdater>(
        options_.documents, settings_,
        [host = host_](const std::string &url, double timeout) {
            return host->fetchText(url, timeout);
        },
        [host = host_](const std::string &url, const std::string &destination,
                       const std::map<std::string, std::string> &headers,
                       const DownloadPolicy                     &policy) {
            return host->download(url, destination, headers, policy);
        });
    pipeline_ = std::make_unique<LoaderPipeline>(std::make_shared<Pipeline>(weak, host_), settings_,
                                                 *updater_);

    if (std::shared_ptr<HotReloadTransport> transport = host_->hotReloadTransport())
    {
        hotReload_ = std::make_shared<HotReloadController>(
            settings_,
            [weak] {
                auto self = weak.lock();
                return self ? self->resolveUpdateURL() : std::nullopt;
            },
            std::move(transport),
            [host = host_](double seconds, std::function<void()> work) {
                // Off the timer's thread, as a reconnect can block on the network.
                host->runAfter(seconds, [host, work = std::move(work)]() mutable {
                    host->runInBackground(std::move(work));
                });
            },
            [host = host_] {
                host->reload();
            });
    }
}

void Loader::prescanAddons()
{
    addons_.prescan(options_.documents, host_->runtimeBytecodeVersion());
}

void Loader::prepare()
{
    // start() loaded the file at launch; a reloaded runtime still sees edits made since.
    settings_.reload();
    pipeline_->prepare();
}

void Loader::onRuntimeCreated(jsi::Runtime &runtime)
{
    pipeline_->onRuntimeCreated(runtime);
}

void Loader::markHealthy()
{
    if (pipeline_)
    {
        pipeline_->markHealthy();
    }
}

SettingsStore &Loader::settings()
{
    return settings_;
}

BundleUpdater &Loader::updater()
{
    return *updater_;
}

AddonState &Loader::addons()
{
    return addons_;
}

std::shared_ptr<fonts::FontService> Loader::fonts()
{
    return fonts_;
}

std::shared_ptr<HotReloadController> Loader::hotReload()
{
    return hotReload_;
}

const std::string &Loader::documents() const
{
    return options_.documents;
}

bool Loader::isBundleReady() const
{
    return pipeline_ && pipeline_->isBundleReady();
}

const nlohmann::json &Loader::systemFonts()
{
    std::lock_guard<std::mutex> lock(systemFontsMutex_);
    if (!systemFonts_)
    {
        systemFonts_ = loader::fontCatalog(nlohmann::json::array(), host_->systemFonts());
    }
    return *systemFonts_;
}

nlohmann::json Loader::fontCatalog()
{
    return loader::fontCatalog(fonts_->catalogEntries(), systemFonts());
}

std::string Loader::resolveFont(const std::string &family)
{
    const auto target = fonts_ ? fonts_->store().overrideTarget(family) : std::nullopt;
    return target ? toJSON(*target) : "{}";
}

nlohmann::json Loader::themeColors(const std::string &themeId)
{
    std::optional<nlohmann::json> theme = addons_.theme(themeId);
    return theme ? themeColorsByAccessor(resolveThemeColors(*theme)) : nlohmann::json::object();
}

toolbox::ToolboxContext Loader::toolboxContext()
{
    std::weak_ptr<Loader> weak = weak_from_this();
    return {settings_,
            *updater_,
            options_.documents,
            options_.platform,
            [weak]() -> std::optional<std::string> {
                auto self = weak.lock();
                return self ? self->resolveUpdateURL() : std::nullopt;
            },
            [weak] {
                auto self = weak.lock();
                return self ? self->runtimeBytecodeVersion() : 0;
            },
            [weak] {
                auto self = weak.lock();
                return self && self->isBundleReady();
            },
            provider_};
}

std::string Loader::toolbox(const std::string &action, const std::string &argument)
{
    toolbox::ToolboxContext context = toolboxContext();
    return toolbox::perform(context, action, argument);
}

LoaderHost &Loader::host()
{
    return *host_;
}

std::optional<std::string> Loader::resolveUpdateURL()
{
    return loader::resolveUpdateURL(settings_, host_->devServerHost(),
                                    [host = host_](const std::string &url, double timeout) {
                                        return host->isServing(url, timeout);
                                    });
}

uint32_t Loader::runtimeBytecodeVersion()
{
    return host_->runtimeBytecodeVersion();
}

UnboundNativeProvider Loader::unboundNativeProvider()
{
    UnboundNativeProvider provider = makeUnboundNativeProvider(
        addons_, fonts_, options_.origin, runtimeBytecodeVersion(), options_.documents,
        [host = host_](const std::string &url, const std::string &destination,
                       const std::map<std::string, std::string> &headers,
                       const DownloadPolicy                     &policy) {
            return host->download(url, destination, headers, policy);
        });
    // The scan finishes before the call returns, so the client's next `getThemes` lists the theme.
    provider.rescanThemes = [weak = weak_from_this()] {
        if (auto self = weak.lock())
        {
            self->addons_.rescanThemes(self->options_.documents);
            self->host_->onThemesRescanned();
        }
    };
    host_->extendNativeProvider(provider);
    return provider;
}

void Loader::installNativeModules(jsi::Runtime &runtime)
{
    host_->installNativeModules(runtime);
    installNativePlatform(runtime, provider_);
}

void Loader::onAddonsPrepared()
{
    addons_.scan(options_.documents, runtimeBytecodeVersion());
    host_->onAddonsPrepared();
}

void Loader::onBundleExecuted()
{
    if (hotReload_)
    {
        hotReload_->sync();
    }
    host_->onBundleExecuted();
}
}
