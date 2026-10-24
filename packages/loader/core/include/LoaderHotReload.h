#pragma once

#include <functional>
#include <optional>
#include <string>
#include <string_view>

#include "LoaderUpdater.h"

namespace loader
{
    constexpr int    kDevServerPort                = 3000;
    constexpr double kDevServerProbeTimeoutSeconds = 1.5;
    constexpr double kHotReloadMinimumDelaySeconds = 1.0;
    constexpr double kHotReloadMaximumDelaySeconds = 30.0;

    using ReachabilityProbe = std::function<bool(const std::string &url, double timeoutSeconds)>;

    std::optional<std::string> resolveUpdateURL(const UpdaterSettings &settings,
                                                const std::optional<std::string> &devServerHost,
                                                const ReachabilityProbe &isServing);
    std::optional<std::string> hotReloadURL(const std::string &base);
    std::string normalizedEtag(std::string_view etag);
    std::optional<std::string> hotReloadEtag(std::string_view event);
    bool hotReloadEventRequiresReload(const UpdaterSettings &settings, std::string_view event);

    class HotReloadBackoff
    {
    public:
        double next();
        void reset();

    private:
        double delay_ = kHotReloadMinimumDelaySeconds;
    };

    class HotReloadStream
    {
    public:
        explicit HotReloadStream(UpdaterSettings settings);

        bool feed(std::string_view chunk);
        void reset();

    private:
        UpdaterSettings settings_;
        std::string     buffer_;
    };
}
