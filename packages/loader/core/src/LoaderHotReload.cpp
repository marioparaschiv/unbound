#include "LoaderHotReload.h"

#include <algorithm>

#include <nlohmann/json.hpp>

#include "LoaderLog.h"

namespace loader
{
    static constexpr std::string_view kDevServerProbePath = "manifest.json";
    static constexpr std::string_view kHotReloadPath      = "/__hot";

    static std::string_view trimmed(std::string_view value)
    {
        const auto isSpace = [](char character) {
            return character == ' ' || character == '\t' || character == '\r';
        };
        while (!value.empty() && isSpace(value.front()))
        {
            value.remove_prefix(1);
        }
        while (!value.empty() && isSpace(value.back()))
        {
            value.remove_suffix(1);
        }
        return value;
    }

    std::optional<std::string> resolveUpdateURL(const UpdaterSettings &settings,
                                                const std::optional<std::string> &devServerHost,
                                                const ReachabilityProbe &isServing)
    {
        std::string configured = settings.getString("loader.update.url", "");
        if (!configured.empty())
        {
            return configured;
        }

        if (!devServerHost || devServerHost->empty())
        {
            return std::nullopt;
        }

        std::string base = "http://" + *devServerHost + ":" + std::to_string(kDevServerPort) + "/";
        if (!isServing || !isServing(base + std::string(kDevServerProbePath), kDevServerProbeTimeoutSeconds))
        {
            log(LogLevel::Info, "updater",
                "Dev server: " + base + " is not reachable; using the default update URL.");
            return std::nullopt;
        }

        log(LogLevel::Info, "updater", "Dev server: using " + base + ".");
        return base;
    }

    std::optional<std::string> hotReloadURL(const std::string &base)
    {
        size_t schemeEnd = base.find("://");
        if (schemeEnd == std::string::npos || schemeEnd == 0)
        {
            return std::nullopt;
        }

        size_t authorityStart = schemeEnd + 3;
        size_t authorityEnd   = base.find_first_of("/?#", authorityStart);
        std::string authority = base.substr(authorityStart, authorityEnd == std::string::npos
                                                                ? std::string::npos
                                                                : authorityEnd - authorityStart);
        size_t credentials = authority.rfind('@');
        if (credentials != std::string::npos)
        {
            authority.erase(0, credentials + 1);
        }
        if (authority.empty() || authority.front() == ':')
        {
            return std::nullopt;
        }

        return base.substr(0, authorityStart) + authority + std::string(kHotReloadPath);
    }

    std::string normalizedEtag(std::string_view etag)
    {
        if (etag.substr(0, 2) == "W/")
        {
            etag.remove_prefix(2);
        }
        while (!etag.empty() && etag.front() == '"')
        {
            etag.remove_prefix(1);
        }
        while (!etag.empty() && etag.back() == '"')
        {
            etag.remove_suffix(1);
        }
        return std::string(etag);
    }

    std::optional<std::string> hotReloadEtag(std::string_view event)
    {
        std::string_view name;
        std::string_view data;

        while (!event.empty())
        {
            size_t           end  = event.find('\n');
            std::string_view line = event.substr(0, end);
            event.remove_prefix(end == std::string_view::npos ? event.size() : end + 1);

            if (line.substr(0, 6) == "event:")
            {
                name = trimmed(line.substr(6));
            }
            else if (line.substr(0, 5) == "data:")
            {
                data = trimmed(line.substr(5));
            }
        }

        if (name != "reload" || data.empty())
        {
            return std::nullopt;
        }

        nlohmann::json payload = nlohmann::json::parse(data, nullptr, false);
        if (!payload.is_object() || !payload.contains("etag") || !payload["etag"].is_string())
        {
            return std::nullopt;
        }

        std::string etag = payload["etag"].get<std::string>();
        return etag.empty() ? std::nullopt : std::optional<std::string>(etag);
    }

    bool hotReloadEventRequiresReload(const UpdaterSettings &settings, std::string_view event)
    {
        std::optional<std::string> incoming = hotReloadEtag(event);
        if (!incoming)
        {
            return false;
        }

        std::string stored = settings.getString("loader.update.etag", "");
        if (!stored.empty() && normalizedEtag(stored) == normalizedEtag(*incoming))
        {
            log(LogLevel::Info, "updater", "Hot-reload: etag unchanged (" + *incoming + "); skipping reload.");
            return false;
        }

        log(LogLevel::Info, "updater",
            "Hot-reload: etag mismatch (stored " + (stored.empty() ? std::string("<none>") : stored) +
                ", incoming " + *incoming + ") -> reloading.");
        return true;
    }

    double HotReloadBackoff::next()
    {
        double current = delay_;
        delay_         = std::min(delay_ * 2.0, kHotReloadMaximumDelaySeconds);
        return current;
    }

    void HotReloadBackoff::reset()
    {
        delay_ = kHotReloadMinimumDelaySeconds;
    }

    HotReloadStream::HotReloadStream(UpdaterSettings settings) : settings_(std::move(settings)) {}

    bool HotReloadStream::feed(std::string_view chunk)
    {
        buffer_.append(chunk);
        buffer_.erase(std::remove(buffer_.begin(), buffer_.end(), '\r'), buffer_.end());

        bool reload = false;
        size_t separator;
        while ((separator = buffer_.find("\n\n")) != std::string::npos)
        {
            std::string event = buffer_.substr(0, separator);
            buffer_.erase(0, separator + 2);
            reload = hotReloadEventRequiresReload(settings_, event) || reload;
        }
        return reload;
    }

    void HotReloadStream::reset()
    {
        buffer_.clear();
    }
}
